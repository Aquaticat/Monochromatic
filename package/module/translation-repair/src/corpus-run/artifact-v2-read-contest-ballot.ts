import {
  requireExactKeys,
  requireOneOf,
} from '../artifact-exact-guard.ts';
import {
  requireArray,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import type {
  LaneChoice,
  LaneContestBallot,
} from '../lane-contest-wire.ts';

//region Lane contest ballot reading
// Reading one judge`s ballot back out of a settled artifact.
//
// SPLIT FROM THE SLICE READER on the line budget, along the seam the wire
// module already draws: a ballot is a shape a judge produced, and a slice is
// what the roster made of a set of them.

/**
 * Candidate names a ballot may carry.
 */
const LANE_CHOICES: readonly LaneChoice[] = [
  'repair',
  'translate',
  'neither',
];

/**
 * Reads one list of strings a judge wrote.
 *
 * @param value - recorded list
 *
 * @param path - dotted path of that list
 *
 * @returns Strings it carries
 *
 * @throws {@link ArtifactParseError} when it is not a list of strings
 *
 * @example
 * ```ts
 * const reasons = parseStringList({ value, path, },);
 * ```
 */
function parseStringList(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly string[] {
  return requireArray({
    value,
    path,
  },)
    .map(function readOne(
      one,
      position,
    ): string {
      return requireString({
        value: one,
        path: `${path}[${String(position,)}]`,
      },);
    },);
}

/**
 * Reads one list of candidate names a judge wrote.
 *
 * @param value - recorded list
 *
 * @param path - dotted path of that list
 *
 * @returns Candidate names it carries
 *
 * @throws {@link ArtifactParseError} when any entry names no candidate
 *
 * @example
 * ```ts
 * const named = parseChoiceList({ value, path, },);
 * ```
 */
function parseChoiceList(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly LaneChoice[] {
  return requireArray({
    value,
    path,
  },)
    .map(function readOne(
      one,
      position,
    ): LaneChoice {
      return requireOneOf({
        value: one,
        allowed: LANE_CHOICES,
        path: `${path}[${String(position,)}]`,
      },);
    },);
}

/**
 * Reads one judge`s ballot.
 *
 * @param value - recorded ballot
 *
 * @param path - dotted path of that ballot
 *
 * @returns Ballot as the judge left it
 *
 * @throws {@link ArtifactParseError} when any field is missing or unreadable
 *
 * @example
 * ```ts
 * const ballot = parseContestBallotV2({ value, path, },);
 * ```
 */
export function parseContestBallotV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): LaneContestBallot {
  /**
   * Ballot as a record, before any field is read.
   */
  const ballot = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record: ballot,
    allowed: [
      'choice',
      'unsupported',
      'unsupportedRaw',
      'dropped',
      'droppedRaw',
      'reason',
    ],
    path,
  },);
  return {
    choice: requireOneOf({
      value: ballot.choice,
      allowed: LANE_CHOICES,
      path: `${path}.choice`,
    },),
    unsupported: parseChoiceList({
      value: ballot.unsupported,
      path: `${path}.unsupported`,
    },),
    unsupportedRaw: parseStringList({
      value: ballot.unsupportedRaw,
      path: `${path}.unsupportedRaw`,
    },),
    dropped: parseChoiceList({
      value: ballot.dropped,
      path: `${path}.dropped`,
    },),
    droppedRaw: parseStringList({
      value: ballot.droppedRaw,
      path: `${path}.droppedRaw`,
    },),
    reason: requireString({
      value: ballot.reason,
      path: `${path}.reason`,
    },),
  };
}

//endregion Lane contest ballot reading
