/**
 * Shell dispatch helpers for guest agent command execution.
 * Handles base64 decoding of guest agent output and OS-specific
 * shell argument construction for Linux and Windows guests.
 */

/**
 * Decodes a base64-encoded string to UTF-8 text.
 *
 * @param encoded - base64 string from guest agent response
 *
 * @returns Decoded UTF-8 string
 *
 * @example
 * ```ts
 * decodeBase64('aGVsbG8='); // => "hello"
 * ```
 */
export function decodeBase64(encoded: string,): string {
  return Buffer
    .from(
      encoded,
      'base64',
    )
    .toString('utf8',);
}

/**
 * Builds the guest-exec path and arguments for the given OS family and command.
 * Linux uses the configured shell (bash/ash) with `-c`; Windows uses
 * `powershell.exe` with `-NoProfile -NonInteractive -Command`.
 *
 * @param command - Shell command string to execute
 *
 * @param osFamily - Guest OS family (`linux` or `windows`)
 *
 * @param shell - Shell executable path or name
 *
 * @returns Object with `path` and `arg` array for the guest-exec payload
 *
 * @example
 * ```ts
 * execArgs({ osFamily: 'linux', shell: '/bin/bash', command: 'uname -a' });
 * // => { path: '/bin/bash', arg: ['-c', 'uname -a'] }
 *
 * execArgs({ osFamily: 'windows', shell: 'powershell.exe', command: 'hostname' });
 * // => { path: 'powershell.exe', arg: ['-NoProfile', '-NonInteractive', '-Command', 'hostname'] }
 * ```
 */
export function execArgs({
  command,
  osFamily,
  shell,
}: {
  readonly command: string;
  readonly osFamily: string;
  readonly shell: string;
},): {
  arg: readonly string[];
  path: string;
} {
  if (osFamily === 'windows') {
    return {
      arg: [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        command,
      ],
      path: shell,
    };
  }
  return {
    arg: [
      '-c',
      command,
    ],
    path: shell,
  };
}
