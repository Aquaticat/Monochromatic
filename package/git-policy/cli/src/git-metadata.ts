import nanoSpawn from 'nano-spawn';

/**
 * Removes one Git-produced terminal line break.
 *
 * @param output - captured Git output
 *
 * @returns output without one terminal LF or CRLF
 *
 * @example
 * ```ts
 * stripGitLine('/repo/.git\n');
 * // => '/repo/.git'
 * ```
 */
export function stripGitLine(output: string,): string {
  if (output.endsWith('\r\n',)) {
    return output.slice(
      0,
      -2,
    );
  }
  if (output.endsWith('\n',)) {
    return output.slice(
      0,
      -1,
    );
  }
  return output;
}

/**
 * Runs read-only real-Git metadata command with captured streams.
 *
 * @param gitPath - absolute real-Git executable
 *
 * @param args - exact Git arguments
 *
 * @param cwd - command working directory
 *
 * @returns captured stdout
 *
 * @example
 * ```ts
 * await runMetadataGit({
 *   gitPath: '/usr/bin/git',
 *   args: ['rev-parse', '--git-dir'],
 *   cwd: '/repo',
 * });
 * ```
 */
export async function runMetadataGit({
  gitPath,
  args,
  cwd,
}: Readonly<{
  gitPath: string;
  args: readonly string[];
  cwd: string;
}>,): Promise<string> {
  /**
   * Captured metadata subprocess result.
   */
  const result = await nanoSpawn(
    gitPath,
    [...args,],
    {
      cwd,
      stderr: 'pipe',
      stdout: 'pipe',
    },
  );
  return result.stdout;
}
