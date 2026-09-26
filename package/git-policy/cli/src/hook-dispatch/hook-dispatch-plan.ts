/**
 Dispatch plan the hook shim reads: which hooks run, how, and under which lock.

 The plan is computed in the wrapper process from the real repository and the caller's environment,
 because inside native `git commit` the shim only sees the transaction's overrides.

 @module
 */
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { runTransactionGit, } from '../policy-engine/commit-transaction-git.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Commit events the shim dispatches during preparation; `post-commit` runs once after landing instead.
 */
export const PREPARATION_HOOK_EVENTS = [
  'pre-commit',
  'prepare-commit-msg',
  'commit-msg',
] as const;

/**
 Every commit event the transaction silences inside native `git commit`.
 */
export const SILENCED_HOOK_EVENTS = [
  'pre-commit',
  'prepare-commit-msg',
  'commit-msg',
  'post-commit',
] as const;

/**
 One commit hook event.
 */
export type CommitHookEvent = typeof SILENCED_HOOK_EVENTS[number];

/**
 Environment variable carrying the preparation lease into hook descendants.
 */
export const PREPARATION_LEASE_ENV = 'CLI_GIT_PREPARATION_LEASE';

/**
 Plan written to `<tx>/hooks/plan.json`.
 */
export type HookDispatchPlan = Readonly<{
  /**
   Plan schema version.
   */
  schemaVersion: 1;
  /**
   Absolute real Git executable the shim runs `git hook run` with.
   */
  gitPath: string;
  /**
   Repository's own absolute hooks directory: `core.hooksPath`, or `<git-common-dir>/hooks` when unset.
   */
  hooksPath: string;
  /**
   Events the user disabled through `hook.<event>.enabled=false`.
   */
  disabledEvents: readonly CommitHookEvent[];
  /**
   Caller's `GIT_CONFIG_PARAMETERS` including its global `-c` options, or `null` when there were none.
   */
  configParameters: string | null;
  /**
   Absolute worktree root exported as `GIT_WORK_TREE`.
   */
  worktreeRoot: string;
  /**
   Preparation lease exported to hook descendants.
   */
  lease: string;
  /**
   Hook lock directory.
   */
  hookLockPath: string;
  /**
   Whether hooks skip the hook lock (`hooks.concurrentCommits`, or a valid inherited lease).
   */
  skipHookLock: boolean;
}>;

/**
 Quotes one value in the single-quoted form Git reads from `GIT_CONFIG_PARAMETERS`.

 Git's `sq_quote_buf` closes the quote around `'` and `!`;
 the parser accepts that form in every supported version.

 @param value - `key=value` text

 @returns quoted entry

 @example
 ```ts
 quoteConfigParameter("user.name=O'Brien"); // "'user.name=O'\\''Brien'"
 ```
 */
export function quoteConfigParameter(value: string,): string {
  /**
   Quoted characters, closing and reopening the quote around the two characters Git escapes.
   */
  const body = Array.from(value,)
    .map(function quoteCharacter(character,): string {
      if (character === '\'')
        return '\'\\\'\'';
      if (character === '!')
        return '\'\\!\'';
      return character;
    },)
    .join('',);
  return `'${body}'`;
}

/**
 Collects the values of every global `-c` option before the subcommand.

 @param globalArgs - arguments before the subcommand

 @returns `key=value` texts in order

 @example
 ```ts
 globalConfigOverrides(['-c', 'a.b=1', '--no-pager']); // ['a.b=1']
 ```
 */
export function globalConfigOverrides(globalArgs: readonly string[],): readonly string[] {
  return globalArgs.flatMap(function valueAfterFlag(
    token,
    index,
  ): readonly string[] {
    /**
     Following token.
     */
    const next = globalArgs[index + 1];
    return (token === '-c') && (next !== undefined) ? [next,] : [];
  },);
}

/**
 Combines the caller's `GIT_CONFIG_PARAMETERS` with its global `-c` options,
 the value native Git would hand its hooks.

 @param inherited - caller environment value, possibly absent

 @param overrides - global `-c` values

 @returns combined value, or `null` when both are absent

 @example
 ```ts
 combineConfigParameters({ inherited: undefined, overrides: ['a.b=1'] }); // "'a.b=1'"
 ```
 */
export function combineConfigParameters({
  inherited,
  overrides,
}: Readonly<{
  inherited: string | undefined;
  overrides: readonly string[];
}>,): string | null {
  /**
   Entries in Git's order: inherited first, then command-line options.
   */
  const entries = [
    ...((inherited === undefined) || (inherited === '') ? [] : [inherited,]),
    ...overrides.map(quoteConfigParameter,),
  ];
  return entries.length === 0 ? null : entries.join(' ',);
}

/**
 Reads one optional config value in the owning worktree with the caller's global options applied.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param globalArgs - caller's kept global options

 @param type - Git config value type

 @param key - config key

 @returns value, or `undefined` when unset
 */
async function readConfig({
  gitPath,
  cwd,
  globalArgs,
  type,
  key,
}: Readonly<{
  gitPath: string;
  cwd: string;
  globalArgs: readonly string[];
  type: 'path' | 'bool';
  key: string;
}>,): Promise<string | undefined> {
  /**
   Config lookup; exit 1 means unset.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      ...globalArgs,
      'config',
      `--type=${type}`,
      '--get',
      key,
    ],
    allowFailure: true,
  },);
  if (result.exitCode === 1)
    return undefined;
  if (result.exitCode !== 0)
    throw new TypeError(`git config --get ${key} failed: ${result.stderr.trim()}`,);
  /**
   Value with Git's single terminating newline.
   */
  const text = DECODER.decode(result.stdout,);
  return text.endsWith('\n',) ? text.slice(
    0,
    -1,
  ) : text;
}

/**
 Computes the dispatch plan for one transaction.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param globalArgs - caller's global options kept for native Git, whose `-c` values join the config parameters

 @param commonDir - absolute common Git directory

 @param worktreeRoot - absolute worktree root

 @param lease - preparation lease token

 @param concurrentCommits - `hooks.concurrentCommits`

 @param inheritedLeaseValid - whether this invocation runs under a valid outer preparation lease

 @param environment - caller environment

 @returns dispatch plan

 @example
 ```ts
 await computeHookDispatchPlan({ gitPath: '/usr/bin/git', cwd: '/repo', globalArgs: [], commonDir: '/repo/.git', worktreeRoot: '/repo', lease: 'x', concurrentCommits: false, inheritedLeaseValid: false, environment: process.env });
 ```
 */
export async function computeHookDispatchPlan({
  gitPath,
  cwd,
  globalArgs,
  commonDir,
  worktreeRoot,
  lease,
  concurrentCommits,
  inheritedLeaseValid,
  environment,
}: Readonly<{
  gitPath: string;
  cwd: string;
  globalArgs: readonly string[];
  commonDir: string;
  worktreeRoot: string;
  lease: string;
  concurrentCommits: boolean;
  inheritedLeaseValid: boolean;
  environment: Readonly<Record<string, string | undefined>>;
}>,): Promise<HookDispatchPlan> {
  /**
   Tagged plan logger.
   */
  const rl = tagged({
    tag: computeHookDispatchPlan.name,
    l,
  },);
  /**
   Repository hooks path and each event switch, read concurrently.
   */
  const [configuredHooksPath, ...eventSwitches] = await Promise.all([
    readConfig({
      gitPath,
      cwd,
      globalArgs,
      type: 'path',
      key: 'core.hooksPath',
    },),
    ...SILENCED_HOOK_EVENTS.map(function readEventSwitch(event,): Promise<string | undefined> {
      return readConfig({
        gitPath,
        cwd,
        globalArgs,
        type: 'bool',
        key: `hook.${event}.enabled`,
      },);
    },),
  ],);
  /**
   Absolute hooks directory; Git resolves a relative `core.hooksPath` where hooks run, the worktree root.
   */
  const hooksPath = configuredHooksPath === undefined
    ? join(
      commonDir,
      'hooks',
    )
    : (isAbsolute(configuredHooksPath,) ? configuredHooksPath : resolve(
      worktreeRoot,
      configuredHooksPath,
    ));
  /**
   Plan with every value encoded later through `JSON.stringify`.
   */
  const plan: HookDispatchPlan = {
    schemaVersion: 1,
    gitPath,
    hooksPath,
    disabledEvents: SILENCED_HOOK_EVENTS.filter(function isDisabled(
      _event,
      index,
    ): boolean {
      return eventSwitches[index] === 'false';
    },),
    configParameters: combineConfigParameters({
      inherited: environment.GIT_CONFIG_PARAMETERS,
      overrides: globalConfigOverrides(globalArgs,),
    },),
    worktreeRoot,
    lease,
    hookLockPath: join(
      commonDir,
      'cli-git',
      'hook.lock',
    ),
    skipHookLock: concurrentCommits || inheritedLeaseValid,
  };
  rl.debug(`hook plan: hooksPath=${plan.hooksPath} disabled=${plan.disabledEvents.join(',',)} skipLock=${String(plan.skipHookLock,)}`,);
  return plan;
}
