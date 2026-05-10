/**
 * Low-level oxlint process spawning.
 *
 * Spawns a single oxlint process with the given config,
 * captures JSON output, and returns parsed diagnostics.
 *
 * @module
 */

import spawn from 'nano-spawn';

import type { Diagnostic, } from './nvim-client.ts';
import { parseOxlintOutput, } from './oxlint-parse.ts';
import type { OxlintJsonOutput, } from './oxlint-types.ts';

//region Constants

/** Timeout in milliseconds for the oxlint process. */
const OXLINT_TIMEOUT_MS = 10_000;

//endregion Constants

//region Process spawning: low-level oxlint invocation

/**
 * Spawns a single oxlint process and returns parsed diagnostics.
 *
 * @param cwd - Working directory for the oxlint process.
 *
 * @param files - Absolute file paths to lint.
 *
 * @param typeAware - Whether to pass `--type-aware`.
 *
 * @returns Diagnostics grouped by absolute file path.
 *
 * @example
 * ```ts
 * const diagnostics = await spawnOxlint({ cwd: '/project', files: ['/project/src/index.ts'], typeAware: false });
 * // Map { '/project/src/index.ts' => [{ message: '...', severity: 'warning', ... }] }
 * ```
 */
export async function spawnOxlint({
  cwd,
  files,
  typeAware,
}: {
  cwd: string;
  files: readonly string[];
  typeAware: boolean;
},): Promise<Map<string, Diagnostic[]>> {
  const args = [
    '--format',
    'json',
    ...(typeAware ? ['--type-aware',] : []),
    ...files,
  ];

  try {
    const result = await spawn(
      'oxlint',
      args,
      {
        cwd,
        timeout: OXLINT_TIMEOUT_MS,
      },
    );
    const { stdout, } = result;

    if (stdout.trim().length === 0) {
      console.error('[mcp-nvim] oxlint produced no output (exit code 0)',);
      return new Map();
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint JSON output conforms to OxlintJsonOutput schema
    const parsed = JSON.parse(stdout,) as OxlintJsonOutput;
    return parseOxlintOutput(
      parsed,
      cwd,
    );
  }
  catch (err: unknown) {
    // oxlint exits non-zero when it finds diagnostics, which is expected
    if (err !== null && err !== undefined && typeof err === 'object' && 'stdout' in err) {
      const stdout = String(err.stdout,);
      if (stdout.trim().length > 0) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint JSON output conforms to OxlintJsonOutput schema
        const parsed = JSON.parse(stdout,) as OxlintJsonOutput;
        return parseOxlintOutput(
          parsed,
          cwd,
        );
      }
      const exitCode = 'exitCode' in err ? String(err.exitCode,) : 'unknown';
      console.error(`[mcp-nvim] oxlint produced no output (exit code ${exitCode})`,);
      return new Map();
    }
    const message = err instanceof Error ? err.message : String(err,);
    console.error(`[mcp-nvim] Failed to run oxlint: ${message}`,);
    return new Map();
  }
}

//endregion Process spawning
