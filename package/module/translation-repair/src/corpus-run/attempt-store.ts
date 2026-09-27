import { readFile, } from 'node:fs/promises';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { contextRoot, } from '../log-context.ts';
import { isJsonRecord, } from '../json-guard.ts';
import { writeFileAtomic, } from './atomic-write.ts';

//region Attempt store
// Persisted per-entry attempt counts, used as the last ordering tiebreak so an
// entry that keeps failing deprioritizes instead of blocking the queue. Kept
// beside the driver rather than inside it so the driver stays within its line
// budget.
//
// TOLERANT, AND SAYS SO (ledger A11). A malformed file still costs an ordering
// hint rather than the run, but every reset and every coerced count is logged:
// read silently, a file that never parses makes every run order as if no entry
// had ever failed. The write is atomic, so an interrupted run can no longer
// leave the truncated file that made the reset necessary.

/**
 Logger root for the attempt store.
 */
const l = contextRoot({ tag: 'translation-repair', },);

/**
 Attempt counts keyed by entry id, for fewest-attempts-first ordering.
 
 @example
 ```ts
 const attempts: AttemptMap = { Kitten: 2, };
 ```
 */
export type AttemptMap = Record<string, number>;

/**
 Reads the persisted attempt map, tolerating a missing or malformed file so a
 corrupt cache never aborts a run.
 
 @param attemptsPath - location of the attempts JSON
 
 @returns Entry-id to attempt-count map, empty when absent or unreadable
 
 @throws {@link Error} when the file exists and is readable but fails for any
 reason other than absence or malformed JSON
 
 @example
 ```ts
 const attempts = await readAttemptMap('/runs/attempts.json',);
 ```
 */
export async function readAttemptMap(attemptsPath: string,): Promise<AttemptMap> {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readAttemptMap.name,
    l,
  },);
  try {
    /**
     Parsed JSON of unknown shape until guarded.
     */
    const parsed: unknown = JSON.parse(await readFile(
      attemptsPath,
      'utf8',
    ),);
    if (!isJsonRecord(parsed,)) {
      rl.warn('attempts file holds no object; attempt counts start over, so the ordering forgets which entries kept failing',);
      return {};
    }

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
          if ((typeof value) === 'number')
            return [
              id,
              value,
            ];
          rl.warn(`attempts file counts ${id} as no number; read as 0, so ${id} sorts first`,);
          return [
            id,
            0,
          ];
        },),
    );
  }
  catch (error) {
    // Missing (ENOENT) is a first run and says nothing; malformed (SyntaxError)
    // resets to empty and says so; any other read fault is real and surfaces.
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT'))
      return {};
    if (error instanceof SyntaxError) {
      rl.warn(`attempts file does not parse (${error.name}); attempt counts start over, so the ordering forgets which entries kept failing`,);
      return {};
    }
    throw error;
  }
}

/**
 Persists the attempt map so no reader sees it half-written.
 
 @param attemptsPath - location of the attempts JSON
 
 @param attempts - counts to record
 
 @example
 ```ts
 await writeAttemptMap({ attemptsPath, attempts, },);
 ```
 */
export async function writeAttemptMap(
  {
    attemptsPath,
    attempts,
  }: {
    readonly attemptsPath: string;
    readonly attempts: Readonly<AttemptMap>;
  },
): Promise<void> {
  await writeFileAtomic({
    path: attemptsPath,
    text: `${JSON.stringify(
      attempts,
      undefined,
      2,
    )}\n`,
  },);
}

//endregion Attempt store
