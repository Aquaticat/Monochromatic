import nanoSpawn from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 Logger root for mvm after removing the package log shim.

 @example
 ```ts
 const rl = tagged({ tag: someFunction.name, l, },);
 ```
 */
const l = tagged({ tag: 'mvm', },);

/**
 Spawns a command and returns its trimmed stdout.
 Logs the command at debug level before execution.

 @param args - Arguments array for the command

 @param command - Command name or path to execute

 @param env - Environment variables set on top of the current environment, when the command's output must not depend on the caller's settings

 @returns Trimmed stdout output from the command

 @throws Error when command exits with non-zero code, including stderr

 @example
 ```ts
 const output = await spawn({ command: 'virsh', args: ['list', '--all'] });
 ```
 */
export async function spawn(
  {
    args,
    command,
    env = {},
  }: {
    readonly args: readonly string[];
    readonly command: string;
    readonly env?: Readonly<Record<string, string>>;
  },
): Promise<string> {
  /**
   Tagged logger so the debug line names the spawn call site.
   */
  const rl = tagged({
    tag: spawn.name,
    l,
  },);
  rl.debug(`${command} ${args.join(' ',)}`,);

  /**
   Only stdout is consumed; stderr and subprocess fields are discarded by destructuring.
   */
  const { stdout, } = await nanoSpawn(
    command,
    [...args,],
    { env, },
  );

  return stdout.trim();
}

/**
 Reads the standard-error text a failed {@link spawn} call attached to its error.

 @param error - Value caught from a rejected {@link spawn} call

 @returns Standard-error text of the failed command, or `''` when the error carries none

 @example
 ```ts
 try {
   await spawn({ command: 'virsh', args: ['start', 'mvm-dev'] });
 }
 catch (error) {
   failedCommandStderr(error); // => "error: failed to get domain 'mvm-dev'"
   throw error;
 }
 ```
 */
export function failedCommandStderr(error: unknown,): string {
  if (((typeof error) === 'object')
    && (error !== null)
    && ('stderr' in error)
    && ((typeof error.stderr) === 'string'))
  {
    return error.stderr;
  }
  return '';
}
