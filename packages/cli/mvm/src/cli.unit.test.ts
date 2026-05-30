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
const BIN_PATH = 'packages/cli/mvm/dist/final/node/cli.mjs';

/**
 * Runs the built mvm bin as a subprocess and returns stdout, stderr, and exit code.
 *
 * @param args - CLI arguments to pass after `mvm`
 * @returns Stdout text, stderr text, and numeric exit code
 *
 * @example
 * ```ts
 * const result = await runMvm({ args: ['--help'] });
 * // result.exitCode === 0
 * ```
 */
async function runMvm({ args, }: { args: readonly string[]; },): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  try {
    const result = await spawn('bun', [BIN_PATH, ...args,], { cwd: REPO_ROOT, },);
    return {
      exitCode: 0,
      stderr: result.stderr,
      stdout: result.stdout,
    };
  }
  catch (error: unknown) {
    const spawnError = error as SubprocessError;
    return {
      exitCode: spawnError.exitCode ?? 1,
      stderr: spawnError.stderr,
      stdout: spawnError.stdout,
    };
  }
}

await describe({
  name: 'mvm bin (built artifact smoke test)',
  children: [
    //region Help: --help is the only inert path (every subcommand provisions or mutates KVM VMs), so test only --help

    it({
      name: 'prints help and exits 0 with --help',
      fn: async () => {
        const result = await runMvm({ args: ['--help',], },);
        expect(result.exitCode,).toBe(0,);
        expect(result.stdout,).toContain('mvm',);
        expect(result.stdout,).toContain('Usage:',);
        expect(result.stdout,).toContain('create',);
        expect(result.stdout,).toContain('list',);
      },
    },),

    //endregion Help
  ],
},);
