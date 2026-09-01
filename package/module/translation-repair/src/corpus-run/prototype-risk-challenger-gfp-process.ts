// PROTOTYPE ONLY: Child-process evidence for Candidate M guard-failure proofs.

import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';

/**
 * Bytes in one mebibyte.
 */
// oxlint-disable-next-line no-magic-numbers -- Binary unit definition requires exact 1,024-byte factors.
const MEBIBYTE_BYTES = 1_024 * 1_024;
/**
 * Exact command-output buffer ceiling.
 */
// oxlint-disable-next-line no-magic-numbers -- 64 MiB prevents child output from reaching Node's smaller default cap.
const COMMAND_BUFFER_BYTES = 64 * MEBIBYTE_BYTES;
/**
 * Promise-based child-process launcher.
 *
 * @example
 * ```ts
 * await execFileAsync('git', ['--version']);
 * ```
 */
// oxlint-disable-next-line typescript/strict-void-return -- promisify intentionally ignores ChildProcess while adapting callback completion
const execFileAsync = promisify(execFile,);
/**
 * Package build task used after every mutation.
 */
const BUILD_TASK = '//package/module/translation-repair:build:js:node';
/**
 * Package targeted-test task used after every successful rebuild.
 */
const TEST_TASK = '//package/module/translation-repair:test:unit';
/**
 * Candidate M test file imported from rebuilt artifact.
 */
const TEST_FILE = 'src/prototype-risk-challenger.unit.test.ts';

/**
 * Privacy-safe child-process termination metadata.
 *
 * @example
 * ```ts
 * const outcome: CandidateMGfpCommandOutcome = { kind: 'exited', status: 0, };
 * ```
 */
export type CandidateMGfpCommandOutcome =
  | {
    /**
     * Normal process exit.
     */
    readonly kind: 'exited';
    /**
     * Numeric normal exit status.
     */
    readonly status: number;
  }
  | {
    /**
     * Process interrupted by signal.
     */
    readonly kind: 'signaled';
    /**
     * Exact signal identity.
     */
    readonly signal: string;
  }
  | {
    /**
     * Executable could not be launched.
     */
    readonly kind: 'launch-failed';
    /**
     * Error class without message or command output.
     */
    readonly errorName: string;
  };

/**
 * Rebuild and targeted-test outcomes for one fixture state.
 *
 * @example
 * ```ts
 * const gate: CandidateMGfpGate = { build: outcome, test: outcome, };
 * ```
 */
export type CandidateMGfpGate = {
  /**
   * Required rebuilt-artifact gate.
   */
  readonly build: CandidateMGfpCommandOutcome;
  /**
   * Targeted test, absent when rebuild does not complete successfully.
   */
  readonly test?: CandidateMGfpCommandOutcome;
};

/**
 * Whether child completed through numeric exit rather than interruption.
 *
 * @param outcome - Privacy-safe command termination metadata
 *
 * @returns Whether status is a normal numeric exit
 *
 * @example
 * ```ts
 * const completed = candidateMGfpCompletedNormally(outcome,);
 * ```
 */
export function candidateMGfpCompletedNormally(
  outcome: CandidateMGfpCommandOutcome,
): outcome is Extract<CandidateMGfpCommandOutcome, { readonly kind: 'exited' }> {
  return outcome.kind === 'exited';
}

/**
 * Classifies successful guard detection phase without crediting interruption.
 *
 * @param gate - Rebuild and targeted-test outcomes
 *
 * @returns Exact detection phase or explicit absence
 *
 * @example
 * ```ts
 * const phase = candidateMGfpDetectionPhase(gate,);
 * ```
 */
export function candidateMGfpDetectionPhase(
  gate: CandidateMGfpGate,
): 'build' | 'targeted-test' | 'none' {
  if ((gate.build
    .kind
    === 'exited') && (gate.build
      .status
      !== 0))
    return 'build';
  if ((gate.test
    ?.kind
    === 'exited') && (gate.test
      .status
      !== 0))
    return 'targeted-test';
  return 'none';
}

/**
 * Converts unknown child failure into metadata without message or payload text.
 *
 * @param error - Unknown child-process rejection
 *
 * @returns Privacy-safe termination metadata
 */
function commandFailure(error: unknown,): CandidateMGfpCommandOutcome {
  if (!Error.isError(error,)) {
    return {
      kind: 'launch-failed',
      errorName: 'UnknownThrownValue',
    };
  }
  /**
   * Numeric exit code when child reached normal process termination.
   */
  const status = ('code' in error) && ((typeof error.code) === 'number')
    ? error.code
    : null;
  /**
   * Signal identity when child was interrupted.
   */
  const signal = ('signal' in error) && ((typeof error.signal) === 'string')
    ? error.signal
    : null;
  if (status !== null)
    return {
      kind: 'exited',
      status,
    };
  if (signal !== null)
    return {
      kind: 'signaled',
      signal,
    };
  return {
    kind: 'launch-failed',
    errorName: error.constructor
      .name,
  };
}

/**
 * Runs one bounded command while retaining termination metadata only.
 *
 * @param command - Executable name
 *
 * @param arguments_ - Exact argument vector
 *
 * @param cwd - Explicit working directory
 *
 * @param environment - Optional child-only environment override
 *
 * @returns Privacy-safe normal or failed termination metadata
 *
 * @example
 * ```ts
 * const outcome = await runCandidateMGfpCommand({ command: 'git', arguments_: ['--version'], cwd });
 * ```
 */
export async function runCandidateMGfpCommand({
  command,
  arguments_,
  cwd,
  environment,
}: {
  readonly command: string;
  readonly arguments_: readonly string[];
  readonly cwd: string;
  readonly environment?: NodeJS.ProcessEnv;
}): Promise<CandidateMGfpCommandOutcome> {
  try {
    await execFileAsync(
      command,
      arguments_,
      {
        cwd,
        maxBuffer: COMMAND_BUFFER_BYTES,
        ...(environment === undefined ? {} : { env: environment, }),
      },
    );
    return {
      kind: 'exited',
      status: 0,
    };
  }
  catch (error) {
    return commandFailure(error,);
  }
}

/**
 * Rebuilds Candidate M then runs its targeted test from disposable worktree.
 *
 * @param fixtureRoot - Detached disposable worktree root
 *
 * @returns Exact normal, failed, or interrupted gate outcomes
 *
 * @example
 * ```ts
 * const gate = await runCandidateMGfpGate(fixture.root,);
 * ```
 */
export async function runCandidateMGfpGate(
  fixtureRoot: string,
): Promise<CandidateMGfpGate> {
  /**
   * Process-scoped trust for disposable copy of already trusted repository.
   */
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    MISE_TRUSTED_CONFIG_PATHS: fixtureRoot,
  };
  /**
   * Rebuilt-artifact command outcome.
   */
  const build = await runCandidateMGfpCommand({
    command: 'mise',
    arguments_: [
      'run',
      BUILD_TASK,
    ],
    cwd: fixtureRoot,
    environment,
  },);
  if ((build.kind !== 'exited') || (build.status !== 0))
    return { build, };
  return {
    build,
    test: await runCandidateMGfpCommand({
      command: 'mise',
      arguments_: [
        'run',
        TEST_TASK,
        '--',
        TEST_FILE,
      ],
      cwd: fixtureRoot,
      environment,
    },),
  };
}
