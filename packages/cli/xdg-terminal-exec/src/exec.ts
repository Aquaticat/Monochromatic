/**
 * Replaces the current process with the resolved terminal command.
 * Uses `Bun.spawn` with `stdin: 'inherit'` since Bun lacks a native `execvp`.
 *
 * @module
 */

import { l as parentLogger, tagged } from './log.ts';

const l = tagged({ tag: 'exec', l: parentLogger });

/**
 * Spawns the terminal command, inheriting all stdio, and exits with its exit code.
 * This replaces the shell script's `exec "$@"` pattern.
 *
 * @param command - Complete command array where `command[0]` is the executable.
 * @throws {Error} When the command array is empty.
 *
 * @example
 * ```ts
 * execvp({ command: ['/usr/bin/ghostty', '--gtk-single-instance=true', '-e', 'bash'] })
 * ```
 */
export function execvp({ command }: { command: ReadonlyArray<string> }): void {
  if (command.length === 0) {
    throw new Error('execvp: empty command array');
  }

  const executable = command[0]!;
  const args = command.slice(1);

  l.debug(`exec: ${executable} ${args.join(' ')}`);

  const proc = Bun.spawn([executable, ...args], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  proc.exited.then(function onExit(code) {
    process.exitCode = code;
  }).catch(function onError(err: unknown) {
    console.error(`xdg-terminal-exec: failed to execute '${executable}': ${String(err)}`);
    process.exitCode = 127;
  });
}
