/**
 * Base execution helper for container.ts submodules.
 *
 * Provides a promisified execFile used by both runtime detection (container-runtime.ts)
 * and container execution (container-exec.ts). Kept separate to avoid circular imports
 * between those two modules.
 */
import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';

/** Promisified execFile. On non-zero exit, the rejected error has stdout/stderr attached. */
export const execFileAsync = promisify(execFile);

/**
 * Runs a command and returns stdout.
 * @param command - command to run
 * @param args - command arguments
 * @returns stdout string
 * @throws with `.stdout` attached if the command exits non-zero
 */
export async function execPromise(command: string, args: readonly string[]): Promise<string> {
  const { stdout, } = await execFileAsync(command, args as string[], { encoding: 'utf8', });
  return stdout;
}
