import nanoSpawn from 'nano-spawn';

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
 * const output = await spawn({ command: 'virsh', args: ['list', '--all'] });
 * ```
 */
export async function spawn({ args, command }: { args: ReadonlyArray<string>; command: string }): Promise<string> {
  const rl = tagged({ tag: spawn.name, l, });
  rl.debug(`${command} ${args.join(' ')}`);

  const { stdout } = await nanoSpawn(command, [...args]);

  return stdout.trim();
}
