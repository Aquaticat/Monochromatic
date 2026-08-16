import {
  ArtifactParseError,
  requireArray,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import {
  requireExactKeys,
  requireOneOf,
} from '../artifact-exact-guard.ts';
import type {
  ArtifactDecisionComparisonV2,
  ArtifactSliceDeliveryV2,
  ArtifactSliceOutcomeV2,
} from './artifact-v2-vocabulary.ts';

//region Artifact version 2 union parsing
// Reading the three small unions a version 2 row dispatches on, back off disk.
//
// EVERY MEMBER'S KEYS ARE LISTED, per member rather than per union, because
// that is the check the shape needs: `{ kind: 'not-evaluated', acceptedText }`
// is not a slice this version can describe, and a parser reading the
// discriminator and then taking whatever fields it recognizes would accept it
// and hand a reader an outcome carrying a wording nobody decided.
//
// AN UNKNOWN DISCRIMINATOR IS ALWAYS REFUSED, in both modes below. It names a
// member this version cannot project into any of its own, so there is no
// tolerant reading of it: taking the row anyway would mean recording a slice
// under a name this reader made up.

/**
 * What a reader does about keys the version does not name here.
 *
 * @example
 * ```ts
 * const unknownKeys: UnknownKeyPolicy = 'tolerate';
 * ```
 */
export type UnknownKeyPolicy =
  /**
   * Refuse them, which is right everywhere version 2 owns the shape.
   */
  | 'refuse'
  /**
   * Take the fields this version names and leave the rest, which is right
   * inside a raw lane result: those are typed by the live pipeline, they grow
   * by addition, and a later field there is not a later version here.
   */
  | 'tolerate';

/**
 * Keys each outcome member may carry, including its own discriminator.
 */
const OUTCOME_KEYS: Readonly<Record<ArtifactSliceOutcomeV2['kind'], readonly string[]>> = {
  decided: [
    'kind',
    'acceptedText',
  ],
  'not-evaluated': ['kind',],
  unfilled: ['kind',],
  'incumbent-fallback': ['kind',],
  'not-applicable': ['kind',],
};

/**
 * Fields this version gives a MEANING to on some outcome member.
 *
 * Checked even where unknown keys are tolerated, because the two cases are not
 * alike: a field version 2 never heard of is a later pipeline adding evidence,
 * while `acceptedText` on a member that decided nothing is this version's own
 * vocabulary used to say something it cannot mean.
 */
const RESERVED_OUTCOME_KEYS: readonly string[] = ['acceptedText',];

/**
 * Reads what a lane did about one slice.
 *
 * @param value - outcome JSON
 *
 * @param unknownKeys - what to do about keys this version does not name, which
 * differs between the ledger, whose shape version 2 owns, and a raw lane
 * result, which the live pipeline owns
 *
 * @param path - dotted path for error message
 *
 * @returns Outcome as version 2 describes it
 *
 * @throws {@link ArtifactParseError} when the discriminator names no member of
 * this version, when a member carries a field belonging to another, or when a
 * decision carries no wording
 *
 * @example
 * ```ts
 * const outcome = parseSliceOutcomeV2({ value, unknownKeys: 'refuse', path, },);
 * ```
 */
export function parseSliceOutcomeV2(
  {
    value,
    unknownKeys,
    path,
  }: {
    readonly value: unknown;
    readonly unknownKeys: UnknownKeyPolicy;
    readonly path: string;
  },
): ArtifactSliceOutcomeV2 {
  /**
   * Outcome as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);

  /**
   * Member it names.
   */
  const kind = requireOneOf({
    value: record.kind,
    allowed: [
      'decided',
      'not-evaluated',
      'unfilled',
      'incumbent-fallback',
      'not-applicable',
    ],
    path: `${path}.kind`,
  },);

  /**
   * Keys this member may carry.
   */
  const allowed = OUTCOME_KEYS[kind];
  if (unknownKeys === 'refuse') {
    requireExactKeys({
      record,
      allowed,
      path,
    },);
  } else {
    /**
     * Reserved field this member has no meaning for, or nothing.
     */
    const misplaced = RESERVED_OUTCOME_KEYS.find(function isMisplaced(key,): boolean {
      return (key in record) && (!allowed.includes(key,));
    },);
    if (misplaced !== undefined) {
      throw new ArtifactParseError({
        path: `${path}.${misplaced}`,
        reason: `no ${misplaced} on an outcome of kind ${kind}, which decided nothing`,
      },);
    }
  }
  if (kind === 'decided') {
    return {
      kind,
      acceptedText: requireString({
        value: record.acceptedText,
        path: `${path}.acceptedText`,
      },),
    };
  }
  return { kind, };
}

/**
 * Reads how one lane's document came to carry what it carries.
 *
 * @param value - delivery JSON
 *
 * @param path - dotted path for error message
 *
 * @returns Delivery as version 2 describes it
 *
 * @throws {@link ArtifactParseError} when the discriminator names no member of
 * this version, when a member carries a key belonging to another, or when a
 * withdrawal names no mechanism
 *
 * @example
 * ```ts
 * const delivery = parseSliceDeliveryV2({ value, path, },);
 * ```
 */
export function parseSliceDeliveryV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactSliceDeliveryV2 {
  /**
   * Delivery as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);

  /**
   * Member it names.
   */
  const kind = requireOneOf({
    value: record.kind,
    allowed: [
      'replacement-shipped',
      'replacement-withdrawn',
      'incumbent-retained',
      'gap-remains',
    ],
    path: `${path}.kind`,
  },);
  if (kind === 'replacement-withdrawn') {
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
      reason: requireOneOf({
        value: record.reason,
        allowed: [
          'assembly-integrity',
          'blocked-non-translation',
        ],
        path: `${path}.reason`,
      },),
    };
  }
  requireExactKeys({
    record,
    allowed: ['kind',],
    path,
  },);
  return { kind, };
}

/**
 * Reads whether the two lanes' own decisions were comparable.
 *
 * @param value - decision comparison JSON
 *
 * @param path - dotted path for error message
 *
 * @returns Decision comparison as version 2 describes it
 *
 * @throws {@link ArtifactParseError} when the discriminator names no member of
 * this version, when a member carries a key belonging to another, or when an
 * undecided lane is named something other than a lane
 *
 * @example
 * ```ts
 * const decisions = parseDecisionComparisonV2({ value, path, },);
 * ```
 */
export function parseDecisionComparisonV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactDecisionComparisonV2 {
  /**
   * Comparison as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);

  /**
   * Member it names.
   */
  const kind = requireOneOf({
    value: record.kind,
    allowed: [
      'comparable',
      'not-comparable',
    ],
    path: `${path}.kind`,
  },);
  if (kind === 'comparable') {
    requireExactKeys({
      record,
      allowed: [
        'kind',
        'verdict',
      ],
      path,
    },);
    return {
      kind,
      verdict: requireOneOf({
        value: record.verdict,
        allowed: [
          'same',
          'different',
        ],
        path: `${path}.verdict`,
      },),
    };
  }
  requireExactKeys({
    record,
    allowed: [
      'kind',
      'undecidedLanes',
    ],
    path,
  },);
  return {
    kind,
    undecidedLanes: requireArray({
      value: record.undecidedLanes,
      path: `${path}.undecidedLanes`,
    },)
      .map(function readLane(
        lane,
        position,
      ) {
        return requireOneOf({
          value: lane,
          allowed: [
            'repair',
            'translate',
          ],
          path: `${path}.undecidedLanes[${String(position,)}]`,
        },);
      },),
  };
}

//endregion Artifact version 2 union parsing
