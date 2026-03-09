import { l, tagged } from './log.ts';

/**
 * Spawns a command and returns its trimmed stdout.
 * Logs the command at debug level before execution.
 *
 * @param options - Command name and arguments array
 * @returns Trimmed stdout output from the command
 * @throws Error when command exits with non-zero code, including stderr
 *
 * @example
 * ```ts
 * const output = await run({ command: 'virsh', args: ['list', '--all'] });
 * ```
 */
export async function run({ args, command }: { args: readonly string[]; command: string }): Promise<string> {
  const rl = tagged({ tag: run.name, l, });
  rl.debug(`${command} ${args.join(' ')}`);

  const proc = Bun.spawn([command, ...args], { stderr: 'pipe', stdout: 'pipe', });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`${command} failed (exit ${exitCode}): ${stderr.trim()}`);
  }

  return stdout.trim();
}
