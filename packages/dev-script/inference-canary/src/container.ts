/**
 * Executes generated TypeScript in a throwaway locked-down container.
 *
 * Uses podman (falls back to docker) with:
 * - No network access (--network=none)
 * - Read-only root filesystem (--read-only)
 * - Dropped capabilities (--cap-drop=ALL)
 * - Strict timeout to prevent infinite loops
 * - tmpfs for /tmp so bun can write temp files despite read-only root
 * - Workdir set to /tmp so bun can access the current directory
 */
import { execFile, } from 'node:child_process';
import { mkdtemp, rm, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

//region Configuration

/** Container execution timeout in seconds */
const CONTAINER_TIMEOUT_SECONDS = 15;

/** Host-side timeout buffer above the container timeout */
const HOST_TIMEOUT_BUFFER_SECONDS = 5;

/** Container image with bun pre-installed */
const CONTAINER_IMAGE = 'docker.io/oven/bun:latest';

/** Max output buffer size in bytes */
const MAX_BUFFER_BYTES = 1024 * 1024;

/** Runtime to use (podman preferred, docker fallback) */
const CONTAINER_RUNTIME = await detectRuntime();

//endregion Configuration

//region Runtime detection

/**
 * Detects whether podman or docker is available.
 * @returns path to the container runtime binary
 * @throws if neither podman nor docker is found
 */
async function detectRuntime(): Promise<string> {
  for (const runtime of ['podman', 'docker']) {
    try {
      await execPromise('which', [runtime]);
      return runtime;
    } catch {
      // Runtime not found; try next
    }
  }
  throw new Error('Neither podman nor docker found. Install one to run code-gen probes.');
}

//endregion Runtime detection

//region Execution

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
 * Runs a TypeScript source string inside a locked-down container.
 *
 * Writes source and optional stdin to temp files on the host, then bind-mounts
 * them read-only into the container. This avoids base64/shell escaping issues
 * that corrupt backticks and template literals in generated code.
 *
 * @param source - TypeScript source code to execute
 * @param stdinData - optional stdin data to pipe to the script
 * @returns execution result with stdout, stderr, exit code
 */
export async function runInContainer(source: string, stdinData?: string): Promise<ContainerResult> {
  const tempDir = await mkdtemp(join(tmpdir(), 'canary-run-'));
  const sourceFile = join(tempDir, 'canary.ts');
  await writeFile(sourceFile, source, 'utf8');

  // cat preserves content exactly; cp can mangle encoding on some filesystems
  const shellScript = stdinData !== undefined
    ? 'cat /mnt/canary.ts > /tmp/canary.ts && bun run /tmp/canary.ts < /mnt/stdin.txt'
    : 'cat /mnt/canary.ts > /tmp/canary.ts && bun run /tmp/canary.ts';

  if (stdinData !== undefined) {
    await writeFile(join(tempDir, 'stdin.txt'), stdinData, 'utf8');
  }

  const containerArgs = [
    'run',
    '--rm',
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    // exec needed because bun JIT-compiles TypeScript
    '--tmpfs', '/tmp:rw,exec,size=64m',
    '--memory=256m',
    '--timeout', String(CONTAINER_TIMEOUT_SECONDS),
    '--workdir', '/tmp',
    // :Z relabels for SELinux (Fedora/RHEL); :ro for safety
    '-v', `${tempDir}:/mnt:ro,Z`,
    CONTAINER_IMAGE,
    'sh', '-c', shellScript,
  ];

  try {
    return await execContainer(containerArgs);
  } finally {
    await rm(tempDir, { recursive: true, force: true, });
  }
}

/**
 * Executes the container command and captures output.
 * @param containerArgs - arguments for the container runtime
 * @returns container execution result
 */
function execContainer(containerArgs: readonly string[]): Promise<ContainerResult> {
  return new Promise((resolve) => {
    console.log(`    [container] running with ${CONTAINER_RUNTIME}...`);

    execFile(
      CONTAINER_RUNTIME,
      containerArgs,
      {
        timeout: (CONTAINER_TIMEOUT_SECONDS + HOST_TIMEOUT_BUFFER_SECONDS) * 1000,
        maxBuffer: MAX_BUFFER_BYTES,
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        /** Whether the process was killed due to timeout */
        const timedOut = error !== null && 'killed' in error && error.killed === true;
        /** Exit code, defaulting to 1 on error */
        const exitCode = error !== null && 'code' in error && typeof error.code === 'number'
          ? error.code
          : error !== null ? 1 : 0;

        if (error !== null) {
          console.log(`    [container] exit=${String(exitCode)} timedOut=${String(timedOut)}`);
          if (String(stderr).length > 0) {
            console.log(`    [container] stderr: ${String(stderr).slice(0, 200)}`);
          }
        }

        resolve({
          stdout: String(stdout),
          stderr: String(stderr),
          exitCode,
          timedOut,
        });
      },
    );
  });
}

//endregion Execution

//region Helpers

/**
 * Promisified execFile for runtime detection.
 * @param command - command to run
 * @param args - command arguments
 * @returns stdout string
 */
function execPromise(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', }, (error, stdout) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve(String(stdout));
    });
  });
}

//endregion Helpers
