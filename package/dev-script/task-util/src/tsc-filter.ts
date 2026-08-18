#!/usr/bin/env node

/**
 * Wrapper for `tsc` that filters out diagnostics from known false-positive sources.
 *
 * Suppressed sources:
 * - `node_modules`: JSR packages ship `.ts` source files instead of `.d.ts` declarations.
 *   TypeScript's resolver prefers `.ts` siblings over `.js` exports,
 *   and `skipLibCheck` only covers `.d.ts` files.
 *   This causes `tsc --build` to type-check JSR package source
 *   under the consumer's tsconfig, producing false positives.
 * - Auto-generated typesafe-i18n files (`i18n/i18n-*.ts`): these violate
 *   `--isolatedDeclarations` and carry "manual changes will be overwritten" headers.
 *
 * This wrapper:
 * 1. Runs `tsc` with all provided arguments (defaults to `--build` if none given)
 * 2. Captures stdout/stderr
 * 3. Drops diagnostic lines from suppressed sources
 * 4. Drops continuation lines (indented lines following a dropped diagnostic)
 * 5. Exits non-zero only if non-suppressed errors remain
 *
 * See `doc/troubleshooting/typescript.md` section
 * "JSR packages ship `.ts` source files that `skipLibCheck` cannot skip"
 * for full root cause analysis.
 *
 * @example
 * ```bash
 * task-tsc --build
 * task-tsc --build --noEmit
 * task-tsc --noEmit -p tsconfig.json
 * ```
 */

import {
  glob,
  unlink,
} from 'node:fs/promises';

import spawn from 'nano-spawn';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import {
  buildTscArgs,
  SINGLE_THREADED_ENV,
} from './tsc-args.ts';

//region Incremental cache cleanup

/**
 * Glob patterns for TypeScript incremental caches that `task-tsc` refreshes before each run.
 */
const BUILD_INFO_GLOBS = [
  'dist/**/*.tsbuildinfo',
  '.cache/typescript/**/*.tsbuildinfo',
] as const;

/**
 * Removes all `.tsbuildinfo` files emitted by TypeScript in the current working directory.
 *
 * `composite: true` implies `incremental: true`, which produces `.tsbuildinfo` caches.
 * tsc's `--build` mode has a cache invalidation bug (#2666) where stale `.tsbuildinfo`
 * files cause false negatives after dependency updates. Deleting them before each build
 * forces a clean check while preserving all other `composite` benefits
 * (rootDir defaulting, include enforcement, declaration defaulting).
 *
 * The root tsconfig redirects build metadata to `.cache/typescript/root.tsbuildinfo`
 * so root type checks do not create an ignored `dist/` directory just to hold metadata.
 *
 * @example
 * ```ts
 * await removeStaleBuildInfo();
 * // All configured build-info cache files in cwd are now deleted
 * ```
 */
async function removeStaleBuildInfo(): Promise<void> {
  /**
   * Buffered tsbuildinfo paths collected from every configured async glob; unlinked concurrently below.
   */
  const entries = (await Promise.all(
    BUILD_INFO_GLOBS.map(function collectBuildInfo(pattern,): Promise<string[]> {
      return Array.fromAsync(glob(pattern,),);
    },),
  ))
    .flat();
  await Promise.all(entries.map(function unlinkEntry(entry,) {
    return unlink(entry,);
  },),);
}

//endregion Incremental cache cleanup

//region Diagnostic line detection

/**
 * Literal text that opens the error code on every tsc diagnostic line.
 */
const ERROR_CODE_TOKEN = '): error TS';

/**
 * Walks the run of ASCII digits in `s` starting at `from`.
 *
 * @param s - input string
 *
 * @param from - cursor into `s`
 *
 * @returns exclusive end of the digit run
 */
function endOfDigitRun({
  s,
  from,
}: {
  readonly s: string;
  readonly from: number;
},): number {
  return (function walk(): number {
    /**
     * Cursor advanced across the ASCII digit run; stops at the first non-digit or the end of `s`.
     */
    let idx = from;
    while (idx < s
      .length) {
      /**
       * Char at the cursor; only ASCII digits advance the run.
       */
      const c = s.charAt(idx,);
      if ((c < '0') || (c > '9'))
        break;
      idx += 1;
    }
    return idx;
  })();
}

/**
 * Tests whether a line is a tsc diagnostic line.
 *
 * Mirrors `/\(\d+,\d+\): error TS\d+:/` with a linear `indexOf` walk:
 * locate `): error TS`, then require digit runs (via {@link endOfDigitRun}
 * for the trailing run) flanking the surrounding `(<digits>,<digits>)`
 * prefix and a trailing `<digits>:`.
 *
 * @param line - single line of tsc output
 *
 * @returns true when the line matches the diagnostic format
 *
 * @example
 * ```ts
 * isDiagnosticLine('src/index.ts(1,1): error TS2304: Cannot find name.');
 * // true
 * isDiagnosticLine('  Type "string" is not assignable to type "number".');
 * // false
 * ```
 *
 * @internal
 */
export function isDiagnosticLine(line: string,): boolean {
  /**
   * Walks digits backwards from `pos - 1` to locate the inclusive start of
   * a run, in a single linear pass.
   *
   * @param pos - cursor (one past the last digit so far)
   *
   * @returns inclusive start of the digit run (clamped at 0)
   */
  function startOfDigitsBackwards(pos: number,): number {
    return (function walk(): number {
      if (pos <= 0)
        return 0;
      /**
       * Cursor walked left across the ASCII digit run; the loop guard keeps it at or above 0.
       */
      let p = pos;
      while (p > 0) {
        /**
         * Char just left of the cursor; a non-digit ends the back-walk.
         */
        const c = line.charAt(p - 1,);
        if ((c < '0') || (c > '9'))
          break;
        p -= 1;
      }
      return p;
    })();
  }

  // Single linear walk over each `ERROR_CODE_TOKEN` occurrence; `from` advances
  // monotonically past every rejected candidate, so no prefix is ever rescanned.
  for (let from = 0;;) {
    /**
     * Position of the literal error-code token; `-1` ends the search.
     */
    const codeIdx = line.indexOf(
      ERROR_CODE_TOKEN,
      from,
    );
    if (codeIdx === (-1))
      return false;
    /**
     * Exclusive end of the trailing digit run; must be followed by `:` to match.
     */
    const codeEnd = endOfDigitRun({
      s: line,
      from: codeIdx + ERROR_CODE_TOKEN
        .length,
    },);
    if ((codeEnd === (codeIdx + ERROR_CODE_TOKEN
      .length))
      || (line.charAt(codeEnd,)
        !== ':'))
    {
      from = codeIdx + 1;
      continue;
    }
    /**
     * Exclusive end of the digits in `<col>` (between the `,` and `): error TS`).
     */
    const colEnd = codeIdx;
    /**
     * Inclusive start of the column digit run; comma boundary must sit just before.
     */
    const colStart = startOfDigitsBackwards(colEnd,);
    if ((colStart === colEnd) || (line.charAt(colStart - 1,)
      !== ',')) {
      from = codeIdx + 1;
      continue;
    }
    /**
     * Inclusive start of the line digit run; opening `(` must sit just before.
     */
    const lineStart = startOfDigitsBackwards(colStart - 1,);
    if ((lineStart === (colStart - 1)) || (line.charAt(lineStart - 1,)
      !== '(')) {
      from = codeIdx + 1;
      continue;
    }
    return true;
  }
}

/**
 * Tests whether a diagnostic line originates from a `node_modules` path.
 *
 * @param line - single diagnostic line of tsc output
 *
 * @returns true when the file path portion contains `/node_modules/`
 *
 * @example
 * ```ts
 * isNodeModulesDiagnostic('node_modules/.bun/\@jsr+zod__zod\@4.3.6/src/index.ts(1,1): error TS2532: Object is possibly undefined.');
 * // true
 * isNodeModulesDiagnostic('src/index.ts(1,1): error TS2304: Cannot find name.');
 * // false
 * ```
 *
 * @internal
 */
export function isNodeModulesDiagnostic(line: string,): boolean {
  return line.includes('node_modules/',)
    || line
    .includes('node_modules\\',);
}

/**
 * Tests whether a diagnostic line originates from auto-generated i18n files.
 *
 * typesafe-i18n generates `i18n-types.ts`, `i18n-util.ts`, and `i18n-util.async.ts`
 * with patterns that violate `--isolatedDeclarations`. These files carry
 * "Any manual changes will be overwritten" headers, so fixing them is futile.
 *
 * @param line - single diagnostic line of tsc output
 *
 * @returns true when the file path matches an auto-generated i18n file
 *
 * @example
 * ```ts
 * isI18nGeneratedDiagnostic('src/i18n/i18n-types.ts(4,7): error TS9010: ...');
 * // true
 * isI18nGeneratedDiagnostic('src/i18n/en/index.ts(4,7): error TS9010: ...');
 * // false
 * ```
 */
export function isI18nGeneratedDiagnostic(line: string,): boolean {
  // oxlint-disable eslint-plugin-unicorn/prefer-string-raw -- String.raw template literals cannot end with `\` (the trailing backtick is consumed as an escape target); plain '\\' string escapes are the only option for these path separators.
  return line.includes('/i18n/',)
    || line
    .includes('/i18n\\',)
    || line
    .includes('\\i18n/',)
    || line
    .includes('\\i18n\\',);
  // oxlint-enable eslint-plugin-unicorn/prefer-string-raw
}

/**
 * Tests whether a diagnostic line should be suppressed.
 *
 * Suppresses diagnostics from `node_modules` (per {@link isNodeModulesDiagnostic};
 * JSR `.ts` source leaking through `skipLibCheck`) and auto-generated typesafe-i18n
 * files (per {@link isI18nGeneratedDiagnostic}; these violate `--isolatedDeclarations`
 * and cannot be manually fixed).
 *
 * @param line - single diagnostic line of tsc output
 *
 * @returns true when the diagnostic should be filtered out
 *
 * @example
 * ```ts
 * isSuppressedDiagnostic('node_modules/.bun/zod/src/index.ts(1,1): error TS2532: ...');
 * // true
 * isSuppressedDiagnostic('src/i18n/i18n-util.ts(24,14): error TS9010: ...');
 * // true
 * isSuppressedDiagnostic('src/app.ts(5,3): error TS2304: ...');
 * // false
 * ```
 */
export function isSuppressedDiagnostic(line: string,): boolean {
  return isNodeModulesDiagnostic(line,)
    || isI18nGeneratedDiagnostic(line,);
}

/**
 * Tests whether a line is a continuation of a previous diagnostic.
 *
 * Continuation lines start with whitespace and carry indented context
 * for the preceding diagnostic (e.g. type mismatch details).
 *
 * @param line - single line of tsc output
 *
 * @returns true when the line starts with whitespace
 *
 * @example
 * ```ts
 * isContinuationLine('  Type "string" is not assignable to type "number".');
 * // true
 * isContinuationLine('src/index.ts(1,1): error TS2304: Cannot find name.');
 * // false
 * ```
 *
 * @internal
 */
export function isContinuationLine(line: string,): boolean {
  return (line.length
    > 0) && (line.startsWith(' ',)
      || line
      .startsWith('\t',));
}

//endregion Diagnostic line detection

//region Output filtering

/**
 * Filters tsc output to remove suppressed diagnostics.
 *
 * Suppressed sources: `node_modules` (JSR `.ts` leaking through `skipLibCheck`)
 * and auto-generated typesafe-i18n files (`i18n-types.ts`, `i18n-util.ts`, etc.).
 * Classifies each line with {@link isDiagnosticLine} and {@link isSuppressedDiagnostic},
 * and removes both the diagnostic line itself and any {@link isContinuationLine}
 * continuation lines that follow it (indented lines providing additional type
 * error context).
 *
 * @param output - raw tsc stdout or stderr content
 *
 * @returns object with filtered output and whether any non-suppressed errors remain
 *
 * @example
 * ```ts
 * const result = filterTscOutput([
 *   'node_modules/.bun/zod/src/index.ts(1,1): error TS2532: Object is possibly undefined.',
 *   '  Type "string" is not assignable.',
 *   'src/i18n/i18n-util.ts(24,14): error TS9010: Variable must have an explicit type annotation.',
 *   'src/app.ts(5,3): error TS2304: Cannot find name "foo".',
 * ].join('\n'));
 * // result.filtered === 'src/app.ts(5,3): error TS2304: Cannot find name "foo".'
 * // result.hasRemainingErrors === true
 * ```
 *
 * @internal
 */
export function filterTscOutput(output: string,): {
  readonly filtered: string;
  readonly hasRemainingErrors: boolean;
} {
  if (output.length
    === 0) {
    return {
      filtered: '',
      hasRemainingErrors: false,
    };
  }

  /**
   * Source output split per line so each diagnostic header and continuation can be classified independently.
   */
  const lines = output.split('\n',);
  /**
   * Lines retained after filtering; rejoined with `\n` to reconstruct the output stream.
   */
  const kept: string[] = [];
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- multi-statement state machine: droppingContinuation and hasRemainingErrors are mutated by four branches across loop iterations, with side effects on `kept`. */
  /**
   * True while the loop is inside a suppressed diagnostic block, so its continuation lines are also dropped.
   */
  let droppingContinuation = false;
  /**
   * True once any non-suppressed diagnostic is retained; the caller uses it to decide the wrapper's exit code.
   */
  let hasRemainingErrors = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for (const line of lines) {
    if (isDiagnosticLine(line,)) {
      if (isSuppressedDiagnostic(line,)) {
        // Drop this diagnostic and mark that following continuation lines should be dropped
        droppingContinuation = true;
      }
      else {
        // Keep this diagnostic
        droppingContinuation = false;
        hasRemainingErrors = true;
        kept.push(line,);
      }
    }
    else if (isContinuationLine(line,)
      && droppingContinuation) {
      // Drop continuation of a node_modules diagnostic
    }
    else {
      // Non-diagnostic, non-continuation line (e.g. summary, blank line)
      droppingContinuation = false;
      kept.push(line,);
    }
  }

  return {
    filtered: kept.join('\n',),
    hasRemainingErrors,
  };
}

//endregion Output filtering

//region Main execution

/**
 * Runs the `task-tsc` command-line wrapper.
 *
 * Clears stale incremental caches via {@link removeStaleBuildInfo}, runs `tsc`,
 * and on failure filters the captured output through {@link filterTscOutput}
 * before deciding the exit code.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Raw single-threaded env request inherited from root mise fanout, when present.
   */
  const singleThreadedEnv = process.env[SINGLE_THREADED_ENV];

  /**
   * Arguments forwarded to tsc, with wrapper defaults and root-fanout controls applied.
   */
  const tscArgs = buildTscArgs({
    cliArgs: process.argv
      .slice(2,),
    ...((singleThreadedEnv === undefined)
      ? {}
      : { singleThreadedEnv, }),
  },);

  // tsc #2666: stale .tsbuildinfo causes false negatives; clean before each build
  await removeStaleBuildInfo();

  try {
    /**
     * Successful spawn result; stdout/stderr are forwarded unfiltered when tsc exits 0.
     */
    const result = await spawn(
      'tsc',
      [...tscArgs,],
    );

    // tsc succeeded (exit 0): pass output through unfiltered
    if (result.stdout
      .length
      > 0)
      process.stdout
        .write(result.stdout,);
    if (result.stderr
      .length
      > 0)
      process.stderr
        .write(result.stderr,);
  }
  catch (error) {
    if (
      (error !== null)
      && ((typeof error) === 'object')
        && ('exitCode' in error)
    ) {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- 'exitCode' in check above narrows to subprocess shape */
      /**
       * Subprocess failure narrowed to the shape exposed by the bun/node spawn libraries; carries the streams to filter.
       */
      const subprocessError = error as {
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        signalName?: string;
      };
      /* oxlint-enable typescript/no-unsafe-type-assertion */

      /**
       * Filtered stdout payload with low-value tsc diagnostics suppressed; written below when non-empty.
       */
      // Filter stdout (where tsc writes diagnostics)
      const stdoutResult = filterTscOutput(subprocessError.stdout
        ?? '',);
      /**
       * Filtered stderr payload with low-value tsc diagnostics suppressed; written below when non-empty.
       */
      // Filter stderr as well in case tsc writes diagnostics there
      const stderrResult = filterTscOutput(subprocessError.stderr
        ?? '',);

      if (stdoutResult.filtered
        .length
        > 0) {
        process.stdout
          .write(stdoutResult.filtered,);
        // Ensure trailing newline for clean terminal output
        if (!stdoutResult.filtered
          .endsWith('\n',))
          process.stdout
            .write('\n',);
      }

      if (stderrResult.filtered
        .length
        > 0) {
        process.stderr
          .write(stderrResult.filtered,);
        if (!stderrResult.filtered
          .endsWith('\n',))
          process.stderr
            .write('\n',);
      }

      // Exit non-zero only if non-suppressed errors remain
      if (stdoutResult.hasRemainingErrors
        || stderrResult
        .hasRemainingErrors)
        process.exitCode = subprocessError.exitCode
          ?? 1;

      if ((subprocessError.signalName
        !== undefined)
        && (subprocessError.signalName
          !== ''))
      {
        console.error(
          `[task-tsc] tsc terminated by signal: ${subprocessError.signalName}`,
        );
        process.exitCode = 1;
      }
    }
    else {
      // Non-subprocess error (e.g. tsc not found)
      console.error(
        `[task-tsc] failed to execute tsc: ${
          caughtValueText(error,)
        }`,
      );
      process.exitCode = 1;
    }
  }
}

if (import.meta.main)
  await main();

//endregion Main execution
