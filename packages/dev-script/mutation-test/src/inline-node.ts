/**
 * Inline Node sequencer used by Stryker's command runner.
 *
 * @example
 * ```ts
 * buildNodeCommand();
 * ```
 */

/**
 * Environment variable carrying JSON array of package-relative test files.
 */
export const TEST_FILES_ENV: string = 'MUTATION_TEST_FILES_JSON';

/**
 * Inline Node program that executes each selected test file with plain Node.
 *
 * Runs each file in order under `node`, streams its stdout/stderr through, and
 * exits with the first failing file's exit code (so Stryker sees the failure).
 */
export const INLINE_NODE_SCRIPT: string = `const { execFileSync } = require('node:child_process');
const tests = JSON.parse(process.env.${TEST_FILES_ENV});
for (const test of tests) {
  try {
    execFileSync('node', [test], { stdio: 'inherit' });
  }
  catch (error) {
    process.exit(typeof error.status === 'number' ? error.status : 1);
  }
}`;

/**
 * Quotes one token for POSIX shell parsing.
 *
 * Stryker's command runner executes a single shell string through
 * `child_process.exec`, so the static Node program must become one exact
 * `node -e` argument. Single-quote wrapping is the destination grammar;
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
 * @returns Shell command that passes {@link INLINE_NODE_SCRIPT} as one `node -e` argument.
 *
 * @example
 * ```ts
 * buildNodeCommand();
 * // "node -e 'const { execFileSync } = ...'"
 * ```
 */
export function buildNodeCommand(): string {
  return `node -e ${quotePosixShellToken(INLINE_NODE_SCRIPT,)}`;
}
