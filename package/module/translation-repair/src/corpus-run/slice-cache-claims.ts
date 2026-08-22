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
 * Every claim in this package, keyed by the role that owns it.
 *
 * ONE RECORD RATHER THAN LOOSE CONSTANTS, so that declaring a namespace and
 * registering it are the same act. `belongsToNamespace` defines the repair lane
 * by SUBTRACTION from the registered prefixes, so a prefix nothing registered
 * is one the repair lane adopts, and its next generation change deletes those
 * files while reporting that it discarded its own slices.
 *
 * THAT OMISSION HAPPENED SIX TIMES while the registration was a second,
 * separate list. Two were still live when this record replaced it: `contest.`
 * and `pairing.` were both unregistered, so a repair-lane generation change
 * threw away an entry's contest ballots and its whole block pairing, logging
 * "discarding 3 cached slices". Both are bought from the roster, so both cost
 * real calls to rebuy.
 *
 * THE NAMED EXPORTS BELOW READ OUT OF HERE and `EVERY_SLICE_NAMESPACE` is this
 * record's values, so no namespace can exist for one and not the other. A
 * seventh written as a standalone constant escapes that, which is why it must
 * be written here instead: the point is that forgetting is not a way to get
 * there.
 */
const CLAIM_BY_ROLE = {
  /**
   * Repair lane: the unprefixed names written by every pass so far.
   */
  repair: {
    prefix: '',
    marker: 'generation.txt',
  },

  /**
   * Translate lane.
   */
  translate: {
    prefix: 'translate.',
    marker: 'translate-generation.txt',
  },

  /**
   * Lane contest. NOT A LANE, and not a slice of one either: a contest is
   * bought after both lanes have settled a slice, over what the two of them
   * produced, so it retires with the entry and can never be mistaken for a
   * lane's own work.
   */
  laneContest: {
    prefix: 'contest.',
    marker: 'contest-generation.txt',
  },

  /**
   * Block pairing. NOT A LANE either: a pairing is bought once per document
   * pair and read by both lanes.
   */
  pairing: {
    prefix: 'pairing.',
    marker: 'pairing-generation.txt',
  },

  /**
   * Consolidation. NOT A LANE: a settlement is bought after the lane contest
   * has already decided what stands, over the two lanes and the standing text
   * together, so it retires with the entry like the contest it follows.
   */
  consolidation: {
    prefix: 'consolidate.',
    marker: 'consolidate-generation.txt',
  },

  /**
   * Picture readings. Neither a repair outcome nor a translated slice; evidence
   * gathered before either lane runs, keyed by the picture rather than by any
   * slice.
   */
  pictureReading: {
    prefix: 'picture.',
    marker: 'picture-generation.txt',
  },
} as const satisfies Record<string, SliceNamespace>;

/**
 * Every namespace this package defines, which is what the store subtracts from.
 *
 * @example
 * ```ts
 * const prefixes = EVERY_SLICE_NAMESPACE.map(({ prefix, },) => prefix,);
 * ```
 */
export const EVERY_SLICE_NAMESPACE: readonly SliceNamespace[] = Object.values(CLAIM_BY_ROLE,);

/**
 * Repair lane's claim.
 */
export const REPAIR_SLICE_NAMESPACE: SliceNamespace = CLAIM_BY_ROLE.repair;

/**
 * Translate lane's claim.
 */
export const TRANSLATE_SLICE_NAMESPACE: SliceNamespace = CLAIM_BY_ROLE.translate;

/**
 * Lane contest's claim.
 */
export const LANE_CONTEST_NAMESPACE: SliceNamespace = CLAIM_BY_ROLE.laneContest;

/**
 * Block pairing's claim.
 */
export const PAIRING_NAMESPACE: SliceNamespace = CLAIM_BY_ROLE.pairing;

/**
 * Consolidation's claim.
 */
export const CONSOLIDATE_NAMESPACE: SliceNamespace = CLAIM_BY_ROLE.consolidation;

/**
 * Picture readings' claim.
 */
export const PICTURE_READING_NAMESPACE: SliceNamespace = CLAIM_BY_ROLE.pictureReading;

//endregion Slice cache claims
