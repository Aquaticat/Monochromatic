/**
 * Inline Nushell sequencer used by Stryker's command runner.
 *
 * @example
 * ```ts
 * buildNuCommand();
 * ```
 */

/**
 * Environment variable carrying JSON array of package-relative test files.
 */
export const TEST_FILES_ENV: string = 'MUTATION_TEST_FILES_JSON';

/**
 * Inline Nushell program that executes each selected test file with plain Node.
 */
export const INLINE_NU_SCRIPT: string = `let tests = ($env.${TEST_FILES_ENV} | from json)

for test in $tests {
  let result = (do -i { ^node $test } | complete)

  if $result.stdout != '' {
    print --no-newline $result.stdout
  }

  if $result.stderr != '' {
    print --stderr --no-newline $result.stderr
  }

  if $result.exit_code != 0 {
    exit $result.exit_code
  }
}`;

/**
 * Quotes one token for POSIX shell parsing.
 *
 * Stryker's command runner executes a single shell string through
 * `child_process.exec`, so the static Nushell program must become one
 * exact `nu -c` argument. Single-quote wrapping is the destination grammar;
 * embedded single quotes close, escape, and reopen the quoted token.
 *
 * @param token - Token to pass through POSIX shell.
 *
 * @returns Shell-safe token preserving byte content.
 *
 * @example
 * ```ts
 * quotePosixShellToken("a'b");
 * // "'a'\\''b'"
 * ```
 */
export function quotePosixShellToken(token: string,): string {
  return `'${token.split("'",)
    .join(String.raw`'\''`,)}'`;
}

/**
 * Builds the Stryker command-runner shell string.
 *
 * @returns Shell command that passes {@link INLINE_NU_SCRIPT} as one `nu -c` argument.
 *
 * @example
 * ```ts
 * buildNuCommand();
 * // "nu -c 'let tests = ...'"
 * ```
 */
export function buildNuCommand(): string {
  return `nu -c ${quotePosixShellToken(INLINE_NU_SCRIPT,)}`;
}
