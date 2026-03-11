import spawn from 'nano-spawn';

/**
 * Runs an external command and returns its stdout.
 * @param cmd - Executable name
 * @param args - Arguments passed to the command
 * @returns Stdout output as a string
 * @throws When the command exits with a non-zero code
 */
export async function exec(cmd: string, args: readonly string[] = []): Promise<string> {
  console.log(`[file-enforcer] exec: ${cmd} ${args.join(' ')}`);
  const { stdout } = await spawn(cmd, [...args]);
  return stdout;
}
