import {
  requireExactKeys,
  requireKeyOf,
  requireOneOf,
} from '../artifact-exact-guard.ts';
import {
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import type {
  ConsistencyWinner,
  NoWinnerReason,
} from '../consistency-count-types.ts';
import {
  type ArtifactConsistencyVerdict,
  CONSISTENCY_NOT_ASKED_REASONS,
} from './artifact-two-lane-consistency.ts';
import { parseConsistencyBallot, } from './artifact-two-lane-read-consistency-parts.ts';

//region Artifact consistency verdict reading
// Reading what was asked of the bench about one group and what it answered,
// key by key. What the verdict says about the group's places and ballots is
// the coherence check's question (`artifact-two-lane-read-consistency-coherence.ts`).

/**
 Every reason a group can have no winner, keyed by the union so the compiler
 refuses a member the record lacks.
 */
const NO_WINNER_REASONS: Readonly<Record<NoWinnerReason, true>> = {
  'no-quorum': true,
  'no-majority': true,
  'chosen-unlocated': true,
};

/**
 Reads the winner of a group the bench was asked about.

 @param value - recorded winner

 @param path - where it sits, for the parse error

 @returns The winner

 @throws {@link ArtifactParseError} when it is the wrong shape or kind

 @example
 ```ts
 const winner = parseConsistencyWinner({ value: record.winner, path: `${path}.winner`, },);
 ```
 */
function parseConsistencyWinner(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ConsistencyWinner {
  /**
   The winner as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  /**
   Whether a place won.
   */
  const kind = requireOneOf({
    value: record.kind,
    allowed: [
      'chosen',
      'none',
    ],
    path: `${path}.kind`,
  },);
  if (kind === 'chosen') {
    requireExactKeys({
      record,
      allowed: [
        'kind',
        'label',
      ],
      path,
    },);
    return {
      kind,
      label: requireString({
        value: record.label,
        path: `${path}.label`,
      },),
    };
  }
  requireExactKeys({
    record,
    allowed: [
      'kind',
      'reason',
    ],
    path,
  },);
  return {
    kind,
    reason: requireKeyOf({
      value: record.reason,
      record: NO_WINNER_REASONS,
      path: `${path}.reason`,
    },),
  };
}

/**
 Reads what was asked of the bench about a group.

 @param value - recorded verdict

 @param path - where it sits, for the parse error

 @returns The verdict

 @throws {@link ArtifactParseError} when it is the wrong shape or kind

 @example
 ```ts
 const verdict = parseConsistencyVerdict({ value: record.verdict, path: `${path}.verdict`, },);
 ```
 */
export function parseConsistencyVerdict(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactConsistencyVerdict {
  /**
   The verdict as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  /**
   Whether the bench was asked, and how that went.
   */
  const kind = requireOneOf({
    value: record.kind,
    allowed: [
      'not-asked',
      'failed',
      'asked',
    ],
    path: `${path}.kind`,
  },);
  if (kind === 'not-asked') {
    requireExactKeys({
      record,
      allowed: [
        'kind',
        'reason',
      ],
      path,
    },);
    return {
      kind,
      reason: requireKeyOf({
        value: record.reason,
        record: CONSISTENCY_NOT_ASKED_REASONS,
        path: `${path}.reason`,
      },),
    };
  }
  if (kind === 'failed') {
    requireExactKeys({
      record,
      allowed: [
        'kind',
        'detail',
      ],
      path,
    },);
    return {
      kind,
      detail: requireString({
        value: record.detail,
        path: `${path}.detail`,
      },),
    };
  }
  requireExactKeys({
    record,
    allowed: [
      'kind',
      'ballots',
      'usable',
      'quorum',
      'winner',
    ],
    path,
  },);
  return {
    kind,
    ballots: requireArray({
      value: record.ballots,
      path: `${path}.ballots`,
    },)
      .map(function toBallot(
        entry,
        at,
      ) {
        return parseConsistencyBallot({
          value: entry,
          path: `${path}.ballots[${String(at,)}]`,
        },);
      },),
    usable: requireCount({
      value: record.usable,
      path: `${path}.usable`,
    },),
    quorum: requireCount({
      value: record.quorum,
      path: `${path}.quorum`,
    },),
    winner: parseConsistencyWinner({
      value: record.winner,
      path: `${path}.winner`,
    },),
  };
}

//endregion Artifact consistency verdict reading
