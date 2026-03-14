/**
 * Replaces the current process with the resolved terminal command.
 * Uses `Bun.spawn` with `stdin: 'inherit'` since Bun lacks a native `execvp`.
 *
 * @module
 */

import { l as parentLogger, tagged } from './log.ts';

/** Tagged logger for this module. */
const l = tagged({ tag: 'exec', l: parentLogger });

/** Exit code for command-not-found errors. */
const EXIT_NOT_FOUND = 127;

/**
 * Spawns the terminal command, inheriting all stdio, and exits with its exit code.
 * This replaces the shell script's `exec "$\@"` pattern.
 *
 * @param command - Complete command array where `command[0]` is the executable.
 *
 * @throws Error when the command array is empty.
 *
 * @example
 * ```ts
 * execvp(\{ command: ['/usr/bin/ghostty', '--gtk-single-instance=true', '-e', 'bash'] \})
 * ```
 */
export function execvp({ command }: { command: readonly string[] }): void {
  if (command.length === 0) {
    throw new Error('execvp: empty command array');
  }

  /* oxlint-disable-next-line typescript-eslint/no-non-null-assertion -- length checked above */
  const executable = command[0]!;
  const args = command.slice(1);

  l.debug(`exec: ${executable} ${args.join(' ')}`);

  const proc = Bun.spawn([executable, ...args], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  /* oxlint-disable eslint-plugin-promise/prefer-await-to-then, eslint-plugin-promise/always-return, eslint-plugin-promise/prefer-await-to-callbacks, eslint-plugin-promise/prefer-catch -- fire-and-forget: process exits with spawned command's code; .then(onSuccess, onError) is intentional for non-async exit handling */
  proc.exited.then(function onExit(code) {
    process.exitCode = code;
  }, function onError(err: unknown) {
    console.error(`terminal-exec: failed to execute '${executable}': ${String(err)}`);
    process.exitCode = EXIT_NOT_FOUND;
  });
  /* oxlint-enable eslint-plugin-promise/prefer-await-to-then, eslint-plugin-promise/always-return, eslint-plugin-promise/prefer-await-to-callbacks, eslint-plugin-promise/prefer-catch */
}
