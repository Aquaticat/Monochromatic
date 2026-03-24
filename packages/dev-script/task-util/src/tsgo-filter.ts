#!/usr/bin/env bun

/**
 * Wrapper for `tsgo` that filters out diagnostics originating from `node_modules`.
 *
 * JSR packages ship `.ts` source files instead of `.d.ts` declarations.
 * TypeScript's resolver prefers `.ts` siblings over `.js` exports,
 * and `skipLibCheck` only covers `.d.ts` files.
 * This causes `tsgo --build` to type-check JSR package source
 * under the consumer's tsconfig, producing false positives.
 *
 * This wrapper:
 * 1. Runs `tsgo` with all provided arguments (defaults to `--build` if none given)
 * 2. Captures stdout/stderr
 * 3. Drops diagnostic lines whose file path contains `/node_modules/`
 * 4. Drops continuation lines (indented lines following a dropped diagnostic)
 * 5. Exits non-zero only if non-`node_modules` errors remain
 *
 * See `TROUBLESHOOTING.typescript.md` section
 * "JSR packages ship `.ts` source files that `skipLibCheck` cannot skip"
 * for full root cause analysis.
 *
 * @example
 * ```bash
 * task-tsgo --build
 * task-tsgo --build --noEmit
 * task-tsgo --noEmit -p tsconfig.json
 * ```
 */

import {
  glob,
  unlink,
} from 'node:fs/promises';

import spawn from 'nano-spawn';

//region Incremental cache cleanup

/**
 * Removes all `.tsbuildinfo` files under `dist/` in the current working directory.
 *
 * `composite: true` implies `incremental: true`, which produces `.tsbuildinfo` caches.
 * tsgo's `--build` mode has a cache invalidation bug (#2666) where stale `.tsbuildinfo`
 * files cause false negatives after dependency updates. Deleting them before each build
 * forces a clean check while preserving all other `composite` benefits
 * (rootDir defaulting, include enforcement, declaration defaulting).
 *
 * @example
 * ```ts
 * await removeStaleBuildInfo();
 * // All dist/**\/*.tsbuildinfo files in cwd are now deleted
 * ```
 */
async function removeStaleBuildInfo(): Promise<void> {
  const entries: string[] = [];
  for await (const entry of glob('dist/**/*.tsbuildinfo',))
    entries.push(entry,);
  await Promise.all(entries.map(function unlinkEntry(entry,) {
    return unlink(entry,);
  },),);
}

//endregion Incremental cache cleanup

//region Diagnostic line detection

/**
 * Pattern matching tsgo diagnostic lines.
 *
 * Diagnostics follow the format:
 * `path/to/file.ts(line,col): error TS1234: message`
 *
 * @example
 * ```ts
 * DIAGNOSTIC_PATTERN.test('src/index.ts(1,1): error TS2304: Cannot find name.');
 * // true
 * ```
 */
const DIAGNOSTIC_PATTERN = /\(\d+,\d+\): error TS\d+:/;

/**
 * Tests whether a line is a tsgo diagnostic line.
 *
 * @param line - single line of tsgo output
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
 */
export function isDiagnosticLine(line: string,): boolean {
  return DIAGNOSTIC_PATTERN.test(line,);
}

/**
 * Tests whether a diagnostic line originates from a `node_modules` path.
 *
 * @param line - single diagnostic line of tsgo output
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
 */
export function isNodeModulesDiagnostic(line: string,): boolean {
  return line.includes('node_modules/',) || line.includes('node_modules\\',);
}

/**
 * Tests whether a line is a continuation of a previous diagnostic.
 *
 * Continuation lines start with whitespace and carry indented context
 * for the preceding diagnostic (e.g. type mismatch details).
 *
 * @param line - single line of tsgo output
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
 */
export function isContinuationLine(line: string,): boolean {
  return line.length > 0 && (line[0] === ' ' || line[0] === '\t');
}

//endregion Diagnostic line detection

//region Output filtering

/**
 * Filters tsgo output to remove diagnostics originating from `node_modules`.
 *
 * Removes both the diagnostic line itself and any continuation lines
 * that follow it (indented lines providing additional type error context).
 *
 * @param output - raw tsgo stdout or stderr content
 *
 * @returns object with filtered output and whether any non-`node_modules` errors remain
 *
 * @example
 * ```ts
 * const result = filterTsgoOutput([
 *   'node_modules/.bun/zod/src/index.ts(1,1): error TS2532: Object is possibly undefined.',
 *   '  Type "string" is not assignable.',
 *   'src/app.ts(5,3): error TS2304: Cannot find name "foo".',
 * ].join('\n'));
 * // result.filtered === 'src/app.ts(5,3): error TS2304: Cannot find name "foo".'
 * // result.hasRemainingErrors === true
 * ```
 */
export function filterTsgoOutput(output: string,): {
  readonly filtered: string;
  readonly hasRemainingErrors: boolean;
} {
  if (output.length === 0)
    return { filtered: '', hasRemainingErrors: false, };

  const lines = output.split('\n',);
  const kept: string[] = [];
  let droppingContinuation = false;
  let hasRemainingErrors = false;

  for (const line of lines) {
    if (isDiagnosticLine(line,)) {
      if (isNodeModulesDiagnostic(line,)) {
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
    else if (isContinuationLine(line,) && droppingContinuation) {
      // Drop continuation of a node_modules diagnostic
    }
    else {
      // Non-diagnostic, non-continuation line (e.g. summary, blank line)
      droppingContinuation = false;
      kept.push(line,);
    }
  }

  return { filtered: kept.join('\n',), hasRemainingErrors, };
}

//endregion Output filtering

//region Main execution

/** Arguments forwarded to tsgo, defaulting to `--build` when none are provided */
const tsgoArgs = process.argv.length > 2
  ? process.argv.slice(2,)
  : ['--build',];

// tsgo #2666 — stale .tsbuildinfo causes false negatives; clean before each build
await removeStaleBuildInfo();

try {
  const result = await spawn('tsgo', [...tsgoArgs,],);

  // tsgo succeeded (exit 0) -- pass output through unfiltered
  if (result.stdout.length > 0)
    process.stdout.write(result.stdout,);
  if (result.stderr.length > 0)
    process.stderr.write(result.stderr,);
}
catch (error) {
  if (error !== null && typeof error === 'object' && 'exitCode' in error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 'exitCode' in check above narrows to subprocess shape
    const subprocessError = error as {
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      signalName?: string;
    };

    // Filter stdout (where tsgo writes diagnostics)
    const stdoutResult = filterTsgoOutput(subprocessError.stdout ?? '',);
    // Filter stderr as well in case tsgo writes diagnostics there
    const stderrResult = filterTsgoOutput(subprocessError.stderr ?? '',);

    if (stdoutResult.filtered.length > 0) {
      process.stdout.write(stdoutResult.filtered,);
      // Ensure trailing newline for clean terminal output
      if (!stdoutResult.filtered.endsWith('\n',))
        process.stdout.write('\n',);
    }

    if (stderrResult.filtered.length > 0) {
      process.stderr.write(stderrResult.filtered,);
      if (!stderrResult.filtered.endsWith('\n',))
        process.stderr.write('\n',);
    }

    // Exit non-zero only if non-node_modules errors remain
    if (stdoutResult.hasRemainingErrors || stderrResult.hasRemainingErrors)
      process.exitCode = subprocessError.exitCode ?? 1;

    if (subprocessError.signalName !== undefined && subprocessError.signalName !== '') {
      console.error(
        `[task-tsgo] tsgo terminated by signal: ${subprocessError.signalName}`,
      );
      process.exitCode = 1;
    }
  }
  else {
    // Non-subprocess error (e.g. tsgo not found)
    console.error(
      `[task-tsgo] failed to execute tsgo: ${
        error instanceof Error ? error.message : String(error,)
      }`,
    );
    process.exitCode = 1;
  }
}

//endregion Main execution
