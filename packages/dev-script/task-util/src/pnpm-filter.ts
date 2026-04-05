#!/usr/bin/env bun

/**
 * CLI wrapper for `pnpm` that filters out known-benign warnings.
 *
 * Runs `pnpm` with all provided arguments, captures output,
 * and removes allowed cycle warnings from both stdout and stderr
 * via {@link filterPnpmOutput}.
 * pnpm writes the cycle warning to stdout (verified empirically),
 * but both streams are filtered for robustness.
 *
 * @example
 * ```bash
 * task-pnpm install
 * task-pnpm install --frozen-lockfile
 * ```
 */

import spawn from 'nano-spawn';

import { filterPnpmOutput, } from './pnpm-output-filter.ts';

//region Main execution

/** Arguments forwarded to pnpm. */
const pnpmArgs = process.argv.slice(2,);

/**
 * Filters output and writes to the given stream if non-empty after filtering.
 *
 * @param raw - raw pnpm output
 * @param stream - target writable stream
 *
 * @example
 * ```ts
 * writeFiltered('some output\n', process.stdout);
 * ```
 */
function writeFiltered(raw: string, stream: NodeJS.WriteStream,): void {
  if (raw.length === 0) {
    return;
  }
  const filtered = filterPnpmOutput(raw,);
  if (filtered.length > 0) {
    stream.write(filtered,);
  }
}

try {
  const result = await spawn('pnpm', [...pnpmArgs,],);

  writeFiltered(result.stdout, process.stdout,);
  writeFiltered(result.stderr, process.stderr,);
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

    writeFiltered(subprocessError.stdout ?? '', process.stdout,);
    writeFiltered(subprocessError.stderr ?? '', process.stderr,);

    process.exitCode = subprocessError.exitCode ?? 1;

    if (subprocessError.signalName !== undefined && subprocessError.signalName !== '') {
      console.error(
        `[task-pnpm] pnpm terminated by signal: ${subprocessError.signalName}`,
      );
      process.exitCode = 1;
    }
  }
  else {
    console.error(
      `[task-pnpm] failed to execute pnpm: ${
        error instanceof Error ? error.message : String(error,)
      }`,
    );
    process.exitCode = 1;
  }
}

//endregion Main execution
