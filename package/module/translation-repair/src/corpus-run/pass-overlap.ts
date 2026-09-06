import { readOverlapSetting, } from './slice-overlap.ts';

//region Pass overlap
// Corpus pass keeps four slices in flight since the four matched pairs of
// 2026-08-27 and 2026-08-28 were read into a default on 2026-09-06
// (`doc/decision/translation-repair-pass-overlap.md`). One was the value
// while `#261` waited for those pairs.

/**
 * Corpus-pass slice overlap when invocation sets no environment override.
 */
const PASS_OVERLAP = 4;

/**
 * Reads and logs one entry's overlap once before entry work starts.
 *
 * @param entryId - entry receiving same value across every per-slice driver
 *
 * @returns Slices each driver may keep in flight
 *
 * @throws StatedRefusalError when environment value is invalid
 *
 * @example
 * ```ts
 * const overlap = readPassOverlap({ entryId: 'XingZ60', },);
 * ```
 */
export function readPassOverlap(
  { entryId, }: { readonly entryId: string; },
): number {
  /**
   * Value and source read atomically from one environment snapshot.
   */
  const setting = readOverlapSetting({ fallback: PASS_OVERLAP, },);
  console.log(
    `OVERLAP ${entryId} value=${String(setting.overlap,)} source=${setting.source}`,
  );
  return setting.overlap;
}

//endregion Pass overlap
