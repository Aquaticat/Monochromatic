/**
 * Base execution helper using Bun-native process APIs.
 *
 * Avoids the promisify(execFile) pattern since this package runs under Bun,
 * which provides Bun.spawn as a first-class Promise-based API. Kept as a
 * shared module so container-exec.ts has a single import rather than
 * duplicating the Bun.spawn boilerplate.
 */

/** Result of a Bun-spawned command -- never throws, callers inspect exitCode */
export type BunExecResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  /** True when the process was killed by our timeout, not by a natural exit */
  readonly killed: boolean;
};

/** Options for Bun-native command execution */
export type BunExecOptions = {
  /** Milliseconds before the process is forcibly killed */
  readonly timeout?: number;
  /**
   * Abort signal -- kills the process immediately when aborted.
   * Used to propagate probe timeouts into container subprocesses.
   */
  readonly signal?: AbortSignal | undefined;
};

/**
 * Runs a command via Bun.spawn, capturing stdout and stderr separately.
 *
 * Never throws -- callers check `exitCode` and `killed` to decide what to do.
 * This is preferable to the promisify(execFile) pattern because it uses
 * Bun's native process API and avoids extracting error properties from a
 * thrown Error object.
 * @param command - executable name or absolute path
 * @param args - command arguments
 * @param options - optional timeout
 * @returns execution result with stdout, stderr, exit code, and killed flag
 */
export async function execBun(
  command: string,
  args: readonly string[],
  options: BunExecOptions = {},
): Promise<BunExecResult> {
  // Fast-path: if the signal is already aborted, skip spawning entirely.
  if (options.signal?.aborted === true) {
    return { stdout: '', stderr: '', exitCode: 1, killed: true, };
  }

  const proc = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe', });

  // let: the timeout callback and abort handler both assign true; const prevents that mutation
  let killed = false;
  const killProc = (): void => { killed = true; proc.kill(); };
  const timer = options.timeout !== undefined ? setTimeout(killProc, options.timeout) : undefined;
  options.signal?.addEventListener('abort', killProc);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (timer !== undefined) clearTimeout(timer);
  options.signal?.removeEventListener('abort', killProc);

  return { stdout, stderr, exitCode, killed, };
}
