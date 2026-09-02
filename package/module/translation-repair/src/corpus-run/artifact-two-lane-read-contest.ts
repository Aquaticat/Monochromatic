import {
  requireExactKeys,
  requireOneOf,
} from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
} from '../artifact-guard.ts';
import { settleEligibleLaneContestBallots, } from '../lane-contest-eligibility.ts';
import type { LaneContestBallot, } from '../lane-contest-wire.ts';
import {
  type ArtifactContestSlice,
  type ArtifactLaneSelection,
  contestEligibleIndexes,
  describeContestSlice,
} from './artifact-two-lane-contest.ts';
import { parseContestBallot, } from './artifact-two-lane-read-contest-ballot.ts';
import {
  contestEligibilityRequired,
  parseContestEligibility,
} from './artifact-two-lane-read-contest-eligibility.ts';
import { assertContestVerdictMatches, } from './artifact-two-lane-read-contest-verdict.ts';
import type { ArtifactComparisonRow, } from './artifact-two-lane-vocabulary.ts';
import type { ArtifactKeyVocabulary, } from '../artifact-key-vocabulary.ts';
import {
  ARTIFACT_SCHEMA_VERSION_V6,
  ARTIFACT_SCHEMA_VERSION_V7,
  ARTIFACT_SCHEMA_VERSION_V8,
  ARTIFACT_SCHEMA_VERSION_V9,
  ARTIFACT_SCHEMA_VERSION_V10,
  type TwoLaneArtifactGeneration,
} from './artifact-two-lane-contract.ts';

//region Lane contest reading
// Reading the recorded contest, and refusing one that disagrees with either the
// ballots stored beside it or the comparison the reader recomputed.
//
// THE VERDICT IS RECOMPUTED, not trusted. It is a claim about ballots this same
// record carries, so the reader settles those ballots by the stage`s own rule
// and refuses a stored verdict that says something else. This is the treatment
// the recorded lane comparison already gets, for the same reason: a derived
// field nobody re-derives is a field that can quietly become a lie.

/**
 * Reads one contested slice and re-derives its verdict from its own ballots.
 *
 * @param value - recorded slice
 *
 * @param path - dotted path of that slice
 *
 * @param keys - field spellings this artifact's generation uses, so an older
 * file is read by its own names rather than by today's
 *
 * @param generation - artifact generation deciding eligibility field support
 *
 * @param comparison - recomputed lane rows eligibility is checked against
 *
 * @returns Slice record, proven to agree with the ballots it carries
 *
 * @throws {@link ArtifactParseError} when a field is unreadable, when the usable
 * count disagrees with the ballots, or when the stored verdict is not the one
 * those ballots settle on
 *
 * @example
 * ```ts
 * const slice = parseContestSlice({ value, path, },);
 * ```
 */
function parseContestSlice(
  {
    value,
    path,
    keys,
    generation,
    comparison,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly keys: ArtifactKeyVocabulary;
    readonly generation: TwoLaneArtifactGeneration;
    readonly comparison: readonly ArtifactComparisonRow[];
  },
): ArtifactContestSlice {
  /**
   * Slice as a record, before any field is read.
   */
  const slice = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record: slice,
    allowed: [
      keys.sliceIndex,
      'verdict',
      'ballots',
      'usable',
      ...(((generation === ARTIFACT_SCHEMA_VERSION_V7)
        || (generation === ARTIFACT_SCHEMA_VERSION_V8)
        || (generation === ARTIFACT_SCHEMA_VERSION_V9)
        || (generation === ARTIFACT_SCHEMA_VERSION_V10)) ? ['eligibility',] : []),
    ],
    path,
  },);

  /**
   * Slice index this record answers.
   */
  const sliceIndex = requireCount({
    value: slice[keys.sliceIndex],
    path: `${path}.${keys.sliceIndex}`,
  },);
  /**
   * Lane row carrying candidate texts for eligibility recomputation.
   */
  const row = comparison.find(function namesSlice(candidate,): boolean {
    return candidate.sliceIndex === sliceIndex;
  },);
  if (row === undefined) {
    throw new ArtifactParseError({
      path: `${path}.${keys.sliceIndex}`,
      reason: 'index naming no recomputed comparison row',
    },);
  }
  /**
   * Source-backed syntax eligibility, absent on ordinary and older records.
   */
  const eligibility = (slice.eligibility === undefined)
    ? undefined
    : parseContestEligibility({
      value: slice.eligibility,
      row,
      path: `${path}.eligibility`,
    },);
  /**
   * Whether artifact generation requires syntax eligibility evidence.
   */
  const eligibilityRequired = (generation === ARTIFACT_SCHEMA_VERSION_V7)
    || (generation === ARTIFACT_SCHEMA_VERSION_V8)
    || (generation === ARTIFACT_SCHEMA_VERSION_V9)
    || (generation === ARTIFACT_SCHEMA_VERSION_V10);
  if (eligibilityRequired
    && (eligibility === undefined)
    && contestEligibilityRequired({ row, })) {
    throw new ArtifactParseError({
      path: `${path}.eligibility`,
      reason: 'source-backed syntax eligibility record rather than absence',
    },);
  }

  /**
   * Ballots this slice carries.
   */
  const ballots = requireArray({
    value: slice.ballots,
    path: `${path}.ballots`,
  },)
    .map(function readOne(
      one,
      position,
    ): LaneContestBallot {
      return parseContestBallot({
        value: one,
        path: `${path}.ballots[${String(position,)}]`,
      },);
    },);

  /**
   * Count the record claims for those ballots.
   */
  const usable = requireCount({
    value: slice.usable,
    path: `${path}.usable`,
  },);
  if (usable !== ballots.length) {
    throw new ArtifactParseError({
      path: `${path}.usable`,
      reason: `${String(ballots.length,)}, which is how many ballots this slice carries, rather than ${
        String(usable,)
      }`,
    },);
  }

  /**
   * Verdict the stored ballots settle on under the stage`s own rule.
   */
  const derived = describeContestSlice({
    sliceIndex,
    outcome: {
      choice: settleEligibleLaneContestBallots({
        ballots,
        ...((eligibility === undefined) ? {} : { eligibility, }),
      },),
      ballots,
      usable,
      findings: [],
    },
    ...((eligibility === undefined) ? {} : { eligibility, }),
  },);

  assertContestVerdictMatches({
    value: slice.verdict,
    derived: derived.verdict,
    path: `${path}.verdict`,
  },);
  return derived;
}

/**
 * Refuses a contest that does not answer exactly the slices where the two lanes
 * left different wording.
 *
 * @param slices - records the contest carries
 *
 * @param comparison - rows the reader recomputed from both ledgers
 *
 * @param path - dotted path of the recorded slices
 *
 * @throws {@link ArtifactParseError} when the answered slices are not the
 * eligible ones, in eligible order
 *
 * @example
 * ```ts
 * assertContestCoversEligible({ slices, comparison, path, },);
 * ```
 */
function assertContestCoversEligible(
  {
    slices,
    comparison,
    path,
  }: {
    readonly slices: readonly ArtifactContestSlice[];
    readonly comparison: readonly ArtifactComparisonRow[];
    readonly path: string;
  },
): void {
  /**
   * Slices a contest may answer, named by the comparison this reader derived.
   */
  const eligible = contestEligibleIndexes({ comparison, },)
    .join(',',);

  /**
   * Slices it does answer.
   */
  const answered = slices
    .map(function nameIt(slice,): number {
      return slice.sliceIndex;
    },)
    .join(',',);
  if (answered !== eligible) {
    throw new ArtifactParseError({
      path,
      reason: `slices [${eligible}], which are the ones where the two lanes differ, rather than [${answered}]`,
    },);
  }
}

/**
 * Reads which lane ships, and refuses a contest that does not cover exactly the
 * slices where the two lanes left different wording.
 *
 * @param value - recorded selection
 *
 * @param comparison - rows the reader recomputed from both ledgers
 *
 * @param path - dotted path of the recorded selection
 *
 * @param keys - field spellings this artifact's generation uses, so an older
 * file is read by its own names rather than by today's
 *
 * @param generation - artifact generation deciding eligibility field support
 *
 * @returns Selection, proven to agree with the ballots and the comparison
 *
 * @throws {@link ArtifactParseError} when the kind is unknown, when any slice is
 * unreadable, or when the slices covered are not the eligible ones
 *
 * @example
 * ```ts
 * const selection = parseLaneSelection({ value, comparison, path, keys, },);
 * ```
 */
export function parseLaneSelection(
  {
    value,
    comparison,
    path,
    keys,
    generation = ARTIFACT_SCHEMA_VERSION_V6,
  }: {
    readonly value: unknown;
    readonly comparison: readonly ArtifactComparisonRow[];
    readonly path: string;
    readonly keys: ArtifactKeyVocabulary;
    readonly generation?: TwoLaneArtifactGeneration;
  },
): ArtifactLaneSelection {
  /**
   * Selection as a record, before its kind is known.
   */
  const selection = requireRecord({
    value,
    path,
  },);

  /**
   * Kind it claims, which decides what else it may carry.
   */
  const kind = requireOneOf({
    value: selection.kind,
    allowed: [
      'pending-human-decision',
      'contested',
    ],
    path: `${path}.kind`,
  },);
  if (kind === 'pending-human-decision') {
    requireExactKeys({
      record: selection,
      allowed: ['kind',],
      path,
    },);
    return { kind, };
  }
  requireExactKeys({
    record: selection,
    allowed: [
      'kind',
      'slices',
    ],
    path,
  },);

  /**
   * One record per slice the contest answered.
   */
  const slices = requireArray({
    value: selection.slices,
    path: `${path}.slices`,
  },)
    .map(function readOne(
      one,
      position,
    ): ArtifactContestSlice {
      return parseContestSlice({
        value: one,
        path: `${path}.slices[${String(position,)}]`,
        keys,
        generation,
        comparison,
      },);
    },);
  assertContestCoversEligible({
    slices,
    comparison,
    path: `${path}.slices`,
  },);
  return {
    kind,
    slices,
  };
}

//endregion Lane contest reading
