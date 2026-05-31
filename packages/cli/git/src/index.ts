#!/usr/bin/env bun
import nanoSpawn, { SubprocessError, } from 'nano-spawn';

import {
  l,
  tagged,
} from './log.ts';
import { parseGlobalOptions, } from './parse-global-options.ts';
import { resolveGit, } from './resolve-git.ts';
import { addExplicit, } from './rules/add-explicit.ts';
import { atomicPush, } from './rules/atomic-push.ts';
import { commitOnly, } from './rules/commit-only.ts';
import { linkedWorktreeOnly, } from './rules/linked-worktree-only.ts';
import { requireRoot, } from './rules/require-root.ts';
import {
  hasExplicitStatusHintsOverride,
  statusHintsOff,
} from './rules/status-hints-off.ts';

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
 * Order matters: root check runs first (fail fast), linked-worktree-only
 * enforcement catches guarded state-changing worktree forms, then arg transforms
 * run.
 */
const RULES: readonly ((
  args: readonly string[],
) => readonly string[] | Promise<readonly string[]>)[] = [
  requireRoot,
  linkedWorktreeOnly,
  addExplicit,
  atomicPush,
  commitOnly,
  statusHintsOff,
];

//endregion Rule pipeline

//region Execution: resolve real git, apply rules, spawn

try {
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
      Promise.resolve(rawArgs,),
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
   * Layout of `processedArgs`: where the subcommand sits and what precedes it.
   */
  const { subcommandIndex, } = parseGlobalOptions(processedArgs,);
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
      'cli-git wrapper (require-root, linked-worktree-only, add-explicit, atomic-push, commit-only, status-hints-off)',
    );
  }
  else if (shouldPrintStatusNote) {
    console.log(
      'cli-git: bulk-add patterns (`.`, `*`, `-A`, `-u`) and `git commit -a` are rejected; '
        + 'stage with `git add <path>` and commit with `git commit -m <msg> <path>`.',
    );
  }
}
catch (error) {
  if (error instanceof SubprocessError)
    process.exitCode = error.exitCode
      ?? 1;
  else if (error instanceof Error) {
    console.error(error.message,);
    process.exitCode = 1;
  }
  else {
    throw error;
  }
}

//endregion Execution
