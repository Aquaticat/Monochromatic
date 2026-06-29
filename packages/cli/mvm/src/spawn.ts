import nanoSpawn from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 * Logger root for mvm after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'mvm', },);

/**
 * Spawns a command and returns its trimmed stdout.
 * Logs the command at debug level before execution.
 *
 * @param args - Arguments array for the command
 *
 * @param command - Command name or path to execute
 *
 * @returns Trimmed stdout output from the command
 *
 * @throws Error when command exits with non-zero code, including stderr
 *
 * @example
 * ```ts
 * const output = await spawn({ command: 'virsh', args: ['list', '--all'] });
 * ```
 */
export async function spawn(
  {
    args,
    command,
  }: {
    readonly args: readonly string[];
    readonly command: string;
  },
): Promise<string> {
  /**
   * Tagged logger so the debug line names the spawn call site.
   */
  const rl = tagged({
    tag: spawn.name,
    l,
  },);
  rl.debug(`${command} ${args.join(' ',)}`,);

  /**
   * Only stdout is consumed; stderr and subprocess fields are discarded by destructuring.
   */
  const { stdout, } = await nanoSpawn(
    command,
    [...args,],
  );

  return stdout.trim();
}
