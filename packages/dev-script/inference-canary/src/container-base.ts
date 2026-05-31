/**
 * Base execution helper using nano-spawn for cross-runtime process management.
 *
 * Kept as a shared module so container-exec.ts has a single import rather than
 * duplicating the spawn boilerplate.
 */

import spawn from 'nano-spawn';

/**
 * Result of a spawned command (never throws; callers inspect exitCode)
 */
export type BunExecResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  /**
   * True when the process was killed by our timeout, not by a natural exit
   */
  readonly killed: boolean;
};

/**
 * Options for Bun-native command execution
 */
export type BunExecOptions = {
  /**
   * Milliseconds before the process is forcibly killed
   */
  readonly timeout?: number;
  /**
   * Abort signal; kills the process immediately when aborted.
   * Used to propagate probe timeouts into container subprocesses.
   */
  readonly signal?: AbortSignal;
};

/**
 * Options for {@link execBun}.
 *
 * @example
 * ```ts
 * const opts: ExecBunOptions = {
 *   command: 'echo',
 *   args: ['hello'],
 *   options: { timeout: 5000 },
 * };
 * ```
 */
type ExecBunOptions = {
  /**
   * Executable name or absolute path
   */
  readonly command: string;
  /**
   * Command arguments
   */
  readonly args: readonly string[];
  /**
   * Optional timeout and abort signal
   */
  readonly options?: BunExecOptions;
};

/**
 * Runs a command via nano-spawn, capturing stdout and stderr separately.
 *
 * Never throws; callers check `exitCode` and `killed` to decide what to do.
 *
 * @param command - executable name or absolute path
 *
 * @param args - command arguments
 *
 * @param options - optional timeout and abort signal
 *
 * @returns execution result with stdout, stderr, exit code, and killed flag
 *
 * @example
 * ```ts
 * const result = await execBun({ command: 'echo', args: ['hello'] });
 * result.stdout; // "hello\n"
 * ```
 */
export async function execBun({
  command,
  args,
  options = {},
}: ExecBunOptions,): Promise<BunExecResult> {
  // Fast-path: if the signal is already aborted, skip spawning entirely.
  if (options.signal
    ?.aborted
    === true) {
    return {
      stdout: '',
      stderr: '',
      exitCode: 1,
      killed: true,
    };
  }

  try {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- nano-spawn accepts mutable string array */
    /**
     * Successful spawn result; reshaped into a `BunExecResult` so callers see the same shape on success and failure.
     */
    const result = await spawn(
      command,
      args as string[],
      {
        timeout: options.timeout,
        signal: options.signal,
      },
    );
    /* oxlint-enable typescript/no-unsafe-type-assertion */

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      killed: false,
    };
  }
  catch (error: unknown) {
    // nano-spawn throws SubprocessError on non-zero exit
    if ((error !== null)
      && (error !== undefined)
      && ((typeof error) === 'object')
      && ('exitCode' in error))
    {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- nano-spawn SubprocessError has known shape */
      /**
       * Narrowed view of the caught nano-spawn `SubprocessError`; carries stdout, stderr, exit code, and signal name.
       */
      const subprocessError = error as {
        stdout: string;
        stderr: string;
        exitCode?: number;
        signalName?: string;
      };
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      // Killed if the signal was aborted (race: it may have become true after spawn started)
      // or the process received a termination signal
      /**
       * True when the abort signal fired or the process received a termination signal; surfaced to callers as `BunExecResult.killed`.
       */
      const wasKilled = Boolean(options.signal
        ?.aborted,)
        || (subprocessError.signalName
          !== undefined);

      return {
        stdout: subprocessError.stdout,
        stderr: subprocessError.stderr,
        exitCode: subprocessError.exitCode
          ?? 1,
        killed: wasKilled,
      };
    }

    // Unexpected error (e.g. command not found)
    /**
     * Human-readable error text for the synthetic non-zero result returned to callers.
     */
    const message = error instanceof Error ? error.message : String(error,);

    return {
      stdout: '',
      stderr: message,
      exitCode: 1,
      killed: false,
    };
  }
}
