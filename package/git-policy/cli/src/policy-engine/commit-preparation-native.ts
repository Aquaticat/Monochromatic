/**
 Native `git commit` against the shadow repository and the private commit index.

 Git owns hooks,
 the editor,
 templates,
 message cleanup,
 and signing;
 the dispatcher shim runs the repository's hooks through `git hook run`.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { SILENCED_HOOK_EVENTS, } from '../hook-dispatch/hook-dispatch-plan.ts';
import { PATHSPEC_SEPARATOR, } from '../escape-hatch.ts';
import { normaliseCommitArgs, } from '../parser/commit-normalise.ts';
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  parseRawCommit,
  type RawCommit,
} from './commit-replay-object.ts';

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
 Global options that redirect native Git away from the shadow repository and are therefore dropped.
 */
const REDIRECTING_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '-C',
  '--git-dir',
  '--work-tree',
],);

/**
 Global options that consume the next token as their value.
 */
const VALUE_TAKING_GLOBAL_OPTIONS: ReadonlySet<string> = new Set([
  '-c',
  '-C',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--attr-source',
],);

/**
 Commit options whose separated value never names a flag.
 */
const COMMIT_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '-m',
  '-F',
  '-C',
  '-c',
  '-t',
  '-U',
  '--message',
  '--file',
  '--reuse-message',
  '--reedit-message',
  '--squash',
  '--fixup',
  '--author',
  '--date',
  '--cleanup',
  '--trailer',
  '--template',
  '--unified',
  '--inter-hunk-context',
  '--pathspec-from-file',
],);

/**
 Short commit options with an optional attached value (`-S[<keyid>]`, `-u[<mode>]`).
 */
const OPTIONAL_VALUE_LETTERS: ReadonlySet<string> = new Set([
  'S',
  'u',
],);

/**
 Environment variables native Git must not inherit, so every object it writes lands in the shadow store.
 */
export const NATIVE_UNSET_VARIABLES: readonly string[] = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
];

/**
 Native `git commit` failed during preparation; its exit code is the invocation's exit code.
 */
export class NativeCommitFailedError extends Error {
  /**
   Native Git exit code.
   */
  public readonly exitCode: number;

  /**
   Creates a preparation failure.

   @param exitCode - native Git exit code

   @param message - explanation, the preparation failure when absent
   */
  public constructor({
    exitCode,
    message = `git commit exited ${String(exitCode,)} during private preparation; nothing landed.`,
  }: Readonly<{
    exitCode: number;
    message?: string;
  }>,) {
    super(message,);
    this.name = 'NativeCommitFailedError';
    this.exitCode = exitCode;
  }
}

/**
 Splits transformed wrapper arguments into kept global options and the post-`commit` region.

 @param args - transformed wrapper arguments ending in a `commit` invocation

 @param subcommandIndex - index of `commit`

 @returns global options without `-C`, `--git-dir`, `--work-tree`, and `--bare`, and the commit region

 @example
 ```ts
 splitCommitInvocation({ args: ['-C', 'r', '-c', 'a.b=1', 'commit', '-m', 'x'], subcommandIndex: 4 });
 // { globalArgs: ['-c', 'a.b=1'], commitArgs: ['-m', 'x'] }
 ```
 */
export function splitCommitInvocation({
  args,
  subcommandIndex,
}: Readonly<{
  args: readonly string[];
  subcommandIndex: number;
}>,): Readonly<{
  globalArgs: readonly string[];
  commitArgs: readonly string[];
}> {
  /**
   Global option tokens.
   */
  const globals = args.slice(
    0,
    subcommandIndex,
  );
  /**
   Kept global options, rebuilt pairwise so a dropped option also drops its value.
   */
  const kept: string[] = [];
  for (let index = 0; index < globals.length; index += 1) {
    /**
     Current global token.
     */
    const token = globals[index] ?? '';
    /**
     Option name before an attached `=` value.
     */
    const name = token.includes('=',) && token.startsWith('--',) ? token.slice(
      0,
      token.indexOf('=',),
    ) : token;
    /**
     Whether the token's value is the next token.
     */
    const separatedValue = VALUE_TAKING_GLOBAL_OPTIONS.has(token,);
    if (REDIRECTING_VALUE_OPTIONS.has(name,) || (token === '--bare')) {
      if (separatedValue)
        index += 1;
      continue;
    }
    kept.push(token,);
    if (separatedValue) {
      /**
       Separated option value.
       */
      const value = globals[index + 1];
      if (value !== undefined)
        kept.push(value,);
      index += 1;
    }
  }
  return {
    globalArgs: kept,
    commitArgs: args.slice(subcommandIndex + 1,),
  };
}

/**
 Removes the `-a`/`--all` flag after the private index already holds every tracked change,
 so native Git commits the policy-settled index instead of restaging worktree bytes.

 @param commitArgs - post-`commit` arguments

 @returns arguments without the all flag, with clustered short options kept

 @example
 ```ts
 withoutAllFlag(['-am', 'x']); // ['-m', 'x']
 ```
 */
export function withoutAllFlag(commitArgs: readonly string[],): readonly string[] {
  /**
   Clusters split so a value-taking letter stands alone.
   */
  const normalised = normaliseCommitArgs(commitArgs,);
  /**
   Kept tokens.
   */
  const kept: string[] = [];
  /**
   Whether the next token is an option value.
   */
  let valueNext = false;
  /**
   Whether the pathspec separator was passed.
   */
  let afterSeparator = false;
  for (const token of normalised) {
    if (afterSeparator || valueNext) {
      kept.push(token,);
      valueNext = false;
      continue;
    }
    if (token === PATHSPEC_SEPARATOR) {
      afterSeparator = true;
      kept.push(token,);
      continue;
    }
    if (token === '--all')
      continue;
    if (token.startsWith('-',) && (!token.startsWith('--',))
      && (token.length > 1)) {
      /**
       Cluster letters; everything after an optional-value letter is that option's value.
       */
      const letters = Array.from(token.slice(1,),);
      /**
       First optional-value letter, whose attached value must stay verbatim.
       */
      const valueStart = letters.findIndex(function takesAttachedValue(letter,): boolean {
        return OPTIONAL_VALUE_LETTERS.has(letter,);
      },);
      /**
       Boolean letters that may include the all flag.
       */
      const flags = valueStart === (-1) ? letters : letters.slice(
        0,
        valueStart,
      );
      /**
       Rebuilt cluster without the all flag.
       */
      const cluster = `-${[
        ...flags.filter(function keepLetter(letter,): boolean {
          return letter !== 'a';
        },),
        ...(valueStart === (-1) ? [] : letters.slice(valueStart,)),
      ].join('',)}`;
      if (cluster === '-')
        continue;
      kept.push(cluster,);
      valueNext = COMMIT_VALUE_OPTIONS.has(cluster,);
      continue;
    }
    kept.push(token,);
    valueNext = COMMIT_VALUE_OPTIONS.has(token,);
  }
  return kept;
}

/**
 Runs native `git commit` in the shadow repository with inherited stdio.

 @param gitPath - real Git executable

 @param cwd - effective invocation directory

 @param globalArgs - caller's kept global options

 @param commitArgs - private commit arguments without pathspecs or `--only`

 @param shadowPath - shadow repository

 @param worktreeRoot - absolute worktree root

 @param hooksDirectory - dispatcher shim directory

 @param commitIndexPath - private commit index

 @throws {@link NativeCommitFailedError} when native Git exits nonzero

 @example
 ```ts
 await runNativePreparation({ gitPath: '/usr/bin/git', cwd: '/repo', globalArgs: [], commitArgs: ['-m', 'x'], shadowPath, worktreeRoot: '/repo', hooksDirectory, commitIndexPath });
 ```
 */
export async function runNativePreparation({
  gitPath,
  cwd,
  globalArgs,
  commitArgs,
  shadowPath,
  worktreeRoot,
  hooksDirectory,
  commitIndexPath,
}: Readonly<{
  gitPath: string;
  cwd: string;
  globalArgs: readonly string[];
  commitArgs: readonly string[];
  shadowPath: string;
  worktreeRoot: string;
  hooksDirectory: string;
  commitIndexPath: string;
}>,): Promise<void> {
  /**
   Tagged native preparation logger.
   */
  const rl = tagged({
    tag: runNativePreparation.name,
    l,
  },);
  /**
   Native Git outcome with the user's terminal attached.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      ...globalArgs,
      `--git-dir=${shadowPath}`,
      `--work-tree=${worktreeRoot}`,
      '-c',
      `core.hooksPath=${hooksDirectory}`,
      ...SILENCED_HOOK_EVENTS.flatMap(function silence(event,): readonly string[] {
        return [
          '-c',
          `hook.${event}.enabled=false`,
        ];
      },),
      'commit',
      ...commitArgs,
    ],
    indexPath: commitIndexPath,
    unsetEnvironment: NATIVE_UNSET_VARIABLES,
    stdio: 'inherit',
    allowFailure: true,
  },);
  if (result.exitCode !== 0) {
    rl.debug(`native preparation exited ${String(result.exitCode,)}`,);
    throw new NativeCommitFailedError({ exitCode: result.exitCode, },);
  }
}

/**
 Prepared commit facts read from the shadow repository.
 */
export type PreparedCommit = Readonly<{
  /**
   Prepared commit, the shadow `HEAD` value.
   */
  oid: string;
  /**
   Prepared commit tree.
   */
  treeOid: string;
  /**
   Whether the commit carries a `gpgsig` or `gpgsig-sha256` header.
   */
  signed: boolean;
  /**
   Exact parsed object, the source every replay rebuilds from.
   */
  raw: RawCommit;
}>;

/**
 Reads the prepared commit from the shadow `HEAD`.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @returns prepared commit facts

 @example
 ```ts
 await readPreparedCommit({ gitPath: '/usr/bin/git', shadowPath });
 ```
 */
export async function readPreparedCommit({
  gitPath,
  shadowPath,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
}>,): Promise<PreparedCommit> {
  /**
   Prepared commit OID.
   */
  const oid = DECODER.decode((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'rev-parse',
      '--verify',
      'HEAD^{commit}',
    ],
  },)).stdout,)
    .trim();
  /**
   Exact raw commit bytes; the message may use a non-UTF-8 `encoding`.
   */
  const raw = parseRawCommit((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'cat-file',
      'commit',
      oid,
    ],
  },)).stdout,);
  return {
    oid,
    treeOid: raw.treeOid,
    signed: raw.signed,
    raw,
  };
}
