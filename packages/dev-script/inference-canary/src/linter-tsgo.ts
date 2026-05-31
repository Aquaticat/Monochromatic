/**
 * tsgo integration: runs tsgo --noEmit and filters type errors to only those
 * from the specific canary lint subdirectory being evaluated.
 *
 * tsgo exits non-zero when it finds type errors; stdout contains the diagnostics.
 * Filtering by subdirectory prevents noise from bun-types or other probe runs.
 */
import { join, } from 'node:path';

import { PACKAGE_DIR, } from './linter-artifacts.ts';
import {
  execPromise,
  getStdoutFromError,
  LINT_TIMEOUT_MS,
} from './linter-exec.ts';
import {
  l,
  tagged,
} from './log.ts';

/**
 * Parsed tsgo result
 */
export type TsgoResult = {
  readonly errorCount: number;
  readonly ran: boolean;
  readonly rawOutput: string;
};

/**
 * Options for {@link filterTypeErrors}.
 *
 * @example
 * ```ts
 * const opts: FilterTypeErrorsOptions = {
 *   output: tsgoStdout,
 *   subdirId: 'css-mixin-initial',
 * };
 * ```
 */
type FilterTypeErrorsOptions = {
  /**
   * Raw tsgo output
   */
  readonly output: string;
  /**
   * Subdirectory label within canary-lint/ (e.g. "css-mixin-initial")
   */
  readonly subdirId: string;
};

/**
 * Extracts type error lines from a specific canary lint subdirectory only,
 * ignoring noise from bun-types, other project files, or other probe runs.
 *
 * @param output - raw tsgo output
 *
 * @param subdirId - subdirectory label within canary-lint/ (e.g. "css-mixin-initial")
 *
 * @returns error lines from that subdirectory's canary.ts
 */
function filterTypeErrors({
  output,
  subdirId,
}: FilterTypeErrorsOptions,): readonly string[] {
  /**
   * Path fragment that uniquely identifies this probe's canary.ts; used to ignore unrelated diagnostics.
   */
  const marker = `canary-lint/${subdirId}/canary.ts`;
  return output.split('\n',)
    .filter(function matchLine(line,): boolean {
    return line.includes(marker,)
      && line
      .includes('error TS',);
  },);
}

/**
 * Runs tsgo --noEmit on the canary-specific tsconfig, counts type errors
 * belonging to the given lint subdirectory only.
 *
 * @param lintDir - absolute path to the lint subdirectory for this probe
 *
 * @returns error count and whether tsgo ran successfully
 *
 * @example
 * ```ts
 * const result = await runAndParseTypeCheck('/path/to/canary-lint/model/probe-initial-ts');
 * result.errorCount; // number of type errors
 * ```
 */
export async function runAndParseTypeCheck(lintDir: string,): Promise<TsgoResult> {
  /**
   * Filter key: "model-slug/probe-pass" identifies this probe's file uniquely
   */
  // split() always returns a non-empty array; pop() is therefore never undefined here
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- split always returns non-empty array; pop is safe
  const relativeSuffix = lintDir.split('canary-lint/',)
    .pop() as string;

  try {
    /**
     * Separate tsconfig that only includes src/canary-lint/ to isolate generated code
     */
    const canaryTsconfig = join(
      PACKAGE_DIR,
      'tsconfig.canary-lint.json',
    );
    /**
     * tsgo stdout from the clean-exit branch; empty when the project has zero type errors.
     */
    const output = await execPromise({
      command: 'tsgo',
      args: [
        '--noEmit',
        '-p',
        canaryTsconfig,
      ],
      options: {
        timeout: LINT_TIMEOUT_MS,
      },
    },);
    /**
     * Diagnostic lines belonging to this probe's canary.ts; other paths are dropped.
     */
    const filtered = filterTypeErrors({
      output,
      subdirId: relativeSuffix,
    },);
    return {
      errorCount: filtered.length,
      ran: true,
      rawOutput: filtered.join('\n',),
    };
  }
  catch (error) {
    // tsgo exits non-zero when there are type errors; stdout has the diagnostics
    /**
     * stdout salvaged from the thrown error; carries tsgo diagnostics on the failure branch.
     */
    const stdout = getStdoutFromError(error,);
    if (stdout.includes('error TS',)) {
      /**
       * Diagnostic lines belonging to this probe's canary.ts on the failure branch.
       */
      const filtered = filterTypeErrors({
        output: stdout,
        subdirId: relativeSuffix,
      },);
      return {
        errorCount: filtered.length,
        ran: true,
        rawOutput: filtered.join('\n',),
      };
    }
    /**
     * Lint-specific logger for tsgo failure messages.
     */
    const rl = tagged({
      tag: 'lint:tsgo',
      l,
    },);
    rl.error(`failed: ${String(error,)}`,);
    return {
      errorCount: 0,
      ran: false,
      rawOutput: '',
    };
  }
}
