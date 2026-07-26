import { readFile, } from 'node:fs/promises';

import { isJsonRecord, } from '../json-guard.ts';

//region Attempt store
// Persisted per-entry attempt counts, used as the last ordering tiebreak so an
// entry that keeps failing deprioritizes instead of blocking the queue. Kept
// beside the driver rather than inside it so the driver stays within its line
// budget.

/**
 * Attempt counts keyed by entry id, for fewest-attempts-first ordering.
 *
 * @example
 * ```ts
 * const attempts: AttemptMap = { Kitten: 2, };
 * ```
 */
export type AttemptMap = Record<string, number>;

/**
 * Reads the persisted attempt map, tolerating a missing or malformed file so a
 * corrupt cache never aborts a run.
 *
 * @param attemptsPath - location of the attempts JSON
 *
 * @returns Entry-id to attempt-count map, empty when absent or unreadable
 *
 * @throws {@link Error} when the file exists and is readable but fails for any
 * reason other than absence or malformed JSON
 *
 * @example
 * ```ts
 * const attempts = await readAttemptMap('/runs/attempts.json',);
 * ```
 */
export async function readAttemptMap(attemptsPath: string,): Promise<AttemptMap> {
  try {
    /**
     * Parsed JSON of unknown shape until guarded.
     */
    const parsed: unknown = JSON.parse(await readFile(
      attemptsPath,
      'utf8',
    ),);
    if (!isJsonRecord(parsed,))
      return {};

    return Object.fromEntries(
      Object.entries(parsed,)
        .map(function toCount(
          [
            id,
            value,
          ]: readonly [
            string,
            unknown,
          ],
        ): readonly [
          string,
          number,
        ] {
          return [
            id,
            (typeof value) === 'number' ? value : 0,
          ];
        },),
    );
  }
  catch (error) {
    // Missing (ENOENT) or malformed (SyntaxError) cache resets to empty;
    // any other read fault is real and must surface.
    if ((Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      || (error instanceof SyntaxError))
      return {};
    throw error;
  }
}

//endregion Attempt store
