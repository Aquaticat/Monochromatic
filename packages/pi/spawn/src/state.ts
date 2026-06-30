/**
 * Spawn-pi coordination state reads and writes.
 *
 * @module
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';

import {
  byPidDir,
  reportedStatePath,
  type Environment,
  type PidMapping,
  spawnsDir,
  spawnStatePath,
  type SpawnState,
} from './paths.ts';

//region Sentinels

/**
 * Sentinel returned when no spawn result is ready to inject.
 *
 * @example
 * ```typescript
 * if (result === NOTHING_TO_REPORT) return;
 * ```
 */
const NOTHING_TO_REPORT: unique symbol = Symbol('spawn-pi/nothing-to-report',);

//endregion Sentinels

//region PID mapping

/**
 * Writes parent process identity so spawn-pi CLI can find current Pi session.
 *
 * @param pid - process id to map.
 *
 * @param mapping - Pi session {@link PidMapping} identity to write.
 *
 * @param env - {@link Environment} values controlling destination directory.
 *
 * @example
 * ```typescript
 * writePidMapping({ pid: process.pid, mapping });
 * ```
 */
function writePidMapping(
  {
    pid,
    mapping,
    env = process.env,
  }: {
    readonly pid: number;
    readonly mapping: PidMapping;
    readonly env?: Environment;
  },
): void {
  /**
   * Directory receiving PID mapping files.
   */
  const dir = byPidDir(env,);
  mkdirSync(
    dir,
    { recursive: true, },
  );
  writeFileSync(
    join(
      dir,
      String(pid,),
    ),
    JSON.stringify(mapping,),
  );
}

//endregion PID mapping

//region Spawn state writes

/**
 * Writes initial spawn state before terminal process is launched.
 *
 * @param state - initial {@link SpawnState} to persist.
 *
 * @param env - {@link Environment} values controlling destination directory.
 *
 * @example
 * ```typescript
 * writeInitialSpawnState({ state });
 * ```
 */
function writeInitialSpawnState(
  {
    state,
    env = process.env,
  }: {
    readonly state: SpawnState;
    readonly env?: Environment;
  },
): void {
  mkdirSync(
    spawnsDir(env,),
    { recursive: true, },
  );
  writeFileSync(
    spawnStatePath({
      spawnId: state.spawnId,
      env,
    },),
    JSON.stringify(state,),
  );
}

/**
 * Claims a pre-created spawn state for child Pi session.
 *
 * @param spawnId - spawn identifier from environment.
 *
 * @param sessionId - child Pi session identifier.
 *
 * @param sessionFile - child Pi session file path.
 *
 * @param env - {@link Environment} values controlling source directory.
 *
 * @example
 * ```typescript
 * claimSpawn({ spawnId: 'abc', sessionId: 'child', sessionFile: '/tmp/s.jsonl' });
 * ```
 */
function claimSpawn(
  {
    spawnId,
    sessionId,
    sessionFile,
    env = process.env,
  }: {
    readonly spawnId: string;
    readonly sessionId: string;
    readonly sessionFile: string;
    readonly env?: Environment;
  },
): void {
  try {
    /**
     * Raw state written by CLI before child launched.
     */
    const raw = readFileSync(
      spawnStatePath({
        spawnId,
        env,
      },),
      'utf8',
    );
    /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted JSON file written by spawn-pi CLI. */
    /**
     * Parsed spawn state before child ownership claim.
     */
    const state = JSON.parse(raw,) as SpawnState;
    /* oxlint-enable typescript/no-unsafe-type-assertion */

    if (state.sessionId !== '')
      return;

    /**
     * State after child session ownership claim.
     */
    const updated: SpawnState = {
      ...state,
      sessionId,
      sessionFile,
    };
    writeFileSync(
      spawnStatePath({
        spawnId,
        env,
      },),
      JSON.stringify(updated,),
    );
  }
  catch {
    // Stale environment or consumed state file: no-op.
  }
}

/**
 * Marks child spawn as completed after first child Pi agent loop.
 *
 * @param spawnId - spawn identifier from environment.
 *
 * @param sessionId - child Pi session identifier.
 *
 * @param lastMessage - assistant text to forward to parent.
 *
 * @param env - {@link Environment} values controlling source directory.
 *
 * @example
 * ```typescript
 * completeSpawn({ spawnId: 'abc', sessionId: 'child', lastMessage: 'done' });
 * ```
 */
function completeSpawn(
  {
    spawnId,
    sessionId,
    lastMessage,
    env = process.env,
  }: {
    readonly spawnId: string;
    readonly sessionId: string;
    readonly lastMessage: string;
    readonly env?: Environment;
  },
): void {
  try {
    /**
     * Raw state claimed by child session.
     */
    const raw = readFileSync(
      spawnStatePath({
        spawnId,
        env,
      },),
      'utf8',
    );
    /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted JSON file written by spawn-pi modules. */
    /**
     * Parsed spawn state ready for owner check.
     */
    const state = JSON.parse(raw,) as SpawnState;
    /* oxlint-enable typescript/no-unsafe-type-assertion */

    if (state.sessionId !== sessionId)
      return;

    /**
     * State after first child result is ready for parent consumption.
     */
    const updated: SpawnState = {
      ...state,
      lastMessage,
      status: 'stopped',
    };
    writeFileSync(
      spawnStatePath({
        spawnId,
        env,
      },),
      JSON.stringify(updated,),
    );
  }
  catch {
    // Missing or already-consumed spawn state: no-op.
  }
}

//endregion Spawn state writes

//region Completed child consumption

/**
 * Formats completed child state into parent-visible context.
 *
 * @param state - completed {@link SpawnState}.
 *
 * @returns model-visible result text for parent Pi session.
 *
 * @example
 * ```typescript
 * formatSpawnResult(state);
 * ```
 */
function formatSpawnResult(state: SpawnState,): string {
  /**
   * Last assistant text captured from child Pi.
   */
  const { lastMessage, } = state;
  /**
   * Whether child Pi produced assistant text worth forwarding.
   */
  const hasLastMessage = lastMessage.length > 0;

  return [
    `Spawned Pi session completed (spawnId: ${state.spawnId}):`,
    `Session ID: ${state.sessionId}`,
    `Session file: ${state.sessionFile}`,
    hasLastMessage
      ? `Last assistant message:\n${lastMessage}`
      : 'No assistant message was produced.',
  ].join('\n',);
}

/**
 * Reads spawn state directory, handling missing directories as empty state.
 *
 * @param env - {@link Environment} values controlling source directory.
 *
 * @returns directory entries, or {@link NOTHING_TO_REPORT} when directory is absent.
 *
 * @example
 * ```typescript
 * readSpawnsDir();
 * ```
 */
function readSpawnsDir(env: Environment = process.env,): readonly string[] | typeof NOTHING_TO_REPORT {
  try {
    return readdirSync(spawnsDir(env,),);
  }
  catch {
    return NOTHING_TO_REPORT;
  }
}

/**
 * Detects JSON spawn state filenames without regex.
 *
 * @param filename - directory entry name.
 *
 * @returns whether filename names active spawn JSON.
 *
 * @example
 * ```typescript
 * isSpawnJsonFilename('abc.json'); // true
 * ```
 */
function isSpawnJsonFilename(filename: string,): boolean {
  return filename.endsWith('.json',);
}

/**
 * Drops `.json` suffix from spawn state filename.
 *
 * @param filename - JSON filename to trim.
 *
 * @returns spawn identifier derived from filename.
 *
 * @example
 * ```typescript
 * spawnIdFromJsonFilename('abc.json'); // 'abc'
 * ```
 */
function spawnIdFromJsonFilename(filename: string,): string {
  return filename.slice(
    0,
    filename.length - '.json'.length,
  );
}

/**
 * Scans stopped children for a parent session and optionally consumes them.
 *
 * @param parentSessionId - parent Pi session identifier to match.
 *
 * @param consume - whether matching JSON files should be renamed to reported markers.
 *
 * @param env - {@link Environment} values controlling source directory.
 *
 * @returns formatted result text, or {@link NOTHING_TO_REPORT}.
 *
 * @example
 * ```typescript
 * checkCompletedChildren({ parentSessionId: 'parent', consume: true });
 * ```
 */
function checkCompletedChildren(
  {
    parentSessionId,
    consume,
    env = process.env,
  }: {
    readonly parentSessionId: string;
    readonly consume: boolean;
    readonly env?: Environment;
  },
): string | typeof NOTHING_TO_REPORT {
  /**
   * Directory entries under active spawn state directory.
   */
  const entries = readSpawnsDir(env,);
  if (entries === NOTHING_TO_REPORT)
    return NOTHING_TO_REPORT;

  /**
   * Formatted results for matching stopped children.
   */
  const results: string[] = [];

  for (const filename of entries) {
    if (!isSpawnJsonFilename(filename,))
      continue;

    /**
     * Spawn identifier derived from filename.
     */
    const spawnId = spawnIdFromJsonFilename(filename,);
    try {
      /**
       * Raw candidate state text.
       */
      const raw = readFileSync(
        spawnStatePath({
          spawnId,
          env,
        },),
        'utf8',
      );
      /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted JSON file written by spawn-pi modules. */
      /**
       * Parsed candidate state used for parent and status filtering.
       */
      const state = JSON.parse(raw,) as SpawnState;
      /* oxlint-enable typescript/no-unsafe-type-assertion */

      if ((state.parentSessionId !== parentSessionId) || (state.status !== 'stopped'))
        continue;

      if (consume) {
        try {
          renameSync(
            spawnStatePath({
              spawnId,
              env,
            },),
            reportedStatePath({
              spawnId,
              env,
            },),
          );
        }
        catch {
          continue;
        }
      }

      results.push(formatSpawnResult(state,),);
    }
    catch {
      continue;
    }
  }

  return results.length === 0
    ? NOTHING_TO_REPORT
    : results.join('\n\n---\n\n',);
}

//endregion Completed child consumption

export {
  checkCompletedChildren,
  claimSpawn,
  completeSpawn,
  formatSpawnResult,
  isSpawnJsonFilename,
  NOTHING_TO_REPORT,
  readSpawnsDir,
  spawnIdFromJsonFilename,
  writeInitialSpawnState,
  writePidMapping,
};
