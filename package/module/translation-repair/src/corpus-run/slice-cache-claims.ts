//region Slice cache claims
// Which files in one entry`s cache directory belong to which producer.
//
// SPLIT FROM THE STORE at the line cap, on the seam between WHAT A CLAIM IS and
// WHAT THE STORE DOES WITH ONE. Every claim stays in this one file so a reader
// can check at a glance that no two prefixes collide, which is the property the
// whole scheme rests on: two producers sharing a prefix would read each other`s
// files as their own.

/**
 * One lane's claim on a shared cache directory.
 *
 * @example
 * ```ts
 * const namespace: SliceNamespace = { prefix: 'translate.', marker: 'translate-generation.txt', };
 * ```
 */
export type SliceNamespace = {
  /**
   * File-name prefix this lane's slices carry; empty for the repair lane, which
   * owns the unprefixed names already on disk.
   */
  readonly prefix: string;

  /**
   * File recording which pipeline filled this lane's slices.
   *
   * Deliberately not a `.json` name, so a slice loader cannot mistake a marker
   * for a settled slice.
   */
  readonly marker: string;
};

/**
 * Repair lane's claim: the unprefixed names written by every pass so far.
 */
export const REPAIR_SLICE_NAMESPACE: SliceNamespace = {
  prefix: '',
  marker: 'generation.txt',
};

/**
 * Translate lane's claim.
 */
export const TRANSLATE_SLICE_NAMESPACE: SliceNamespace = {
  prefix: 'translate.',
  marker: 'translate-generation.txt',
};

/**
 * Lane contest`s claim.
 *
 * NOT A LANE, and not a slice of one either. A contest is bought after both
 * lanes have settled a slice, over what the two of them produced, so it retires
 * with the entry and can never be mistaken for a lane`s own work.
 */
export const LANE_CONTEST_NAMESPACE: SliceNamespace = {
  prefix: 'contest.',
  marker: 'contest-generation.txt',
};

/**
 * Block pairing's claim.
 *
 * NOT A LANE either. A pairing is bought once per document pair and read by both
 * lanes, so it retires with the entry like everything else here and can never be
 * mistaken for a settled slice.
 */
export const PAIRING_NAMESPACE: SliceNamespace = {
  prefix: 'pairing.',
  marker: 'pairing-generation.txt',
};

/**
 * Picture readings' claim.
 *
 * NOT A LANE, and named as one anyway because the store is the same. A reading
 * is neither a repair outcome nor a translated slice; it is evidence gathered
 * before either lane runs, keyed by the picture rather than by any slice.
 */
export const PICTURE_READING_NAMESPACE: SliceNamespace = {
  prefix: 'picture.',
  marker: 'picture-generation.txt',
};

//endregion Slice cache claims
