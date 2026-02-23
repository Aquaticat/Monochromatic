/**
 * Low-level container execution: runs a command in the container runtime and
 * returns structured output including stdout, stderr, exit code, and timeout status.
 */
import { execFileAsync, } from './container-base.ts';
import {
  CONTAINER_RUNTIME,
  CONTAINER_TIMEOUT_SECONDS,
  HOST_TIMEOUT_BUFFER_SECONDS,
  MAX_BUFFER_BYTES,
} from './container-runtime.ts';

/** Result of running generated code in a container */
export type ContainerResult = {
  /** Combined stdout output */
  readonly stdout: string;
  /** Combined stderr output */
  readonly stderr: string;
  /** Process exit code (0 = success) */
  readonly exitCode: number;
  /** Whether the container was killed due to timeout */
  readonly timedOut: boolean;
};

/**
 * Executes the container command and captures stdout/stderr/exit-code.
 *
 * Resolves on any exit code (including non-zero) -- callers check exitCode/timedOut.
 * @param containerArgs - fully-formed arguments for the container runtime binary
 * @returns container execution result
 */
export async function execContainer(containerArgs: readonly string[]): Promise<ContainerResult> {
  console.log(`    [container] running with ${CONTAINER_RUNTIME}...`);

  try {
    const { stdout, stderr, } = await execFileAsync(
      CONTAINER_RUNTIME,
      containerArgs as string[],
      {
        timeout: (CONTAINER_TIMEOUT_SECONDS + HOST_TIMEOUT_BUFFER_SECONDS) * 1000,
        maxBuffer: MAX_BUFFER_BYTES,
        encoding: 'utf8',
      },
    );
    return { stdout, stderr, exitCode: 0, timedOut: false, };
  } catch (error) {
    // Use { unknown } casts to avoid relying on NodeJS.ErrnoException's narrower typings
    // (killed is not on ErrnoException; code is typed string | undefined but is a number here)
    const killedFlag = error instanceof Error && 'killed' in error
      ? (error as { killed: unknown }).killed
      : undefined;
    /** Whether the process was killed due to timeout */
    const timedOut = killedFlag === true;

    const codeValue = error instanceof Error && 'code' in error
      ? (error as { code: unknown }).code
      : undefined;
    /** Exit code, defaulting to 1 on unrecognized error shape */
    const exitCode = typeof codeValue === 'number' ? codeValue : 1;
    const stdout = error instanceof Error && 'stdout' in error
      ? String((error as { stdout: unknown }).stdout)
      : '';
    const stderr = error instanceof Error && 'stderr' in error
      ? String((error as { stderr: unknown }).stderr)
      : '';

    console.error(`    [container] exit=${String(exitCode)} timedOut=${String(timedOut)}`);
    if (stderr.length > 0) console.error(`    [container] stderr: ${stderr.slice(0, 200)}`);

    return { stdout, stderr, exitCode, timedOut, };
  }
}
