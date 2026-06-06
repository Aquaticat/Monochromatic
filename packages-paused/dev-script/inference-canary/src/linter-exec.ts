/**
 * Shared exec helper for lint and type-check runners.
 *
 * Delegates to `execBun` from container-base.ts (the single nano-spawn wrapper)
 * and throws on non-zero exit with `.stdout` and `.stderr` attached, since lint
 * tools (oxlint, tsgo) exit 1 when they find violations and write their findings
 * to stdout as structured output (JSON, diagnostics).
 */
import { execBun, } from './container-base.ts';

/**
 * Timeout shared by both oxlint and tsgo runners
 */
export const LINT_TIMEOUT_MS = 15_000;

/**
 * Options for linter exec invocations
 */
type LintExecOptions = {
  /**
   * Milliseconds before the process is forcibly killed
   */
  readonly timeout?: number;
};

/**
 * Extracts the stdout property from an error thrown by `execPromise`.
 *
 * Both oxlint and tsgo exit non-zero when they find issues, so callers need
 * to recover stdout from the thrown error to parse diagnostics.
 *
 * @param error - caught error value
 *
 * @returns stdout string if present, empty string otherwise
 *
 * @example
 * ```ts
 * try { await execPromise('oxlint', ['file.ts']); }
 * catch (error) { const output = getStdoutFromError(error); }
 * ```
 */
export function getStdoutFromError(error: unknown,): string {
  if ((error instanceof Error) && ('stdout' in error))
    return String((error as { stdout: unknown; }).stdout,);
  return '';
}

/**
 * Options for {@link execPromise}.
 *
 * @example
 * ```ts
 * const opts: ExecPromiseOptions = {
 *   command: 'oxlint',
 *   args: ['--format', 'json', 'file.ts'],
 *   options: { timeout: 15000 },
 * };
 * ```
 */
type ExecPromiseOptions = {
  /**
   * Lint tool executable
   */
  readonly command: string;
  /**
   * Tool arguments
   */
  readonly args: readonly string[];
  /**
   * Optional timeout
   */
  readonly options?: LintExecOptions;
};

/**
 * Runs a linting command and returns its stdout.
 *
 * Throws on non-zero exit with `.stdout` and `.stderr` attached to the error,
 * since lint tools (oxlint, tsgo) exit 1 when they find violations and write
 * their findings to stdout as structured output (JSON, diagnostics).
 *
 * @param command - lint tool executable
 *
 * @param args - tool arguments
 *
 * @param options - optional timeout
 *
 * @returns stdout string on success
 *
 * @throws with `.stdout` and `.stderr` attached on non-zero exit
 *
 * @example
 * ```ts
 * const stdout = await execPromise({ command: 'oxlint', args: ['--format', 'json', 'file.ts'] });
 * ```
 */
export async function execPromise({
  command,
  args,
  options = {},
}: ExecPromiseOptions,): Promise<string> {
  /**
   * Forwarded exec options; the `timeout` key is omitted when undefined so callers can detect the unset state downstream.
   */
  const execOptions = options.timeout
    !== undefined ? { timeout: options.timeout, } : {};
  /**
   * Raw exec result; inspected below to surface non-zero exits as thrown errors with stdout/stderr attached.
   */
  const result = await execBun({
    command,
    args,
    options: execOptions,
  },);

  if (result.exitCode
    !== 0) {
    throw Object.assign(
      new Error(
        `${command} exited ${String(result.exitCode,)}${
          result.killed
            ? ' (killed)'
            : ''
        }: ${result.stderr}`,
      ),
      {
        stdout: result.stdout,
        stderr: result.stderr,
      },
    );
  }

  return result.stdout;
}
