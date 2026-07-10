#!/usr/bin/env node
import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { autoPush, } from './auto-push.ts';
import { parseGlobalOptions, } from './parse-global-options.ts';
import { runManagementCommand, } from './management.ts';
import { parseCommitRegion, } from './parsers/commit.ts';
import { runPolicyEngine, } from './policy-engine/engine.ts';
import { renderPolicyEvents, } from './policy-engine/events.ts';
import { resolveGit, } from './resolve-git.ts';
import { addExplicit, } from './rules/add-explicit.ts';
import { atomicPush, } from './rules/atomic-push.ts';
import { branchWorktreeOnly, } from './rules/branch-worktree-only.ts';
import { commitOnly, } from './rules/commit-only.ts';
import { linkedWorktreeOnly, } from './rules/linked-worktree-only.ts';
import {
  hasExplicitStatusHintsOverride,
  statusHintsOff,
} from './rules/status-hints-off.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

export {};

//region Rule pipeline: validate and transform args before forwarding to real git

/**
 * Tagged logger for the main entry point.
 */
const rl = tagged({
  tag: 'main',
  l,
},);

/**
 * Raw arguments passed after the script name.
 */
const rawArgs: readonly string[] = process.argv
  .slice(2,);

/**
 * Pre-subcommand argv tokens that request version information and cause git
 * to print the version and exit (ignoring any later subcommand). Detected by
 * scanning args before the located subcommand index; the `version` subcommand
 * is handled separately by inspecting `args[subcommandIndex]`.
 */
const VERSION_FLAGS: ReadonlySet<string> = new Set([
  '--version',
  '-v',
],);

/**
 * Pre-subcommand argv tokens that cause git to short-circuit: it prints
 * version/help and ignores the subcommand. When any of these appears, the
 * rules pipeline is skipped entirely so wrapper injections do not slot
 * between the short-circuit flag and a later token, which git would then
 * try to parse as flags of its `version` (or `help`) subcommand and reject
 * with `unknown switch ...`.
 */
const SHORT_CIRCUIT_FLAGS: ReadonlySet<string> = new Set([
  '--version',
  '-v',
  '--help',
  '-h',
],);

/**
 * `git status` flags that switch output to a machine-readable format
 * (no hints, fixed shape consumed by tooling). When any of these is present,
 * the cli-git note is suppressed so the output remains parseable.
 *
 * `-z` implies `--porcelain` per git's docs and is included here for that
 * reason. `--porcelain=v1` / `--porcelain=v2` use the same exact-token check
 * applied via prefix match.
 */
const STATUS_MACHINE_READABLE_FLAGS: ReadonlySet<string> = new Set([
  '--porcelain',
  '-s',
  '--short',
  '-z',
],);

/**
 * Rules applied in sequence. Each rule may transform args or throw to reject.
 * Order matters: unified require-root policy runs before this pipeline,
 * then {@link linkedWorktreeOnly} catches guarded state-changing
 * worktree forms, then arg transforms run.
 */
const RULES: readonly ((
  args: readonly string[],
) => readonly string[] | Promise<readonly string[]>)[] = [
  linkedWorktreeOnly,
  branchWorktreeOnly,
  addExplicit,
  atomicPush,
  commitOnly,
  statusHintsOff,
];

//endregion Rule pipeline

//region Execution: resolve real git, apply rules, spawn

/** Expected non-zero policy decision after buffered events were emitted. */
class PolicyDecisionError extends Error {
  /** Settled cli-git exit code. */
  public readonly exitCode: 1 | 2;

  /**
   * Creates control-flow error that cannot be confused with engine exceptions.
   *
   * @param exitCode - settled policy decision
   */
  public constructor(exitCode: 1 | 2,) {
    super('policy decision blocked real Git',);
    this.name = 'PolicyDecisionError';
    this.exitCode = exitCode;
  }
}

/** Layout used to intercept namespaced management command before Git forwarding. */
const managementLayout = parseGlobalOptions(rawArgs,);
/** Whether wrapper owns this invocation as a management command. */
const isManagementCommand = rawArgs[managementLayout.subcommandIndex] === 'cli-git';

if (isManagementCommand) {
  process.exitCode = await runManagementCommand(
    rawArgs.slice(managementLayout.subcommandIndex + 1,),
  );
}
else try {
  /**
   * Layout of `rawArgs` consulted before the rules run so short-circuit flags can be detected on the user's literal input.
   */
  const { subcommandIndex: rawSubcommandIndex, } = parseGlobalOptions(rawArgs,);
  /**
   * Pre-subcommand region of `rawArgs`; scanned for flags that make git ignore the subcommand entirely.
   */
  const rawPreSubcommand = rawArgs.slice(
    0,
    rawSubcommandIndex,
  );
  /**
   * True when git will short-circuit on a pre-subcommand `--version`/`-v`/`--help`/`-h`; rule injections between the flag and the subcommand would be parsed by the wrong git subcommand and error.
   */
  const willShortCircuit = rawPreSubcommand.some(function isShortCircuitFlag(arg,) {
    return SHORT_CIRCUIT_FLAGS.has(arg,);
  },);

  /** Stable require-root policy result before legacy transforms. */
  const policyResult = willShortCircuit
    ? undefined
    : await runPolicyEngine({ args: rawArgs, trigger: 'pre-forward', },);
  if (policyResult !== undefined) {
    const renderedEvents = renderPolicyEvents(policyResult.events,);
    if (renderedEvents !== '')
      process.stderr.write(renderedEvents,);
    policyResult.configWarnings.forEach(function emitConfigWarning(warning,) {
      console.error(`cli-git: ${warning}`,);
    },);
    if (!policyResult.shouldForward)
      throw new PolicyDecisionError(policyResult.exitCode as 1 | 2,);
  }

  /**
   * Final arguments after all rules have been applied; rules are skipped when git will short-circuit so the wrapper does not corrupt the invocation.
   */
  const processedArgs = willShortCircuit
    ? rawArgs
    : await RULES.reduce(
      async function applyRule(
        accumulatedArgs,
        rule,
      ) {
        return rule(await accumulatedArgs,);
      },
      Promise.resolve(policyResult?.args ?? rawArgs,),
    );

  if (willShortCircuit)
    rl.debug('pre-subcommand short-circuit flag present, skipping rules pipeline',);

  rl.debug(`final args: [${processedArgs.join(', ',)}]`,);

  /**
   * Absolute path to the real git binary.
   */
  const gitPath = await resolveGit();
  rl.debug(`using real git at ${gitPath}`,);

  await nanoSpawn(
    gitPath,
    [...processedArgs,],
    { stdio: 'inherit', },
  );

  /**
   * Layout of `processedArgs`: where the subcommand sits, what precedes it, and
   * the directory git will operate in after `-C` chaining.
   */
  const {
    subcommandIndex,
    effectiveCwd,
  } = parseGlobalOptions(processedArgs,);
  /**
   * Subcommand at the located index; `undefined` when args carry no subcommand (e.g. `git --version`).
   */
  const subcommand = processedArgs[subcommandIndex];
  /**
   * Pre-subcommand region (global options); scanned for `--version`/`-v` flags that short-circuit git.
   */
  const preSubcommand = processedArgs.slice(
    0,
    subcommandIndex,
  );
  /**
   * Post-subcommand region; scanned for status flags that switch git's output to a machine-readable format.
   */
  const postSubcommand = processedArgs.slice(subcommandIndex + 1,);

  /**
   * True when a real commit just landed (the spawn above succeeded and this
   * was not a dry-run preview), so the new commit should be backed up.
   * Dry-run detection uses the parsed commit region, which covers
   * `--dry-run` plus the output-format flags git documents as implying it
   * (`--short`, `--porcelain`, `--long`, `-z`/`--null`) in any accepted
   * abbreviation. A failed commit throws out of the spawn above and never
   * reaches here.
   */
  const committed = (subcommand === 'commit')
    && (!parseCommitRegion(postSubcommand,)
      .isDryRun);

  if (committed)
    await autoPush({
      gitPath,
      cwd: effectiveCwd,
    },);

  /**
   * True when this invocation asks git for its version, in any of the supported forms (subcommand, global flag, with or without `-C` chaining).
   */
  const isVersionRequest = (subcommand === 'version')
    || preSubcommand
    .some(function isVersionFlag(arg,) {
      return VERSION_FLAGS.has(arg,);
    },);

  /**
   * True when `git status` is in a machine-readable mode (`-s`, `--short`, `--porcelain`, `--porcelain=v*`, `-z`); the cli-git note would corrupt this output and is suppressed.
   */
  const isStatusMachineReadable = postSubcommand.some(
    function isMachineReadableFlag(arg,) {
      return STATUS_MACHINE_READABLE_FLAGS.has(arg,)
        || arg
        .startsWith('--porcelain=',);
    },
  );

  /**
   * True when the caller has explicitly configured git's status hints (checked on rawArgs so the wrapper's own injection does not register); mirroring the rule's user-override path, the note is also suppressed.
   */
  const userOverrodeStatusHints = hasExplicitStatusHintsOverride(rawArgs,);

  /**
   * True when this is a human-readable `git status` invocation that did not opt into git's stock hints; the wrapper prints a note explaining the constraints.
   */
  const shouldPrintStatusNote = (subcommand === 'status')
    && (!isStatusMachineReadable)
    && (!userOverrodeStatusHints);

  if (isVersionRequest) {
    console.log(
      'cli-git wrapper (require-root, linked-worktree-only, branch-worktree-only, '
        + 'add-explicit, atomic-push, commit-only, status-hints-off, auto-push)',
    );
  }
  else if (shouldPrintStatusNote) {
    console.log(
      'cli-git: bulk-add patterns (`.`, `*`, `-A`, `-u`), `git commit -a`, '
        + 'and current-worktree branch creation are rejected; stage with `git add <path>`, '
        + 'commit with `git commit -m <msg> <path>`, and branch with '
        + '`git worktree add -b <branch> <path>`.',
    );
  }
}
catch (error) {
  if (error instanceof PolicyDecisionError)
    process.exitCode = error.exitCode;
  else if (error instanceof SubprocessError)
    process.exitCode = error.exitCode
      ?? 1;
  else if (Error.isError(error,)) {
    console.error(error.message,);
    process.exitCode = 1;
  }
  else {
    throw error;
  }
}

//endregion Execution
