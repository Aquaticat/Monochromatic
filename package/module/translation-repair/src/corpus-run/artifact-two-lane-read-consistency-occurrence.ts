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
  type ArtifactConsistencyOccurrence,
  type ArtifactConsistencyRendering,
  CONSISTENCY_OCCURRENCE_OUTCOMES,
} from './artifact-two-lane-consistency.ts';

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
  'slot-no-agreement': true,
  'slot-empty': true,
  'slot-not-found': true,
  'slot-ambiguous': true,
};

/**
 Reads a place's rendering.

 @param value - recorded rendering

 @param path - where it sits, for the parse error

 @returns The rendering

 @throws {@link ArtifactParseError} when it is the wrong shape or kind

 @example
 ```ts
 const rendering = parseConsistencyRendering({ value: row.rendering, path: `${path}.rendering`, },);
 ```
 */
function parseConsistencyRendering(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactConsistencyRendering {
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
    return {
      kind,
      reason: requireKeyOf({
        value: record.reason,
        record: UNLOCATED_REASONS,
        path: `${path}.reason`,
      },),
    };
  }
  requireExactKeys({
    record,
    allowed: [
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
 Reads one place of a group.

 @param value - recorded place

 @param path - where it sits, for the parse error

 @returns The place

 @throws {@link ArtifactParseError} when it is the wrong shape, its offsets run
 backward, or its line is zero

 @example
 ```ts
 const occurrence = parseConsistencyOccurrence({ value, path: `${path}.occurrences[0]`, },);
 ```
 */
export function parseConsistencyOccurrence(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
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
  if ((endOffset <= startOffset) || (line < 1)) {
    throw new ArtifactParseError({
      path,
      reason: 'a place that ends after it starts, on a line counted from one',
    },);
  }
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
    },),
    outcome: requireKeyOf({
      value: record.outcome,
      record: CONSISTENCY_OCCURRENCE_OUTCOMES,
      path: `${path}.outcome`,
    },),
  };
}

//endregion Artifact consistency occurrence reading
