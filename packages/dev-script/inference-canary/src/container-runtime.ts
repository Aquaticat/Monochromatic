/**
 * Container runtime detection and configuration constants.
 *
 * Detects podman (preferred) or docker synchronously by checking PATH.
 * Other container submodules import the resolved CONTAINER_RUNTIME from here.
 */

import { execFileSync, } from 'node:child_process';

//region Configuration -- timeout, image tag, and buffer size shared by container-exec.ts

/** Container execution timeout in seconds */
export const CONTAINER_TIMEOUT_SECONDS = 15;

/** Host-side timeout buffer above the container timeout */
export const HOST_TIMEOUT_BUFFER_SECONDS = 5;

// Pin to 1.3 rather than :latest to prevent silent breakage from bun major releases
/** Container image with bun pre-installed */
export const CONTAINER_IMAGE = 'docker.io/oven/bun:1.3';

//endregion Configuration

//region Runtime detection -- uses `which` to locate executables on PATH

/**
 * Lookup command for finding executables on PATH.
 * `where.exe` on Windows, `which` everywhere else.
 */
const WHICH_CMD = process.platform === 'win32' ? 'where.exe' : 'which';

/**
 * Checks whether a binary exists on PATH.
 *
 * Uses `where.exe` on Windows and `which` on Unix.
 *
 * @param name - binary name to search for
 *
 * @returns absolute path to the binary, or null if not found
 *
 * @example
 * ```ts
 * whichSync('podman'); // => "/usr/bin/podman" or null
 * ```
 */
function whichSync(name: string,): string | null {
  try {
    // `where.exe` may return multiple lines; take the first match
    /** First line of which output, containing the resolved binary path. */
    const [firstLine,] = execFileSync(WHICH_CMD, [name,], { encoding: 'utf8', },)
      .trim()
      .split('\n',);
    if (firstLine === undefined)
      return null;
    return firstLine.trim();
  }
  catch {
    return null;
  }
}

/**
 * Detects whether podman or docker is available on the host.
 *
 * @returns name of the available container runtime binary
 *
 * @throws if neither podman nor docker is found on PATH
 */
function detectRuntime(): string {
  for (const runtime of ['podman', 'docker',] as const) {
    const resolved = whichSync(runtime,);
    if (resolved !== null) {
      console.log(`    [container] using runtime: ${resolved}`,);
      return runtime;
    }
    console.log(`    [container] ${runtime} not found on PATH`,);
  }
  throw new Error(
    'Neither podman nor docker found. Install one to run code-gen probes.',
  );
}

/** Resolved container runtime binary name, detected at module load time */
export const CONTAINER_RUNTIME = detectRuntime();

//endregion Runtime detection
