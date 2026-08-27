import { readOverlapSetting, } from './slice-overlap.ts';

//region Pass overlap
// Corpus pass owns sequential fallback until matched arms decide otherwise.

/**
 * Corpus-pass slice overlap when invocation sets no environment override.
 */
const PASS_OVERLAP = 1;

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
