import nanoSpawn, { SubprocessError, } from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { autoPush, } from './auto-push.ts';
import { parseGlobalOptions, } from './parse-global-options.ts';
import { runManagementCommand, } from './management.ts';
import { parseCommitRegion, } from './parsers/commit.ts';
import { parsePushRegion, } from './parsers/push.ts';
import { COMMIT_TRANSACTION_NOT_APPLICABLE, } from './policy-engine/commit-transaction.ts';
import { runCommitTransactionBoundary, } from './policy-engine/commit-transaction-boundary.ts';
import {
  CommitTransactionRecoveryError,
  recoverCommitTransaction,
} from './policy-engine/commit-transaction-recovery.ts';
import { runPreForwardPolicyEngine, } from './policy-engine/pre-forward-engine.ts';
import { runPostCommitLifecycle, } from './policy-engine/post-commit-lifecycle.ts';
import {
  hasManualPushPolicy,
  runManualPushLifecycle,
} from './policy-engine/manual-push-lifecycle.ts';
import {
  createEngineFailureEvent,
  renderPolicyEvents,
} from './policy-engine/events.ts';
import { resolveGit, } from './resolve-git.ts';
import { TrustedConfigError, } from './trust/config-loader.ts';
import {
  resolveRuntimeConfig,
  RUNTIME_CONFIG_ABSENT,
} from './trust/runtime-config.ts';
import { hasExplicitStatusHintsOverride, } from './rules/status-hints-off.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Rule pipeline: validate and transform args before forwarding to real git

/**
 * Tagged logger for the main entry point.
 */
const rl = tagged({
  tag: 'main',
  l,
},);

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

//endregion Rule pipeline

//region Execution: resolve real git, apply rules, spawn

/**
 * Wrapper runtime-config resolution result.
 */
type WrapperRuntimeResolution =
  | Readonly<{ loaded: Awaited<ReturnType<typeof resolveRuntimeConfig>>; }>
  | Readonly<{ error: unknown; }>;

/**
 * Resolves trusted config while retaining failures for stable JSONL rendering.
 *
 * @param args - exact wrapper arguments
 *
 * @returns loaded config or captured failure
 */
async function resolveWrapperRuntime(args: readonly string[],): Promise<WrapperRuntimeResolution> {
  try {
    return { loaded: await resolveRuntimeConfig({ args, },), };
  }
  catch (error: unknown) {
    return { error, };
  }
}

/**
 * Expected non-zero policy decision after buffered events were emitted.
 */
class PolicyDecisionError extends Error {
  /**
   * Settled cli-git exit code.
   */
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

/**
 * Runs one direct cli-git invocation.
 *
 * Package root calls this function only when its single MJS artifact is Node's
 * direct program entry.
 *
 * @example
 * ```ts
 * await runCliGit();
 * ```
 */
export async function runCliGit(): Promise<void> {
  /**
   * Raw arguments passed after the script name.
   */
  const rawArgs: readonly string[] = process.argv
    .slice(2,);
  /**
   * Layout used to intercept namespaced management command before Git forwarding.
   */
  const managementLayout = parseGlobalOptions(rawArgs,);
  /**
   * Whether wrapper owns this invocation as a management command.
   */
  const isManagementCommand = rawArgs[managementLayout.subcommandIndex] === 'cli-git';

try {
  if (isManagementCommand) {
    /**
     * Real Git required for startup transaction recovery.
     */
    const gitPath = await resolveGit();
    await recoverCommitTransaction({
      args: rawArgs,
      gitPath,
    },);
    process.exitCode = await runManagementCommand({
      args: rawArgs.slice(managementLayout.subcommandIndex + 1,),
      gitGlobalArgs: rawArgs.slice(
        0,
        managementLayout.subcommandIndex,
      ),
    },);
  }
  else {
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
   * Absolute real Git path needed before repository config executes.
   */
  const gitPath = await resolveGit();
  if (!willShortCircuit)
    await recoverCommitTransaction({
      args: rawArgs,
      gitPath,
    },);
  /**
   * Trusted runtime config resolution after transaction recovery.
   */
  const runtimeResolution: WrapperRuntimeResolution = willShortCircuit
    ? { loaded: RUNTIME_CONFIG_ABSENT, }
    : await resolveWrapperRuntime(rawArgs,);
  if ('error' in runtimeResolution) {
    /**
     * Stable trust failure code.
     */
    const code = runtimeResolution.error instanceof TrustedConfigError
      ? runtimeResolution.error
        .code
      : 'trust-failed';
    process.stderr
      .write(renderPolicyEvents([createEngineFailureEvent({
      sequence: 0,
      code,
      message: Error.isError(runtimeResolution.error,)
        ? runtimeResolution.error
          .message
        : String(runtimeResolution.error,),
    },),],),);
    throw new PolicyDecisionError(2,);
  }

  rl.debug(`using real git at ${gitPath}`,);
  /**
   * Trusted policy options retained identically across convergence passes.
   */
  const policyOptions = runtimeResolution.loaded === RUNTIME_CONFIG_ABSENT
    ? {}
    : {
      config: { policies: runtimeResolution.loaded
        .validated
        .policySeverities, },
      registeredPolicies: runtimeResolution.loaded
        .validated
        .registeredPolicies,
      policyOptions: runtimeResolution.loaded
        .validated
        .policyOptions,
    };
  /**
   * Supported commit transaction, including final stable policy pass.
   */
  const commitTransaction = willShortCircuit
    ? COMMIT_TRANSACTION_NOT_APPLICABLE
    : await runCommitTransactionBoundary({
      args: rawArgs,
      gitPath,
      policyOptions,
    },);
  /**
   * Stable policy result before real Git forwarding.
   */
  const policyResult = willShortCircuit
    ? undefined
    : ((typeof commitTransaction) !== 'symbol'
      ? commitTransaction.policyResult
      : await runPreForwardPolicyEngine({
        options: {
          args: rawArgs,
          trigger: 'pre-forward',
          ...policyOptions,
        },
        gitPath,
      },));
  if (policyResult !== undefined) {
    /**
     * Stable wrapper JSONL emitted only after pass settles.
     */
    const renderedEvents = renderPolicyEvents(policyResult.events,);
    if (renderedEvents !== '')
      process.stderr
        .write(renderedEvents,);
    if (!policyResult.shouldForward) {
      if (policyResult.exitCode === 0)
        throw new TypeError('Non-forwarding policy result cannot use exit code 0.',);
      throw new PolicyDecisionError(policyResult.exitCode,);
    }
  }

  /**
   * Final arguments after staged policy execution and fixed transforms.
   */
  const processedArgs = policyResult?.args ?? rawArgs;

  if (willShortCircuit)
    rl.debug('pre-subcommand short-circuit flag present, skipping policy pipeline',);

  rl.debug(`final args: [${processedArgs.join(', ',)}]`,);

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
   * Whether trusted registry has enabled manual-push work.
   */
  const manualPushEnabled = runtimeResolution.loaded !== RUNTIME_CONFIG_ABSENT
    && hasManualPushPolicy({
      registeredPolicies: runtimeResolution.loaded.validated.registeredPolicies,
      policySeverities: runtimeResolution.loaded.validated.policySeverities,
    },);
  if ((subcommand === 'push') && manualPushEnabled
    && (runtimeResolution.loaded !== RUNTIME_CONFIG_ABSENT)
    && (!parsePushRegion(postSubcommand,).isDryRun)) {
    /** Settled manual-push gate before any remote update. */
    const manualPushResult = await runManualPushLifecycle({
      rawArgs,
      transformedArgs: processedArgs,
      gitPath,
      cwd: effectiveCwd,
      policySeverities: runtimeResolution.loaded.validated.policySeverities,
      registeredPolicies: runtimeResolution.loaded.validated.registeredPolicies,
      policyOptions: runtimeResolution.loaded.validated.policyOptions,
    },);
    /** Manual-push events use wrapper stderr routing. */
    const renderedManualPushEvents = renderPolicyEvents(manualPushResult.events,);
    if (renderedManualPushEvents !== '')
      process.stderr.write(renderedManualPushEvents,);
    if (!manualPushResult.shouldForward) {
      if (manualPushResult.exitCode === 0)
        throw new TypeError('Non-forwarding manual-push result cannot use exit code 0.',);
      throw new PolicyDecisionError(manualPushResult.exitCode,);
    }
  }
  /**
   * Whether private-index transaction already executed real Git.
   */
  const transactionCommitted = ((typeof commitTransaction) !== 'symbol')
    && commitTransaction.committed;
  if (!transactionCommitted)
    await nanoSpawn(
      gitPath,
      [...processedArgs,],
      { stdio: 'inherit', },
    );

  /**
   * True when a real commit just landed (the spawn above succeeded and this
   * was not a dry-run preview), so the new commit should be backed up.
   * Dry-run detection uses the parsed commit region, which covers
   * `--dry-run` plus the output-format flags git documents as implying it
   * (`--short`, `--porcelain`, `--long`, `-z`/`--null`) in any accepted
   * abbreviation. A failed commit throws out of the spawn above and never
   * reaches here.
   */
  const committed = transactionCommitted
    || ((subcommand === 'commit')
      && (!parseCommitRegion(postSubcommand,)
        .isDryRun));

  if (committed) {
    /**
     * Post-commit policy gate against landed commit ground truth.
     */
    const postCommitResult = await runPostCommitLifecycle({
      rawArgs,
      transformedArgs: processedArgs,
      gitPath,
      cwd: effectiveCwd,
      ...(runtimeResolution.loaded === RUNTIME_CONFIG_ABSENT
        ? {}
        : {
          policySeverities: runtimeResolution.loaded
            .validated
            .policySeverities,
          registeredPolicies: runtimeResolution.loaded
            .validated
            .registeredPolicies,
          policyOptions: runtimeResolution.loaded
            .validated
            .policyOptions,
        }),
    },);
    /**
     * Settled post-commit JSONL including explicit landed state when blocked.
     */
    const renderedPostCommitEvents = renderPolicyEvents(postCommitResult.events,);
    if (renderedPostCommitEvents !== '')
      process.stderr
        .write(renderedPostCommitEvents,);
    if (postCommitResult.blocked)
      throw new PolicyDecisionError(2,);
    await autoPush({
      gitPath,
      cwd: effectiveCwd,
    },);
  }

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
}
catch (error) {
  if (error instanceof CommitTransactionRecoveryError) {
    process.stderr
      .write(renderPolicyEvents([createEngineFailureEvent({
      sequence: 0,
      code: 'content-unavailable',
      message: error.message,
    },),],),);
    process.exitCode = 2;
  }
  else if (error instanceof PolicyDecisionError)
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
}

//endregion Execution
