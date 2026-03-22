/**
 * External application launch operations.
 *
 * Opens a terminal at a directory path or opens a file in the default application.
 * Uses platform-specific commands: `xdg-open` on Linux, `open` on macOS,
 * `start` on Windows.
 */

import { spawn, } from 'node:child_process';
import { dirname, } from 'node:path';
import { platform, } from 'node:process';

import { assertWithinRoot, } from './assert-within-root.ts';

/**
 * Opens a terminal emulator at the given directory path.
 * Uses `terminal-exec` conventions per platform.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - directory path to open in a terminal
 *
 * @throws when the path escapes root or no terminal emulator is found
 */
export async function openInTerminal({ rootDir, path, }: { rootDir: string; path: string }): Promise<void> {
  const absolutePath = assertWithinRoot({ rootDir, path, },);
  const currentPlatform = platform;

  if (currentPlatform === 'linux') {
    /** Try common terminal emulators in preference order; sequential because we stop at the first success. */
    const terminals = ['xdg-terminal-exec', 'x-terminal-emulator', 'xterm',];
    // oxlint-disable-next-line eslint(no-await-in-loop) -- sequential fallback: each attempt must complete before trying the next emulator
    for (const terminal of terminals) {
      try {
        // oxlint-disable-next-line eslint(no-await-in-loop) -- sequential fallback: each attempt must complete before trying the next emulator
        await spawnDetached({ command: terminal, args: [], cwd: absolutePath, },);
        return;
      }
      catch {
        /** Try next terminal emulator. */
      }
    }
    throw new Error('no terminal emulator found',);
  }
  else if (currentPlatform === 'darwin') {
    await spawnDetached({ command: 'open', args: ['-a', 'Terminal', absolutePath,], cwd: absolutePath, },);
  }
  else if (currentPlatform === 'win32') {
    await spawnDetached({ command: 'cmd', args: ['/c', 'start', 'cmd', '/k', `cd /d ${absolutePath}`,], cwd: absolutePath, },);
  }
  else {
    throw new Error(`unsupported platform: ${currentPlatform}`,);
  }
}

/**
 * Opens a file in its default application.
 * Uses `xdg-open` on Linux, `open` on macOS, `start` on Windows.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - file path to open
 *
 * @throws when the path escapes root or the open command fails
 */
export async function openInDefaultApp({ rootDir, path, }: { rootDir: string; path: string }): Promise<void> {
  const absolutePath = assertWithinRoot({ rootDir, path, },);
  const currentPlatform = platform;

  const dir = dirname(absolutePath,);

  if (currentPlatform === 'linux') {
    await spawnDetached({ command: 'xdg-open', args: [absolutePath,], cwd: dir, },);
  }
  else if (currentPlatform === 'darwin') {
    await spawnDetached({ command: 'open', args: [absolutePath,], cwd: dir, },);
  }
  else if (currentPlatform === 'win32') {
    await spawnDetached({ command: 'cmd', args: ['/c', 'start', '', absolutePath,], cwd: dir, },);
  }
  else {
    throw new Error(`unsupported platform: ${currentPlatform}`,);
  }
}

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
function spawnDetached({ command, args, cwd, }: { command: string; args: string[]; cwd: string }): Promise<void> {
  // oxlint-disable-next-line eslint-plugin-promise/avoid-new -- wrapping callback-based child_process.spawn requires manual Promise construction
  return new Promise<void>(function awaitSpawn(resolve, reject,): void {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: 'ignore',
    },);
    child.unref();
    child.on('error', reject,);
    /** Resolve on next tick — if spawn failed, the error event fires synchronously. */
    queueMicrotask(resolve,);
  },);
}
