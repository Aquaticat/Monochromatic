/**
 * Library entry point for launching a terminal from other packages.
 *
 * Unlike the CLI entry which replaces the current process via {@link execvp},
 * {@link launchTerminal} spawns the terminal as a detached child and returns
 * once it has started.
 *
 * @module
 */

import { spawn, } from 'node:child_process';

import { buildCommand, } from './build-command.ts';
import {
  l as parentLogger,
  tagged,
} from './log.ts';
import { resolveTerminal, } from './resolve.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'launch',
  l: parentLogger,
},);

/**
 * Resolves the preferred terminal emulator and launches it as a detached process.
 *
 * @param dir - directory to open the terminal in
 *
 * @param command - optional command and arguments to execute in the terminal
 *
 * @param title - optional window title
 *
 * @throws when no terminal emulator is found or the process fails to spawn
 *
 * @example
 * ```ts
 * await launchTerminal({ dir: '/home/user/project' });
 * await launchTerminal({ dir: '/tmp', command: ['bash', '-l'] });
 * ```
 */
export async function launchTerminal({
  dir,
  command = [],
  title = '',
}: {
  dir: string;
  command?: readonly string[];
  title?: string;
},): Promise<void> {
  const terminal = await resolveTerminal();

  if (terminal === null) {
    throw new Error(
      process.platform === 'win32'
        ? 'No terminal emulator found.'
        : 'No terminal emulator found. Install a terminal emulator or configure one in ~/.config/xdg-terminals.list',
    );
  }

  l.info(`resolved terminal: ${terminal.entryId}`,);

  const argv = buildCommand({
    terminal,
    options: {
      appId: '',
      title,
      dir,
      hold: false,
      command,
    },
  },);

  if (argv.length === 0)
    throw new Error('launchTerminal: buildCommand returned empty argv',);

  const [executable, ...args] = argv;

  l.info(`launching: ${String(executable,)} ${args.join(' ',)}`,);

  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- wrapping callback-based child_process.spawn requires manual Promise construction
  await new Promise<void>(function awaitSpawn(
    resolve,
    reject,
  ): void {
    const child = spawn(
      String(executable,),
      args,
      {
        cwd: dir,
        detached: true,
        stdio: 'ignore',
      },
    );
    child.unref();
    child.on(
      'error',
      reject,
    );
    /** Resolve on next tick: if spawn failed, the error event fires synchronously. */
    queueMicrotask(resolve,);
  },);
}
