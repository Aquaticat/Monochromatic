/**
 * Shared inject check that scans for completed child sessions
 * and returns `additionalContext` for the parent.
 *
 * Called from every hook that supports `additionalContext` injection
 * to ensure results appear at the earliest possible moment.
 *
 * @module
 */

import {
  readdirSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';

import { SPAWNS_DIR, type SpawnState } from './paths.ts';

/**
 * Scans the spawns directory for children of the given session
 * that have stopped and not yet been reported.
 *
 * For each match, atomically renames `{spawnId}.json` to `{spawnId}.reported`
 * to prevent duplicate injection across concurrent hook invocations.
 *
 * @param parentSessionId - Session identifier of the calling session.
 *
 * @returns Combined `additionalContext` string, or `null` if nothing to report.
 *
 * @example
 * ```ts
 * const context = checkCompletedChildren({ parentSessionId: 'abc-123' })
 * if (context !== null) {
 *   // inject into hook output
 * }
 * ```
 */
function checkCompletedChildren({ parentSessionId }: { parentSessionId: string }): string | null {
  let entries: string[] = [];
  try {
    entries = readdirSync(SPAWNS_DIR);
  } catch {
    return null;
  }

  const results: string[] = [];

  for (const filename of entries) {
    if (!filename.endsWith('.json')) {
      continue;
    }

    const filePath = join(SPAWNS_DIR, filename);
    const reportedPath = join(SPAWNS_DIR, filename.replace(/\.json$/, '.reported'));

    try {
      const raw = readFileSync(filePath, 'utf8');
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own hooks */
      const state = JSON.parse(raw) as SpawnState;

      if (state.parentSessionId !== parentSessionId) {
        continue;
      }

      if (state.status !== 'stopped') {
        continue;
      }

      //region Atomic rename to prevent double injection
      try {
        renameSync(filePath, reportedPath);
      } catch {
        /** Another hook invocation already renamed this file. */
        continue;
      }
      //endregion

      results.push([
        `Spawned Claude session completed (spawnId: ${state.spawnId}):`,
        `Session ID: ${state.sessionId}`,
        `Transcript: ${state.transcriptPath}`,
        state.lastMessage.length > 0
          ? `Last assistant message:\n${state.lastMessage}`
          : 'No assistant message was produced.',
      ].join('\n'));
    } catch {
      continue;
    }
  }

  if (results.length === 0) {
    return null;
  }

  return results.join('\n\n---\n\n');
}

export { checkCompletedChildren };
