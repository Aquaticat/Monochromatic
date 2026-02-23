/**
 * Public API for executing generated TypeScript in a throwaway locked-down container.
 *
 * Uses podman (falls back to docker) with:
 * - No network access (--network=none)
 * - Read-only root filesystem (--read-only)
 * - Dropped capabilities (--cap-drop=ALL)
 * - Strict timeout to prevent infinite loops
 * - tmpfs for /tmp so bun can write temp files despite read-only root
 */
import { mkdtemp, rm, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { execContainer, } from './container-exec.ts';
import { CONTAINER_IMAGE, CONTAINER_TIMEOUT_SECONDS, } from './container-runtime.ts';

export type { ContainerResult, } from './container-exec.ts';

import type { ContainerResult, } from './container-exec.ts';

//region Temp directory

/**
 * Creates a temporary directory that cleans itself up via `await using`.
 * @returns async disposable with the directory path
 */
async function makeTempDir(): Promise<AsyncDisposable & { readonly path: string }> {
  const path = await mkdtemp(join(tmpdir(), 'canary-run-'));
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, });
    },
  };
}

//endregion Temp directory

//region Public API

/**
 * Runs a TypeScript source string inside a locked-down container.
 *
 * Writes source and optional stdin to temp files on the host, then bind-mounts
 * them read-only into the container. File-based injection avoids shell escaping issues
 * that corrupt backticks and template literals in generated code.
 *
 * @param source - TypeScript source code to execute
 * @param stdinData - optional stdin data to pipe to the script
 * @returns execution result with stdout, stderr, exit code
 */
export async function runInContainer(source: string, stdinData?: string): Promise<ContainerResult> {
  await using tempResource = await makeTempDir();
  const tempDir = tempResource.path;

  await writeFile(join(tempDir, 'canary.ts'), source, 'utf8');

  // cat preserves content exactly; cp can mangle encoding on some filesystems
  const shellScript = stdinData !== undefined
    ? 'cat /mnt/canary.ts > /tmp/canary.ts && bun run /tmp/canary.ts < /mnt/stdin.txt'
    : 'cat /mnt/canary.ts > /tmp/canary.ts && bun run /tmp/canary.ts';

  if (stdinData !== undefined) {
    await writeFile(join(tempDir, 'stdin.txt'), stdinData, 'utf8');
  }

  return execContainer([
    'run', '--rm', '--network=none', '--read-only', '--cap-drop=ALL',
    // exec needed because bun JIT-compiles TypeScript
    '--tmpfs', '/tmp:rw,exec,size=64m',
    '--memory=256m',
    '--timeout', String(CONTAINER_TIMEOUT_SECONDS),
    '--workdir', '/tmp',
    // :Z relabels for SELinux (Fedora/RHEL); :ro for safety
    '-v', `${tempDir}:/mnt:ro,Z`,
    CONTAINER_IMAGE, 'sh', '-c', shellScript,
  ]);
}

//endregion Public API
