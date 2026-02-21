/**
 * Runs an external command and returns its stdout.
 * @param cmd - Executable name
 * @param args - Arguments passed to the command
 * @returns Stdout output as a string
 * @throws When the command exits with a non-zero code
 */
export async function exec(cmd: string, args: readonly string[] = []): Promise<string> {
  console.log(`[file-enforcer] exec: ${cmd} ${args.join(' ')}`);
  /** Spawned subprocess */
  const proc = Bun.spawn([cmd, ...args], { stdout: 'pipe', stderr: 'pipe', });
  /** Stdout captured as text */
  const stdout = await new Response(proc.stdout).text();
  /** Stderr captured for error reporting */
  const stderr = await new Response(proc.stderr).text();
  /** Exit code from the process */
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`exec "${cmd}" exited with code ${String(exitCode)}: ${stderr}`);
  }
  return stdout;
}
