/**
 * Shared promisified execFile helper for lint and type-check runners.
 *
 * Centralised here so linter-oxlint.ts and linter-tsgo.ts share one implementation.
 * On a non-zero exit the rejected error has `.stdout` and `.stderr` attached by Node,
 * which callers use to extract diagnostic output from tools that exit non-zero on findings.
 */
import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';

/** Promisified execFile. On non-zero exit, the rejected error has stdout/stderr attached. */
export const execFileAsync = promisify(execFile);

/**
 * Runs a command and returns stdout.
 * @param command - command to run
 * @param args - command arguments
 * @param options - execFile options (timeout, maxBuffer, encoding)
 * @returns stdout string
 * @throws with `.stdout` attached if the command exits non-zero
 */
export async function execPromise(
  command: string,
  args: readonly string[],
  options: { readonly timeout?: number; readonly maxBuffer?: number } = {},
): Promise<string> {
  const { stdout, } = await execFileAsync(
    command,
    args as string[],
    { encoding: 'utf8', ...options, },
  );
  return stdout;
}
