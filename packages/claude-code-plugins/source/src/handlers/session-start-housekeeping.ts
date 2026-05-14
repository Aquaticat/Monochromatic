import type {
  SessionStartInput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import {
  glob,
  lstat,
  mkdir,
  rm,
} from 'node:fs/promises';

import { parseHookJson, } from '../runtime/handler-runtime.ts';

/**
 * Stale artifact names that git metadata or Claude config can leak into nested
 * `dist/final/` directories. Removed on session start to prevent build contamination.
 */
const STALE_DIST_ARTIFACTS = [
  'HEAD',
  'config',
  'hooks',
  'objects',
  'refs',
  '.claude',
];

/**
 * Zero-byte Claude Code sandbox sentinels that can appear at the workspace root.
 * These names overlap with Git's internal metadata, so they are cleaned only
 * when they are exact root-level empty regular files.
 */
const ROOT_SENTINEL_ARTIFACTS = [
  'HEAD',
  'config',
  'hooks',
  'objects',
  'refs',
] as const;

/**
 * Creates a directory if it does not already exist (equivalent to `mkdir -p`).
 *
 * @param dirPath - absolute path of directory to ensure exists
 *
 * @example
 * ```ts
 * await ensureDir('/tmp/claude');
 * ```
 */
async function ensureDir(dirPath: string,): Promise<void> {
  await mkdir(
    dirPath,
    { recursive: true, },
  );
}

/**
 * Removes stale git metadata and Claude config directories from all nested
 * `dist/final/` paths under `packages/`. Uses `node:fs/promises` glob to find
 * matching paths and removes them recursively.
 *
 * @param workspaceRoot - absolute path to the monorepo root
 *
 * @example
 * ```ts
 * await cleanDistArtifacts('/var/home/user/Monochromatic');
 * ```
 */
async function cleanDistArtifacts(workspaceRoot: string,): Promise<void> {
  /** Pending `rm` operations across every matched `dist/final/<artifact>`, awaited concurrently below. */
  const removals: Promise<void>[] = [];

  for await (const finalDir of glob(
    'packages/*/*/dist/final',
    { cwd: workspaceRoot, },
  )) {
    for (const artifact of STALE_DIST_ARTIFACTS) {
      removals.push(
        rm(
          `${workspaceRoot}/${finalDir}/${artifact}`,
          {
            recursive: true,
            force: true,
          },
        ),
      );
    }
  }

  await Promise.all(removals,);
}

/**
 * Returns true when an unknown caught error is an ENOENT filesystem miss.
 *
 * @param error - caught exception from a filesystem operation
 *
 * @returns whether the error has `code === 'ENOENT'`
 */
function isMissingPathError(error: unknown,): boolean {
  if ((typeof error) !== 'object')
    return false;

  if (error === null)
    return false;

  if (!('code' in error))
    return false;

  return error.code === 'ENOENT';
}

/**
 * Removes a single root sentinel only when it is a zero-byte regular file.
 *
 * @param artifactPath - absolute path to one root sentinel candidate
 */
async function cleanRootSentinelArtifact(artifactPath: string,): Promise<void> {
  try {
    /** Candidate stat, read with `lstat` so symlinks are preserved. */
    const stats = await lstat(artifactPath,);

    if ((!stats.isFile()) || (stats.size > 0))
      return;

    await rm(
      artifactPath,
      { force: true, },
    );
  }
  catch (error: unknown) {
    if (isMissingPathError(error,))
      return;

    throw error;
  }
}

/**
 * Removes root-level zero-byte Claude Code sandbox sentinel files.
 *
 * @param workspaceRoot - absolute path to the monorepo root
 *
 * @example
 * ```ts
 * await cleanRootSentinelArtifacts('/var/home/user/Monochromatic');
 * ```
 */
async function cleanRootSentinelArtifacts(workspaceRoot: string,): Promise<void> {
  await Promise.all(
    ROOT_SENTINEL_ARTIFACTS.map(function cleanArtifact(artifact,): Promise<void> {
      return cleanRootSentinelArtifact(`${workspaceRoot}/${artifact}`,);
    },),
  );
}

/**
 * Removes the ephemeral `.mcp.json` file from the workspace root. Regenerated
 * each session and must not persist across sessions.
 *
 * @param workspaceRoot - absolute path to the monorepo root
 *
 * @example
 * ```ts
 * await removeMcpJson('/var/home/user/Monochromatic');
 * ```
 */
async function removeMcpJson(workspaceRoot: string,): Promise<void> {
  await rm(
    `${workspaceRoot}/.mcp.json`,
    { force: true, },
  );
}

/**
 * Output is `void`: the housekeeping handler performs filesystem side effects
 * and writes nothing to stdout. The runtime invokes `sessionStartHousekeepingWriter`
 * which returns an empty string, matching the legacy hook's wire behavior.
 */
type SessionStartHousekeepingOutput = void;

/**
 * Performs session-start housekeeping in parallel:
 *
 * - Ensures `/tmp/claude` and `/tmp/claude-1000` exist
 * - Removes stale git metadata leaked into nested `dist/final/` directories
 * - Removes zero-byte Claude Code sandbox sentinels from the workspace root
 * - Removes the ephemeral `.mcp.json` from the workspace root
 *
 * Side-effecting by design; returns nothing. The runtime treats `void` outputs
 * as empty stdout via the corresponding writer.
 *
 * @param event - parsed SessionStart event from Claude Code
 *
 * @returns nothing; runtime emits empty stdout via the writer
 *
 * @example
 * ```ts
 * await sessionStartHousekeepingHandler({ cwd: '/repo', source: 'startup', ... });
 * ```
 */
async function sessionStartHousekeepingHandler(
  event: SessionStartInput,
): Promise<SessionStartHousekeepingOutput> {
  /** Monorepo root, derived from the SessionStart event's `cwd` field. */
  const workspaceRoot = event.cwd;
  await Promise.all([
    ensureDir('/tmp/claude',),
    ensureDir('/tmp/claude-1000',),
    cleanDistArtifacts(workspaceRoot,),
    cleanRootSentinelArtifacts(workspaceRoot,),
    removeMcpJson(workspaceRoot,),
  ],);
}

/**
 * Parses raw stdin as a `SessionStartInput`.
 *
 * Input is trusted; it comes from Claude Code's hook dispatch system.
 *
 * @param raw - JSON payload from Claude Code stdin
 *
 * @returns parsed SessionStart event
 *
 * @example
 * ```ts
 * const event = sessionStartHousekeepingParser(await text(process.stdin));
 * ```
 */
function sessionStartHousekeepingParser(raw: string,): SessionStartInput {
  return parseHookJson<SessionStartInput>(raw,);
}

/**
 * Returns an empty string; the legacy hook produced no stdout, and the runtime
 * shell writes whatever this returns verbatim.
 *
 * @param _output - ignored handler result (housekeeping has no stdout)
 *
 * @returns empty string
 *
 * @example
 * ```ts
 * sessionStartHousekeepingWriter(); // ''
 * ```
 */
function sessionStartHousekeepingWriter(
  _output: SessionStartHousekeepingOutput,
): string {
  return '';
}

export type { SessionStartHousekeepingOutput, };

export {
  cleanRootSentinelArtifacts,
  ROOT_SENTINEL_ARTIFACTS,
  sessionStartHousekeepingHandler,
  sessionStartHousekeepingParser,
  sessionStartHousekeepingWriter,
};
