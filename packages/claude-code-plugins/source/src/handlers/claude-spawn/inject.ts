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
 * Sentinel returned by {@link checkCompletedChildren} when no completed child
 * is pending delivery.
 *
 * A unique symbol rather than `null`: the caller narrows on identity
 * (`=== NOTHING_TO_REPORT`), keeping the context string free of a nullish union.
 */
const NOTHING_TO_REPORT: unique symbol = Symbol('claude-spawn/nothing-to-report',);

/**
 * Lists the filenames in the spawns coordination directory.
 *
 * @returns directory entries, or `NOTHING_TO_REPORT` when the directory is
 *   missing or unreadable (there is then nothing to deliver)
 *
 * @example
 * ```ts
 * const entries = readSpawnsDir();
 * ```
 */
function readSpawnsDir(): readonly string[] | typeof NOTHING_TO_REPORT {
  try {
    return readdirSync(SPAWNS_DIR,);
  }
  catch {
    return NOTHING_TO_REPORT;
  }
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
 * @returns combined context string, or `NOTHING_TO_REPORT` if nothing to report
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
): string | typeof NOTHING_TO_REPORT {
  /** Filenames in `SPAWNS_DIR`, or `NOTHING_TO_REPORT` when the directory is missing or unreadable. */
  const entries = readSpawnsDir();

  if (entries === NOTHING_TO_REPORT)
    return NOTHING_TO_REPORT;

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
      /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted file written by our own CLI */
      /** Parsed spawn state used to filter by parent session and stopped status. */
      const state = JSON.parse(raw,) as SpawnState;
      /* oxlint-enable typescript/no-unsafe-type-assertion */

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
    return NOTHING_TO_REPORT;

  return results.join('\n\n---\n\n',);
}

export {
  checkCompletedChildren,
  NOTHING_TO_REPORT,
};
