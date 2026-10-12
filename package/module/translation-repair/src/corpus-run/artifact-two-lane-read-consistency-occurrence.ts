import {
  requireExactKeys,
  requireKeyOf,
  requireOneOf,
} from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import type { UnlocatedReason, } from '../consistency-count-types.ts';
import {
  artifactGenerationCountsBySpan,
  type TwoLaneArtifactGeneration,
} from './artifact-two-lane-contract.ts';
import {
  type ArtifactConsistencyOccurrence,
  type ArtifactConsistencyRendering,
  CONSISTENCY_OCCURRENCE_OUTCOMES,
  type ConsistencyOccurrenceOutcome,
} from './artifact-two-lane-consistency.ts';
import { requirePlaceBounds, } from './artifact-two-lane-read-consistency-parts.ts';

//region Artifact consistency occurrence reading
// Reading one place of a recorded group, key by key.

/**
 Every reason a place's rendering can be unlocated, keyed by the union so the
 compiler refuses a member the record lacks.
 */
const UNLOCATED_REASONS: Readonly<Record<UnlocatedReason, true>> = {
  'not-asked': true,
  'no-english': true,
  'no-agreement': true,
  empty: true,
  'not-found': true,
  ambiguous: true,
  markup: true,
  'overlaps-another': true,
  'slot-no-agreement': true,
  'slot-empty': true,
  'slot-not-found': true,
  'slot-ambiguous': true,
  'slot-whole': true,
};

/**
 Reasons only generation fifteen gives: a slot was a condition of a place being
 located there, so the five slot reasons were reasons for a place to stay as it
 stood. Generation sixteen locates a place on its quote alone.
 */
const SLOT_REASONS: ReadonlySet<UnlocatedReason> = new Set<UnlocatedReason>([
  'slot-no-agreement',
  'slot-empty',
  'slot-not-found',
  'slot-ambiguous',
  'slot-whole',
],);

/**
 Reads a place's rendering.

 @param value - recorded rendering

 @param path - where it sits, for the parse error

 @param generation - generation the section was written under, which says
 whether a located place carries its offset and which reasons exist

 @returns The rendering

 @throws {@link ArtifactParseError} when it is the wrong shape or kind, or a
 key, an offset or a reason belongs to the other generation

 @example
 ```ts
 const rendering = parseConsistencyRendering({ value: row.rendering, path: `${path}.rendering`, generation: 16, },);
 ```
 */
function parseConsistencyRendering(
  {
    value,
    path,
    generation,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly generation: TwoLaneArtifactGeneration;
  },
): ArtifactConsistencyRendering {
  /**
   Whether the section has the sixteenth shape.
   */
  const spanned = artifactGenerationCountsBySpan({ generation, },);
  /**
   The rendering as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  /**
   Whether the place's rendering was located.
   */
  const kind = requireOneOf({
    value: record.kind,
    allowed: [
      'located',
      'unlocated',
    ],
    path: `${path}.kind`,
  },);
  if (kind === 'unlocated') {
    requireExactKeys({
      record,
      allowed: [
        'kind',
        'reason',
      ],
      path,
    },);
    /**
     Why the rendering was not located.
     */
    const reason = requireKeyOf({
      value: record.reason,
      record: UNLOCATED_REASONS,
      path: `${path}.reason`,
    },);
    if (spanned && SLOT_REASONS.has(reason,)) {
      throw new ArtifactParseError({
        path: `${path}.reason`,
        reason: 'a reason generation sixteen gives, which locates a place on its quote and not its slot',
      },);
    }
    return {
      kind,
      reason,
    };
  }
  requireExactKeys({
    record,
    allowed: spanned
      ? [
        'kind',
        'quote',
        'start',
        'slot',
      ]
      : [
        'kind',
        'quote',
        'slot',
      ],
    path,
  },);
  return {
    kind,
    quote: requireString({
      value: record.quote,
      path: `${path}.quote`,
    },),
    ...(spanned
      ? {
        start: requireCount({
          value: record.start,
          path: `${path}.start`,
        },),
      }
      : {}),
    ...((record.slot === undefined)
      ? {}
      : {
        slot: requireString({
          value: record.slot,
          path: `${path}.slot`,
        },),
      }),
  };
}

/**
 Reads what became of a place.

 @param value - recorded outcome

 @param path - where it sits, for the parse error

 @param generation - generation the section was written under

 @returns The outcome

 @throws {@link ArtifactParseError} when it is not an outcome, or is `kept-current`
 in a generation that gives no such outcome

 @example
 ```ts
 const outcome = requireOutcome({ value: record.outcome, path: `${path}.outcome`, generation: 16, },);
 ```
 */
function requireOutcome(
  {
    value,
    path,
    generation,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly generation: TwoLaneArtifactGeneration;
  },
): ConsistencyOccurrenceOutcome {
  /**
   The outcome the artifact names.
   */
  const outcome = requireKeyOf({
    value,
    record: CONSISTENCY_OCCURRENCE_OUTCOMES,
    path,
  },);
  if ((outcome === 'kept-current') && (!artifactGenerationCountsBySpan({ generation, },))) {
    throw new ArtifactParseError({
      path,
      reason: 'an outcome generation fifteen gives, which has no carry to end in kept-current',
    },);
  }
  return outcome;
}

/**
 Reads one place of a group.

 @param value - recorded place

 @param path - where it sits, for the parse error

 @param generation - generation the section was written under

 @returns The place

 @throws {@link ArtifactParseError} when it is the wrong shape, its offsets run
 backward, its line is zero, or its rendering or outcome belongs to the other
 generation

 @example
 ```ts
 const occurrence = parseConsistencyOccurrence({ value, path: `${path}.occurrences[0]`, generation: 16, },);
 ```
 */
export function parseConsistencyOccurrence(
  {
    value,
    path,
    generation,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly generation: TwoLaneArtifactGeneration;
  },
): ArtifactConsistencyOccurrence {
  /**
   The place as a record.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'label',
      'sliceIndex',
      'startOffset',
      'endOffset',
      'line',
      'slotStartOffset',
      'slotEndOffset',
      'rendering',
      'outcome',
    ],
    path,
  },);
  /**
   Where the place starts and ends in the original.
   */
  const startOffset = requireCount({
    value: record.startOffset,
    path: `${path}.startOffset`,
  },);
  /**
   Exclusive end of the place in the original.
   */
  const endOffset = requireCount({
    value: record.endOffset,
    path: `${path}.endOffset`,
  },);
  /**
   One-based line.
   */
  const line = requireCount({
    value: record.line,
    path: `${path}.line`,
  },);
  requirePlaceBounds({
    startOffset,
    endOffset,
    line,
    path,
  },);
  return {
    label: requireString({
      value: record.label,
      path: `${path}.label`,
    },),
    sliceIndex: requireCount({
      value: record.sliceIndex,
      path: `${path}.sliceIndex`,
    },),
    startOffset,
    endOffset,
    line,
    ...((record.slotStartOffset === undefined)
      ? {}
      : {
        slotStartOffset: requireCount({
          value: record.slotStartOffset,
          path: `${path}.slotStartOffset`,
        },),
      }),
    ...((record.slotEndOffset === undefined)
      ? {}
      : {
        slotEndOffset: requireCount({
          value: record.slotEndOffset,
          path: `${path}.slotEndOffset`,
        },),
      }),
    rendering: parseConsistencyRendering({
      value: record.rendering,
      path: `${path}.rendering`,
      generation,
    },),
    outcome: requireOutcome({
      value: record.outcome,
      path: `${path}.outcome`,
      generation,
    },),
  };
}

//endregion Artifact consistency occurrence reading
