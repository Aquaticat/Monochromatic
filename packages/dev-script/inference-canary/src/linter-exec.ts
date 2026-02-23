/**
 * Shared Bun-native exec helper for lint and type-check runners.
 *
 * Uses Bun.spawn instead of promisify(execFile) since this package runs under Bun.
 * On a non-zero exit the thrown error has `.stdout` and `.stderr` attached --
 * callers (linter-oxlint.ts, linter-tsgo.ts) extract diagnostic output from
 * tools that exit non-zero when they find issues.
 */

/** Options for linter exec invocations */
type LintExecOptions = {
  /** Milliseconds before the process is forcibly killed */
  readonly timeout?: number;
};

/**
 * Runs a linting command and returns its stdout.
 *
 * Throws on non-zero exit with `.stdout` and `.stderr` attached to the error,
 * since lint tools (oxlint, tsgo) exit 1 when they find violations and write
 * their findings to stdout as structured output (JSON, diagnostics).
 * @param command - lint tool executable
 * @param args - tool arguments
 * @param options - optional timeout
 * @returns stdout string on success
 * @throws with `.stdout` and `.stderr` attached on non-zero exit
 */
export async function execPromise(
  command: string,
  args: readonly string[],
  options: LintExecOptions = {},
): Promise<string> {
  const proc = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe', });

  // let: the timeout callback assigns true; const would prevent that mutation
  let killed = false;
  const timer = options.timeout !== undefined
    ? setTimeout(() => { killed = true; proc.kill(); }, options.timeout)
    : undefined;

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (timer !== undefined) clearTimeout(timer);

  if (exitCode !== 0) {
    throw Object.assign(
      new Error(`${command} exited ${String(exitCode)}${killed ? ' (killed)' : ''}: ${stderr}`),
      { stdout, stderr, },
    );
  }

  return stdout;
}
