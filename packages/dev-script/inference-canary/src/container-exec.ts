/**
 * Low-level container execution: runs a command in the container runtime and
 * returns structured output including stdout, stderr, exit code, and timeout status.
 */
import { execBun, } from './container-base.ts';
import {
  CONTAINER_RUNTIME,
  CONTAINER_TIMEOUT_SECONDS,
  HOST_TIMEOUT_BUFFER_SECONDS,
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

  /** Total host-side timeout: container limit plus a buffer for startup/teardown */
  const timeoutMs = (CONTAINER_TIMEOUT_SECONDS + HOST_TIMEOUT_BUFFER_SECONDS) * 1000;
  const result = await execBun(CONTAINER_RUNTIME, containerArgs, { timeout: timeoutMs, });

  if (result.exitCode !== 0 || result.killed) {
    console.error(`    [container] exit=${String(result.exitCode)} timedOut=${String(result.killed)}`);
    if (result.stderr.length > 0) {
      console.error(`    [container] stderr: ${result.stderr.slice(0, 200)}`);
    }
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.killed,
  };
}
