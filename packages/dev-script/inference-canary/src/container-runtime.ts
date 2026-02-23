/**
 * Container runtime detection and configuration constants.
 *
 * Detects podman (preferred) or docker at module load time via top-level await.
 * Other container submodules import the resolved CONTAINER_RUNTIME from here.
 */
import { execPromise, } from './container-base.ts';

//region Configuration

/** Container execution timeout in seconds */
export const CONTAINER_TIMEOUT_SECONDS = 15;

/** Host-side timeout buffer above the container timeout */
export const HOST_TIMEOUT_BUFFER_SECONDS = 5;

// Pin to 1.2 rather than :latest to prevent silent breakage from bun major releases
/** Container image with bun pre-installed */
export const CONTAINER_IMAGE = 'docker.io/oven/bun:1.2';

/** Max output buffer size in bytes */
export const MAX_BUFFER_BYTES = 1024 * 1024;

//endregion Configuration

//region Runtime detection

/**
 * Detects whether podman or docker is available on the host.
 * @returns path to the container runtime binary
 * @throws if neither podman nor docker is found
 */
async function detectRuntime(): Promise<string> {
  for (const runtime of ['podman', 'docker']) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential: try podman before docker
      await execPromise('which', [runtime]);
      return runtime;
    } catch {
      // Runtime not found; try next
    }
  }
  throw new Error('Neither podman nor docker found. Install one to run code-gen probes.');
}

/** Resolved container runtime binary path, detected at module load time */
export const CONTAINER_RUNTIME = await detectRuntime();

//endregion Runtime detection
