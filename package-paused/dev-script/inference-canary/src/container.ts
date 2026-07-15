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
import {
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { execContainer, } from './container-exec.ts';
import {
  CONTAINER_IMAGE,
  CONTAINER_TIMEOUT_SECONDS,
} from './container-runtime.ts';
import { LINT_DIR, } from './linter-artifacts.ts';

// oxlint-disable-next-line no-duplicate-imports -- re-export requires a separate import for local use
import type { ContainerResult, } from './container-exec.ts';

export type { ContainerResult, } from './container-exec.ts';

//region Staging directory: uses LINT_DIR instead of os.tmpdir() so all container I/O stays under one well-known tree

/**
 * Creates a staging directory under LINT_DIR that cleans itself up via `await using`.
 *
 * Uses `crypto.randomUUID()` instead of `mkdtemp` to generate a unique subdirectory
 * name without relying on `os.tmpdir()`. Keeping staging files under LINT_DIR means
 * all container I/O is in one place; easier to inspect and already gitignored.
 *
 * @returns async disposable with the staging directory path
 */
async function makeStagingDir(): Promise<AsyncDisposable & { readonly path: string; }> {
  /**
   * Unique staging directory under `LINT_DIR`; exposed on the returned disposable and removed at dispose time.
   */
  const path = join(
    LINT_DIR,
    '_tmp',
    crypto.randomUUID(),
  );
  await mkdir(
    path,
    { recursive: true, },
  );
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

//endregion Staging directory

//region Public API: runInContainer is the sole entry point for executing generated code

/**
 * Options for {@link runInContainer}.
 *
 * @example
 * ```ts
 * const options: RunInContainerOptions = {
 *   source: 'console.log("hello");',
 *   stdinData: 'optional input',
 *   signal: undefined,
 * };
 * ```
 */
type RunInContainerOptions = {
  /**
   * TypeScript source code to execute
   */
  readonly source: string;
  /**
   * Optional stdin data to pipe to the script
   */
  readonly stdinData?: string;
  /**
   * Abort signal; kills the container immediately when aborted, or absent to disable
   */
  readonly signal?: AbortSignal;
};

/**
 * Runs a TypeScript source string inside a locked-down container.
 *
 * Writes source and optional stdin to staging files on the host, then bind-mounts
 * them read-only into the container. File-based injection avoids shell escaping issues
 * that corrupt backticks and template literals in generated code.
 *
 * @param source - TypeScript source code to execute
 *
 * @param stdinData - optional stdin data to pipe to the script
 *
 * @param signal - optional abort signal; kills the container immediately when aborted
 *
 * @returns execution result with stdout, stderr, exit code
 *
 * @example
 * ```ts
 * const result = await runInContainer({ source: 'console.log("hello");' });
 * result.stdout; // "hello\n"
 * ```
 */
export async function runInContainer({
  source,
  stdinData,
  signal,
}: RunInContainerOptions,): Promise<ContainerResult> {
  /**
   * Disposable staging directory; cleaned up automatically when this function returns.
   */
  await using stagingResource = await makeStagingDir();
  /**
   * Host path holding `canary.ts` and (optionally) `stdin.txt`; bind-mounted read-only into the container.
   */
  const stagingDir = stagingResource.path;

  await writeFile(
    join(
      stagingDir,
      'canary.ts',
    ),
    source,
    'utf8',
  );

  // cat preserves content exactly; cp can mangle encoding on some filesystems
  /**
   * Inline `sh -c` script that copies the read-only source into the tmpfs and runs it, optionally piping stdin from the host.
   */
  const shellScript = stdinData !== undefined
    ? 'cat /mnt/canary.ts > /tmp/canary.ts && bun run /tmp/canary.ts < /mnt/stdin.txt'
    : 'cat /mnt/canary.ts > /tmp/canary.ts && bun run /tmp/canary.ts';

  if (stdinData !== undefined) {
    await writeFile(
      join(
        stagingDir,
        'stdin.txt',
      ),
      stdinData,
      'utf8',
    );
  }

  return await execContainer({
    containerArgs: [
      'run',
      '--rm',
      '--network=none',
      '--read-only',
      '--cap-drop=ALL',
      // exec needed because bun JIT-compiles TypeScript
      '--tmpfs',
      '/tmp:rw,exec,size=64m',
      '--memory=256m',
      '--timeout',
      String(CONTAINER_TIMEOUT_SECONDS,),
      '--workdir',
      '/tmp',
      // :Z relabels for SELinux (Fedora/RHEL); :ro for safety
      '-v',
      `${stagingDir}:/mnt:ro,Z`,
      CONTAINER_IMAGE,
      'sh',
      '-c',
      shellScript,
    ],
    ...((signal !== undefined) ? { signal, } : {}),
  },);
}

//endregion Public API
