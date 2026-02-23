/**
 * Container runtime detection and configuration constants.
 *
 * Detects podman (preferred) or docker synchronously using Bun.which, which
 * reads PATH without spawning a subprocess. Other container submodules import
 * the resolved CONTAINER_RUNTIME from here.
 */

//region Configuration -- timeout, image tag, and buffer size shared by container-exec.ts

/** Container execution timeout in seconds */
export const CONTAINER_TIMEOUT_SECONDS = 15;

/** Host-side timeout buffer above the container timeout */
export const HOST_TIMEOUT_BUFFER_SECONDS = 5;

// Pin to 1.3 rather than :latest to prevent silent breakage from bun major releases
/** Container image with bun pre-installed */
export const CONTAINER_IMAGE = 'docker.io/oven/bun:1.3';

/** Max output buffer size in bytes */
export const MAX_BUFFER_BYTES = 1024 * 1024;

//endregion Configuration

//region Runtime detection -- uses Bun.which to avoid spawning a subprocess just to find an executable

/**
 * Detects whether podman or docker is available on the host.
 *
 * Uses synchronous `Bun.which` (reads PATH, no subprocess) rather than
 * spawning `which podman` which requires a full process round-trip.
 * @returns name of the available container runtime binary
 * @throws if neither podman nor docker is found on PATH
 */
function detectRuntime(): string {
  for (const runtime of ['podman', 'docker'] as const) {
    const resolved = Bun.which(runtime);
    if (resolved !== null) {
      console.log(`    [container] using runtime: ${resolved}`);
      return runtime;
    }
    console.log(`    [container] ${runtime} not found on PATH`);
  }
  throw new Error('Neither podman nor docker found. Install one to run code-gen probes.');
}

/** Resolved container runtime binary name, detected at module load time */
export const CONTAINER_RUNTIME = detectRuntime();

//endregion Runtime detection
