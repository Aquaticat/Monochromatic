/**
 * Detached process spawning helper.
 *
 * Creates a child process that outlives the parent, useful for
 * opening external applications like terminal emulators and file viewers.
 */

import { spawn, } from 'node:child_process';

// oxlint-disable eslint-plugin-promise/avoid-new -- wrapping callback-based child_process.spawn requires manual Promise construction
/**
 * Spawns a detached process that outlives the parent.
 * Resolves once the process has spawned successfully.
 *
 * @param command - executable name or path
 *
 * @param args - arguments to pass to the command
 *
 * @param cwd - working directory for the spawned process
 *
 * @throws when the process fails to spawn
 */
export function spawnDetached(
  {
    command,
    args,
    cwd,
  }: {
    command: string;
    args: string[];
    cwd: string
  },
): Promise<void> {
  return new Promise<void>(function awaitSpawn(
    resolve,
    reject,
  ): void {
    const child = spawn(
      command,
      args,
      {
      cwd,
      detached: true,
      stdio: 'ignore',
    },
    );
    child.unref();
    child.on(
      'error',
      reject,
    );
    /** Resolve on next tick — if spawn failed, the error event fires synchronously. */
    queueMicrotask(resolve,);
  },);
}
// oxlint-enable eslint-plugin-promise/avoid-new
