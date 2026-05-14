#!/usr/bin/env bun
/**
 * Signs the container image with cosign and pushes it to GHCR.
 * Separate from `build-and-import.ts` because cosign signatures are OCI artifacts
 * that must be pushed to a registry; they cannot exist in local podman storage alone.
 *
 * Run: mise run //packages/dev-script/vm-builder:push
 *
 * Prerequisites:
 * - Image already built via `mise run //packages/dev-script/vm-builder:run`
 * - `cosign` installed
 * - `podman login ghcr.io` completed
 * - Cosign key pair at `packages/config/cosign/`
 */
import { findMonorepoRootCached, } from '@monochromatic-dev/module-fs-path/find-monorepo-root';
import { spawn as nodeSpawn, } from 'node:child_process';
import { once, } from 'node:events';
import { join, } from 'node:path';

/** Local image tag to push. */
const IMAGE_TAG = 'localhost/monochromatic-dev:latest';

/** GHCR image reference. Change this to match your GitHub username/org. */
const GHCR_TAG = 'ghcr.io/aquaticat/monochromatic-dev:latest';

/** Absolute path to the monorepo root. */
const MONOREPO_ROOT = await findMonorepoRootCached();

/** Path to the cosign private key for image signing. */
const COSIGN_KEY = join(
  MONOREPO_ROOT,
  'packages',
  'config',
  'cosign',
  'cosign.key',
);

/**
 * Spawns a command with inherited stdio so output streams to the terminal in real time.
 *
 * @param cmd - Executable name
 *
 * @param args - Arguments passed to the command
 *
 * @throws When the command exits with a non-zero code
 *
 * @example
 * ```ts
 * await run({ cmd: 'podman', args: ['push', 'ghcr.io/...'] });
 * ```
 */
async function run(
  {
    cmd,
    args,
  }: {
    cmd: string;
    args: readonly string[];
  },
): Promise<void> {
  const child = nodeSpawn(
    cmd,
    [...args,],
    { stdio: 'inherit', },
  );
  // oxlint-disable-next-line typescript-eslint(no-unsafe-assignment) -- node:events once() returns Promise<any[]>; close event always passes [code: number | null, signal: string | null]
  const [code,] = await once(
    child,
    'close',
  );
  if (code !== 0)
    throw new Error(`${cmd} exited with code ${String(code,)}`,);
}

/**
 * Tags the local image for GHCR and pushes it.
 */
async function pushImage(): Promise<void> {
  console.log(`[vm-builder] tagging ${IMAGE_TAG} as ${GHCR_TAG}...`,);
  await run({
    cmd: 'sudo',
    args: [
      'podman',
      'tag',
      IMAGE_TAG,
      GHCR_TAG,
    ],
  },);

  console.log(`[vm-builder] pushing ${GHCR_TAG}...`,);
  await run({
    cmd: 'sudo',
    args: [
      'podman',
      'push',
      GHCR_TAG,
    ],
  },);
}

/**
 * Signs the pushed image with cosign.
 * The signature is stored as an OCI artifact in the same GHCR repository.
 */
async function signImage(): Promise<void> {
  console.log('[vm-builder] signing image with cosign...',);
  await run({
    cmd: 'sudo',
    args: [
      'env',
      'COSIGN_PASSWORD=',
      'cosign',
      'sign',
      '--key',
      COSIGN_KEY,
      '--tlog-upload=false',
      GHCR_TAG,
    ],
  },);
}

await pushImage();
await signImage();

console.log(`[vm-builder] pushed and signed ${GHCR_TAG}`,);
