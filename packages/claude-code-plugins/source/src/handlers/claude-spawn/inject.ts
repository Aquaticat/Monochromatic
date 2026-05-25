/**
 * Shared inject check that scans for completed child sessions
 * and returns context text for the parent.
 *
 * Called from hook handlers with two modes:
 * - **Consuming** (`consume: true`): renames `.json` to `.reported`,
 *   preventing future reads. Used by all delivery hooks; first one to
 *   fire wins.
 * - **Non-consuming** (`consume: false`): reads but does not rename.
 *   Reserved for diagnostic or observability use cases where the result
 *   should remain available for a consuming hook to pick up later.
 *
 * @module
 */

import {
  readdirSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import { join, } from 'node:path';

import { parseHookJson, } from '../../runtime/handler-runtime.ts';
import {
  SPAWNS_DIR,
  type SpawnState,
} from './paths.ts';

/**
 * Formats a completed spawn state into a human-readable context string.
 *
 * @param state - spawn state to format
 *
 * @returns multi-line context string describing completed child session
 *
 * @example
 * ```ts
 * const text = formatSpawnResult(state);
 * // "Spawned Claude session completed (spawnId: abc-123):\n..."
 * ```
 */
function formatSpawnResult(state: SpawnState,): string {
  return [
    `Spawned Claude session completed (spawnId: ${state.spawnId}):`,
    `Session ID: ${state.sessionId}`,
    `Transcript: ${state.transcriptPath}`,
    state.lastMessage
      .length
      > 0
      ? `Last assistant message:\n${state.lastMessage}`
      : 'No assistant message was produced.',
  ]
    .join('\n',);
}

/**
 * Scans the spawns directory for children of the given session that have
 * stopped and not yet been reported.
 *
 * When `consume` is true, atomically renames `{spawnId}.json` to
 * `{spawnId}.reported` to prevent duplicate injection across concurrent hook
 * invocations. When `consume` is false, reads the state without renaming:
 * callers should treat the result as best-effort since the file may be
 * consumed by a later reliable hook invocation.
 *
 * @param parentSessionId - session identifier of calling session
 *
 * @param consume - whether to rename matched files to `.reported`. Use `true`
 *   from reliable delivery hooks (UserPromptSubmit, Stop), `false` from
 *   best-effort hooks (PreToolUse, PostToolUse, etc.).
 *
 * @returns combined context string, or `null` if nothing to report
 *
 * @example
 * ```ts
 * const context = checkCompletedChildren({ parentSessionId: 'abc', consume: true });
 * ```
 */
function checkCompletedChildren(
  {
    parentSessionId,
    consume,
  }: {
    readonly parentSessionId: string;
    readonly consume: boolean;
  },
): string | null {
  /** Filenames in `SPAWNS_DIR`; `null` when the directory is missing or unreadable. */
  const entries = (function readSpawnsDir(): string[] | null {
    try {
      return readdirSync(SPAWNS_DIR,);
    }
    catch {
      return null;
    }
  })();

  if (entries === null)
    return null;

  /** Formatted result strings for each completed child belonging to this parent. */
  const results: string[] = [];

  for (const filename of entries) {
    if (!filename.endsWith('.json',))
      continue;

    /** Absolute path to the candidate spawn-state file. */
    const filePath = join(
      SPAWNS_DIR,
      filename,
    );
    /**
     * Sibling `.reported` path used to consume the entry atomically via rename.
     * The `if (!filename.endsWith('.json')) continue;` guard above means the
     * slice always drops the `.json` suffix.
     */
    const reportedPath = join(
      SPAWNS_DIR,
      `${
        filename.slice(
          0,
          -'.json'.length,
        )
      }.reported`,
    );

    try {
      /** Raw JSON for the candidate; parsed below to recover the spawn state. */
      const raw = readFileSync(
        filePath,
        'utf8',
      );
      /** Parsed spawn state used to filter by parent session and stopped status. */
      const state = parseHookJson<SpawnState>(raw,);

      if (state.parentSessionId
        !== parentSessionId)
        continue;

      if (state.status
        !== 'stopped')
        continue;

      if (consume) {
        try {
          renameSync(
            filePath,
            reportedPath,
          );
        }
        catch {
          /** Another hook invocation already renamed this file. */
          continue;
        }
      }

      results.push(formatSpawnResult(state,),);
    }
    catch {
      continue;
    }
  }

  if (results.length
    === 0)
    return null;

  return results.join('\n\n---\n\n',);
}

export { checkCompletedChildren, };
