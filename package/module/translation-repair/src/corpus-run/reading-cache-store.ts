import { isJsonRecord, } from '../json-guard.ts';
import type { PairedReading, } from '../image-reading-pair.ts';
import type { SliceCache, } from '../slice-cache.ts';
import {
  openNamespacedCache,
  PICTURE_READING_NAMESPACE,
} from './slice-cache-namespace.ts';

//region Reading cache store
// Disk-backed per-entry store for what a picture was read as, beside the two
// lanes' slice caches and in its own namespace.
//
// WHY A READING MUST BE STORED AT ALL, which is not obvious from the cost. It
// is not chiefly about saving the call: it is that a reading is NOT
// DETERMINISTIC. Ask one model the same question about the same picture twice
// and the wording differs, and the wording is in the translate slice key,
// because a judge shown different words can reach a different answer. Without a
// store, a resumed entry would re-read every picture into slightly different
// words, every key naming a picture would change, and every settled slice on a
// picture-bearing document would be re-bought. The store is what makes a
// resumed key equal to the key it resumes.
//
// TIED TO THE PIPELINE GENERATION like the slice caches, deliberately, even
// though `imageReadingKey` already names the picture, the roster, the
// instruction and the corroboration threshold. What it does NOT name is the
// per-reading screen in `image-reading-sense.ts`, whose clauses are private to
// it; a generation marker retires the store whenever the built pipeline changes,
// which covers that and anything else added later. The cost is bounded: 191
// distinct assets against a corpus pass measured at 455 seconds per slice over
// 1260 slices.

/**
 * Whether a stored field is a list of readings that each name their model.
 *
 * SHARED BY THE TWO SHAPES THAT CARRY ONE. A corroborated record must hold this
 * list and an unavailable record may, and a check written out twice is a check
 * that drifts into meaning two things.
 *
 * @param value - field parsed from cache file
 *
 * @returns True when it is a list whose every element names a model and carries
 * its text
 *
 * @example
 * ```ts
 * if (!isModelReadingList(value.readings,)) return false;
 * ```
 */
function isModelReadingList(value: unknown,): boolean {
  if (!Array.isArray(value,))
    return false;
  return value
    .every(function named(one,): boolean {
      if (!isJsonRecord(one,))
        return false;
      if ((typeof one.modelId) !== 'string')
        return false;
      return (typeof one.text) === 'string';
    },);
}

/**
 * Whether a parsed cache file is a usable paired reading.
 *
 * Checks the DISCRIMINANT and then the fields that shape carries, so a file
 * written under an older shape is recomputed rather than read with fields that
 * have since changed meaning.
 *
 * EVERY KIND `PairedReading` DEFINES HAS TO APPEAR HERE, and the cost of one
 * missing is silent. `no-text` was added to the type on 2026-08-19 and not to
 * this function, so each of the 119 textless pictures in this corpus was
 * rejected on resume, read again by the deterministic reader, written back, and
 * rejected again on the pass after that. A run that re-does work reports
 * nothing: it looks exactly like a run that had nothing to resume.
 *
 * @param value - parsed JSON of cache file
 *
 * @returns True when value is a paired reading, in any of the ways one can end
 *
 * @example
 * ```ts
 * if (isPairedReading(parsed,)) resumed.set(key, parsed,);
 * ```
 */
function isPairedReading(value: unknown,): value is PairedReading {
  if (!isJsonRecord(value,))
    return false;

  if (value.kind === 'corroborated') {
    if (!isModelReadingList(value.readings,))
      return false;
    return (typeof value.overlap) === 'number';
  }

  // The count is checked rather than assumed, because it is what separates a
  // picture with nothing on it from one whose few characters fell below the
  // line, and a record missing it cannot say which it was.
  if (value.kind === 'no-text')
    return (typeof value.characters) === 'number';

  if (value.kind !== 'unavailable')
    return false;
  if (!Array.isArray(value.perReader,))
    return false;

  // OPTIONAL IS NOT UNCHECKED. These readings are kept so a disagreement can be
  // diagnosed rather than only counted, and a record whose kept readings are
  // malformed cannot serve that purpose, so it is recomputed instead.
  if ((value.readings !== undefined) && (!isModelReadingList(value.readings,)))
    return false;

  /**
   * Reasons this shape can carry, which a file written under an older set
   * would not match.
   *
   * NOT THE PER-READER REASONS. One reader can fail for reasons this pair never
   * ends at, `reader-failed` among them, and a record carrying one of those was
   * written by something that confused a reader's outcome with the pair's.
   */
  const reasons: readonly string[] = [
    'no-reader-available',
    'one-reader-only',
    'readers-disagree',
  ];
  return ((typeof value.reason) === 'string')
    && reasons.includes(value.reason,);
}

/**
 * Opens an entry's picture-reading store, beside its two slice caches.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @param generation - digest of built pipeline this pass runs
 *
 * @returns Store resuming readings settled earlier and persisting new ones
 *
 * @example
 * ```ts
 * const readingCache = await openPictureReadingCache({ dir: entryCacheDir, generation, },);
 * ```
 */
export async function openPictureReadingCache(
  {
    dir,
    generation,
  }: {
    readonly dir: string;
    readonly generation: string;
  },
): Promise<SliceCache<PairedReading>> {
  return await openNamespacedCache({
    dir,
    generation,
    namespace: PICTURE_READING_NAMESPACE,
    isValue: isPairedReading,
  },);
}

//endregion Reading cache store
