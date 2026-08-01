import { spawn, } from 'node:child_process';
import { once, } from 'node:events';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { PrivilegeError, } from './errors.ts';

/**
 * Module logger for root relaunch lifecycle.
 */
const l = tagged({ tag: 'privilege', },);

/**
 * Privilege broker resolved in original user's command search path.
 */
const SUDO_COMMAND = 'sudo';

/**
 * Relaunches exact Node runtime and CLI artifact through sudo when current process is non-root.
 *
 * Inherited standard streams let sudo use terminal for authentication.
 * Exact runtime and script paths avoid relying on sudo's restricted command search path.
 *
 * @param currentUid - Effective UID of current CLI process.
 *
 * @param executablePath - Absolute Node executable running current process.
 *
 * @param scriptPath - Absolute CLI module path running current process.
 *
 * @param processArguments - Original arguments after CLI module path.
 *
 * @returns Whether operation was delegated to privileged child.
 *
 * @throws {@link PrivilegeError} when sudo cannot start or privileged child fails.
 *
 * @example
 * ```ts
 * await relaunchWithRootIfNeeded({
 *   currentUid: 1000,
 *   executablePath: '/usr/bin/node',
 *   scriptPath: '/opt/wg-quicker/index.mjs',
 *   processArguments: ['up', 'wg0'],
 * });
 * ```
 */
export async function relaunchWithRootIfNeeded(
  {
    currentUid,
    executablePath,
    scriptPath,
    processArguments,
  }: {
    readonly currentUid: number;
    readonly executablePath: string;
    readonly scriptPath: string;
    readonly processArguments: readonly string[];
  },
): Promise<boolean> {
  if (currentUid === 0) {
    l.debug('already running with root privileges',);
    return false;
  }
  /**
   * Exact command boundary passed after sudo's option terminator.
   */
  const sudoArguments = [
    '--',
    executablePath,
    scriptPath,
    ...processArguments,
  ];
  l.debug(`relaunching through sudo: ${executablePath} ${scriptPath}`,);
  /**
   * Interactive privilege broker sharing terminal streams with invoking user.
   */
  const child = spawn(
    SUDO_COMMAND,
    sudoArguments,
    { stdio: 'inherit', },
  );
  try {
    await once(
      child,
      'close',
    );
  }
  catch (error) {
    l.error(`failed to start sudo: ${String(error,)}`,);
    throw new PrivilegeError('Unable to start sudo for wg-quicker.', { cause: error, },);
  }
  /**
   * Exit status available after close event unless child ended by signal.
   */
  const { exitCode, } = child;
  if (exitCode !== 0) {
    throw new PrivilegeError(
      `Privileged wg-quicker process failed with exit code ${String(exitCode ?? -1,)}.`,
    );
  }
  return true;
}
