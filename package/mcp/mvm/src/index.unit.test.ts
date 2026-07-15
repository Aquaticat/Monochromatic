import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { findMiseMonorepoRootCached, } from '@monochromatic-dev/module-fs-path/ts';
import spawn, { type SubprocessError, } from 'nano-spawn';

/** Mise monorepo root for spawn cwd, so the built bin path is invariant to the task's launch directory. */
const REPO_ROOT = await findMiseMonorepoRootCached();

/** Built bin path, resolved from the monorepo root. */
const BIN_PATH = 'package/mcp/mvm/dist/final/node/index.mjs';

/**
 * Spawns the built bin with stdin closed (EOF) and returns its exit code.
 *
 * @returns Numeric exit code; 0 when the server constructs and the transport loop ends cleanly
 *
 * @example
 * ```ts
 * const code = await runWithClosedStdin();
 * // code === 0
 * ```
 */
async function runWithClosedStdin(): Promise<number> {
  try {
    await spawn('node', [BIN_PATH,], { cwd: REPO_ROOT, stdin: 'ignore', },);
    return 0;
  }
  catch (error: unknown) {
    return (error as SubprocessError).exitCode ?? 1;
  }
}

await describe({
  name: 'mvm-mcp bin (built artifact smoke test)',
  children: [
    //region Clean startup: with stdin at EOF the server constructs, reads zero JSON-RPC lines, and exits 0.
    // No tool call fires, so no KVM VM is ever provisioned (every mvm tool would mutate VM state). This executes
    // the built bin end-to-end (registers all 8 tools, runs the stdio transport loop) without side effects.

    it({
      name: 'constructs the server and exits 0 when stdin is closed',
      fn: async () => {
        /** Numeric exit code from the closed-stdin run. */
        const exitCode = await runWithClosedStdin();
        expect(exitCode,).toBe(0,);
      },
    },),

    //endregion Clean startup
  ],
},);
