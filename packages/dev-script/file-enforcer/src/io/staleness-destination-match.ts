import { readFileSync, } from 'node:fs';
import { hashContent, } from './staleness-hash.ts';
import {
  fileStampListsMatch,
  readFileStamps,
} from './staleness-stamps.ts';
import {
  ABSENT_FILE_STAMPS,
  type DestinationStamp,
} from './staleness-types.ts';

/**
 * Returns whether current destination metadata and content hashes match recorded stamps.
 *
 * @param recordedStamps - Destination stamps persisted in manifest.
 *
 * @returns Whether every destination is unchanged.
 *
 * @example
 * ```ts
 * const fresh = destinationStampListsMatch({ recordedStamps });
 * ```
 */
export function destinationStampListsMatch(
  {
    recordedStamps,
  }: {
    readonly recordedStamps: readonly DestinationStamp[];
  },
): boolean {
  /**
   * Current filesystem metadata for every recorded destination.
   */
  const currentStamps = readFileStamps(recordedStamps.map(function destinationPath(stamp,): string {
    return stamp.path;
  },),);
  if (currentStamps === ABSENT_FILE_STAMPS)
    return false;
  if (!fileStampListsMatch({
    currentStamps,
    recordedStamps,
  },))
    return false;

  return recordedStamps.every(function destinationHashMatches(stamp,): boolean {
    try {
      return hashContent(readFileSync(
        stamp.path,
        'utf8',
      ),) === stamp.hash;
    }
    catch {
      return false;
    }
  },);
}
