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
import { settleLaneContestBallots, } from '../lane-contest-stage.ts';
import type { LaneContestBallot, } from '../lane-contest-wire.ts';
import {
  type ArtifactContestSliceV2,
  type ArtifactContestVerdictV2,
  type ArtifactLaneSelectionV2,
  contestEligibleIndexes,
  describeContestSlice,
} from './artifact-v2-contest.ts';
import { parseContestBallotV2, } from './artifact-v2-read-contest-ballot.ts';
import type { ArtifactComparisonRowV2, } from './artifact-v2-vocabulary.ts';

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
 * Names the keys a recorded verdict may carry, given what its ballots settle.
 *
 * @param derived - verdict those ballots settle on
 *
 * @returns Key names the record is allowed to use
 *
 * @example
 * ```ts
 * const allowed = allowedVerdictKeys({ derived, },);
 * ```
 */
function allowedVerdictKeys(
  { derived, }: { readonly derived: ArtifactContestVerdictV2; },
): readonly string[] {
  if (derived.kind === 'lane-won') {
    return [
      'kind',
      'lane',
    ];
  }

  // THE ARCHIVE KEY IS ALLOWED ONLY WHERE ONE WAS DERIVED, so a record
  // carrying the field where the ballots settle nothing is still refused
  // rather than quietly accepted and then compared away.
  if ((derived.kind === 'settled-neither') && (derived.archive !== undefined)) {
    return [
      'kind',
      'archive',
    ];
  }
  return ['kind',];
}

/**
 * Names a verdict in one token, for comparing two of them and for saying which
 * arrived when they differ.
 *
 * @param verdict - verdict to name
 *
 * @returns Kind, carrying the lane when one won or the archive verdict when one
 * was given
 *
 * @example
 * ```ts
 * const settled = renderContestVerdict({ verdict, },);
 * ```
 */
function renderContestVerdict(
  { verdict, }: { readonly verdict: ArtifactContestVerdictV2; },
): string {
  if (verdict.kind === 'lane-won')
    return `${verdict.kind}:${verdict.lane}`;

  // AN UNJUDGED ARCHIVE RENDERS AS THE BARE KIND, matching the record that
  // omits the field, so every artifact written before the question existed
  // still renders to the token its own ballots settle on.
  if ((verdict.kind === 'settled-neither') && (verdict.archive !== undefined))
    return `${verdict.kind}:${verdict.archive}`;
  return verdict.kind;
}

/**
 * Renders the recorded verdict in the same one-token form.
 *
 * @param recorded - verdict the artifact carries
 *
 * @param path - dotted path of that verdict
 *
 * @returns Token the record claims
 *
 * @throws {@link ArtifactParseError} when a field names nothing this schema knows
 *
 * @example
 * ```ts
 * const claimed = renderRecordedVerdict({ recorded, path, },);
 * ```
 */
function renderRecordedVerdict(
  {
    recorded,
    path,
  }: {
    readonly recorded: Readonly<Record<string, unknown>>;
    readonly path: string;
  },
): string {
  if (recorded.lane !== undefined) {
    return `${
      requireOneOf({
        value: recorded.kind,
        allowed: ['lane-won',],
        path: `${path}.kind`,
      },)
    }:${
      requireOneOf({
        value: recorded.lane,
        allowed: [
          'repair',
          'translate',
        ],
        path: `${path}.lane`,
      },)
    }`;
  }
  if (recorded.archive !== undefined) {
    return `${
      requireOneOf({
        value: recorded.kind,
        allowed: ['settled-neither',],
        path: `${path}.kind`,
      },)
    }:${
      requireOneOf({
        value: recorded.archive,
        allowed: [
          'endorsed',
          'declined',
        ],
        path: `${path}.archive`,
      },)
    }`;
  }
  return requireOneOf({
    value: recorded.kind,
    allowed: [
      'settled-neither',
      'quorum-not-met',
    ],
    path: `${path}.kind`,
  },);
}

/**
 * Refuses a recorded verdict that is not the one its own ballots settle on.
 *
 * @param recorded - verdict the artifact carries
 *
 * @param derived - verdict those ballots settle on
 *
 * @param path - dotted path of the recorded verdict
 *
 * @throws {@link ArtifactParseError} when the two name different outcomes
 *
 * @example
 * ```ts
 * assertVerdictMatches({ recorded, derived, path, },);
 * ```
 */
function assertVerdictMatches(
  {
    recorded,
    derived,
    path,
  }: {
    readonly recorded: Readonly<Record<string, unknown>>;
    readonly derived: ArtifactContestVerdictV2;
    readonly path: string;
  },
): void {
  requireExactKeys({
    record: recorded,
    allowed: allowedVerdictKeys({ derived, },),
    path,
  },);

  /**
   * Verdict the record claims, in the one-token form the derived one renders
   * to, so the two compare as values rather than as shapes.
   */
  const claimed = renderRecordedVerdict({
    recorded,
    path,
  },);

  /**
   * Verdict those ballots settle on, in the same form.
   */
  const settled = renderContestVerdict({ verdict: derived, },);
  if (claimed !== settled) {
    throw new ArtifactParseError({
      path,
      reason: `${settled}, which is what these ballots settle on, rather than ${claimed}`,
    },);
  }
}

/**
 * Reads one contested slice and re-derives its verdict from its own ballots.
 *
 * @param value - recorded slice
 *
 * @param path - dotted path of that slice
 *
 * @returns Slice record, proven to agree with the ballots it carries
 *
 * @throws {@link ArtifactParseError} when a field is unreadable, when the usable
 * count disagrees with the ballots, or when the stored verdict is not the one
 * those ballots settle on
 *
 * @example
 * ```ts
 * const slice = parseContestSliceV2({ value, path, },);
 * ```
 */
function parseContestSliceV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactContestSliceV2 {
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
      'chunkIndex',
      'verdict',
      'ballots',
      'usable',
    ],
    path,
  },);

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
      return parseContestBallotV2({
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
    chunkIndex: requireCount({
      value: slice.chunkIndex,
      path: `${path}.chunkIndex`,
    },),
    outcome: {
      choice: settleLaneContestBallots({ ballots, },),
      ballots,
      usable,
      findings: [],
    },
  },);

  /**
   * Verdict the record claims, read as a record before it is compared.
   */
  const recorded = requireRecord({
    value: slice.verdict,
    path: `${path}.verdict`,
  },);
  assertVerdictMatches({
    recorded,
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
    readonly slices: readonly ArtifactContestSliceV2[];
    readonly comparison: readonly ArtifactComparisonRowV2[];
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
      return slice.chunkIndex;
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
 * @returns Selection, proven to agree with the ballots and the comparison
 *
 * @throws {@link ArtifactParseError} when the kind is unknown, when any slice is
 * unreadable, or when the slices covered are not the eligible ones
 *
 * @example
 * ```ts
 * const selection = parseLaneSelectionV2({ value, comparison, path, },);
 * ```
 */
export function parseLaneSelectionV2(
  {
    value,
    comparison,
    path,
  }: {
    readonly value: unknown;
    readonly comparison: readonly ArtifactComparisonRowV2[];
    readonly path: string;
  },
): ArtifactLaneSelectionV2 {
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
    ): ArtifactContestSliceV2 {
      return parseContestSliceV2({
        value: one,
        path: `${path}.slices[${String(position,)}]`,
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
