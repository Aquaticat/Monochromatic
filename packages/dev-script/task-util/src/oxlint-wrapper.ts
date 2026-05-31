#!/usr/bin/env bun

/**
 * CLI wrapper for `oxlint` that augments diagnostic output.
 *
 * Runs `oxlint` with all provided arguments, captures the output,
 * augments diagnostics with enhanced guidance via {@link augmentOxlintOutput},
 * and preserves the original exit code.
 *
 * @example
 * ```bash
 * task-oxlint --type-aware
 * ```
 */

import spawn from 'nano-spawn';

import { augmentOxlintOutput, } from './oxlint-augment.ts';
import {
  filterOxlintOutput,
  shouldForceSuccess,
} from './oxlint-suppress.ts';

//region Main execution

/**
 * Thread count override from environment.
 *
 * When set, injects `--threads <value>` into the oxlint arguments.
 * oxlint ignores `RAYON_NUM_THREADS` because it always passes an explicit
 * count to rayon's `ThreadPoolBuilder`, so this env var is the only way
 * to control threads without modifying every call site.
 *
 * @example Set in a mise task env block:
 * ```toml
 * [tasks.lint.env]
 * OXLINT_THREADS = "1"
 * ```
 */
const threadOverride = process.env
  .OXLINT_THREADS;

/**
 * Whether the caller already passed an explicit output format flag.
 *
 * The wrapper pins `--format=default` so the suppression parser always receives
 * oxlint's stable graphical block reporter. oxlint's piped default reporter
 * varies by version: 1.67 emits a compact one-line format that the block parser
 * cannot classify, silently defeating suppression (the focusOutline false
 * positive then fails the lint). An explicit caller `--format`/`-f` must win, so
 * the pin is skipped when one is present.
 */
const hasExplicitFormat = process.argv
  .slice(2,)
  .some(function isFormatFlag(arg,) {
    return (arg === '--format')
      || (arg === '-f')
      || arg.startsWith('--format=',)
      || arg.startsWith('-f=',);
  },);

/**
 * Arguments forwarded to oxlint.
 */
const oxlintArgs = [
  ...(((threadOverride !== undefined) && (threadOverride !== ''))
    ? [
      '--threads',
      threadOverride,
    ]
    : []),
  ...(hasExplicitFormat ? [] : ['--format=default',]),
  ...process.argv
    .slice(2,),
];

try {
  /**
   * Captured oxlint subprocess result; stdout is augmented with extra guidance before being forwarded.
   */
  const result = await spawn(
    'oxlint',
    [...oxlintArgs,],
  );

  // oxlint succeeded (exit 0, no diagnostics): pass output through
  if (result.stdout
    .length
    > 0)
    process.stdout
      .write(augmentOxlintOutput(result.stdout,),);
  if (result.stderr
    .length
    > 0)
    process.stderr
      .write(result.stderr,);
}
catch (error) {
  if ((error !== null) && ((typeof error) === 'object')
    && ('exitCode' in error)) {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- 'exitCode' in check above narrows error to the captured-subprocess shape */
    /**
     * Re-typed thrown error so its captured stdout, stderr, and exit fields can be augmented and forwarded.
     */
    const subprocessError = error as {
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      signalName?: string;
    };
    /* oxlint-enable typescript/no-unsafe-type-assertion */

    /**
     * oxlint diagnostics with known false-positive blocks dropped and the summary recomputed.
     */
    const suppressed = filterOxlintOutput({
      output: subprocessError.stdout
        ?? '',
    },);

    /**
     * oxlint diagnostics with the wrapper's extra guidance appended, ready for the parent stdout.
     */
    const augmentedStdout = augmentOxlintOutput(suppressed.filtered,);

    if (augmentedStdout.length
      > 0) {
      process.stdout
        .write(augmentedStdout,);
      if (!augmentedStdout.endsWith('\n',))
        process.stdout
          .write('\n',);
    }

    if ((subprocessError.stderr
      ?? '').length
      > 0) {
      process.stderr
        .write(subprocessError.stderr
          ?? '',);
      if (!(subprocessError.stderr
        ?? '').endsWith('\n',))
        process.stderr
          .write('\n',);
    }

    /**
     * Total blocks dropped this run; zero means the filter changed nothing, so oxlint's failure stands.
     */
    const totalSuppressed = suppressed.suppressedWarnings
      + suppressed.suppressedErrors;
    /**
     * oxlint's reported exit code; absent (e.g. signal termination) never qualifies as a forced success.
     */
    const { exitCode, } = subprocessError;
    /**
     * Whether to convert oxlint's non-zero exit into success.
     *
     * True only when the failure was caused solely by suppressed diagnostics:
     * something was dropped, nothing real survived, oxlint used its ordinary
     * diagnostics exit code, and stderr was empty. A config error or panic that
     * coincides with a suppressible block (non-1 exit or stderr text) keeps
     * oxlint's failure, so a real fault is never hidden by a suppression.
     */
    const forceSuccess = (exitCode !== undefined)
      && shouldForceSuccess({
        hasRemainingDiagnostics: suppressed.hasRemainingDiagnostics,
        totalSuppressed,
        exitCode,
        stderr: subprocessError.stderr
          ?? '',
      },);
    if (!forceSuccess) {
      process.exitCode = exitCode
        ?? 1;
    }

    if ((subprocessError.signalName
      !== undefined)
      && (subprocessError.signalName
        !== ''))
    {
      console.error(
        `[task-oxlint] oxlint terminated by signal: ${subprocessError.signalName}`,
      );
      process.exitCode = 1;
    }
  }
  else {
    console.error(
      `[task-oxlint] failed to execute oxlint: ${
        error instanceof Error ? error.message : String(error,)
      }`,
    );
    process.exitCode = 1;
  }
}

//endregion Main execution
