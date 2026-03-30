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

/** Parsed tsgo result */
export type TsgoResult = {
  readonly errorCount: number;
  readonly ran: boolean;
  readonly rawOutput: string;
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
function filterTypeErrors(
  output: string,
  subdirId: string,
): readonly string[] {
  const marker = `canary-lint/${subdirId}/canary.ts`;
  return output.split('\n',).filter(function matchLine(line,): boolean {
    return line.includes(marker,) && line.includes('error TS',);
  },);
}

/**
 * Runs tsgo --noEmit on the canary-specific tsconfig, counts type errors
 * belonging to the given lint subdirectory only.
 *
 * @param lintDir - absolute path to the lint subdirectory for this probe
 *
 * @returns error count and whether tsgo ran successfully
 */
export async function runAndParseTypeCheck(lintDir: string,): Promise<TsgoResult> {
  /** Filter key: "model-slug/probe-pass" identifies this probe's file uniquely */
  // split() always returns a non-empty array; pop() is therefore never undefined here
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- split always returns non-empty array; pop is safe
  const relativeSuffix = lintDir.split('canary-lint/',).pop() as string;

  try {
    /** Separate tsconfig that only includes src/canary-lint/ to isolate generated code */
    const canaryTsconfig = join(
      PACKAGE_DIR,
      'tsconfig.canary-lint.json',
    );
    const output = await execPromise(
      'tsgo',
      ['--noEmit', '-p', canaryTsconfig,],
      {
        timeout: LINT_TIMEOUT_MS,
      },
    );
    const filtered = filterTypeErrors(
      output,
      relativeSuffix,
    );
    return {
      errorCount: filtered.length,
      ran: true,
      rawOutput: filtered.join('\n',),
    };
  }
  catch (error) {
    // tsgo exits non-zero when there are type errors; stdout has the diagnostics
    const stdout = getStdoutFromError(error,);
    if (stdout.includes('error TS',)) {
      const filtered = filterTypeErrors(
        stdout,
        relativeSuffix,
      );
      return {
        errorCount: filtered.length,
        ran: true,
        rawOutput: filtered.join('\n',),
      };
    }
    /** Lint-specific logger for tsgo failure messages. */
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
