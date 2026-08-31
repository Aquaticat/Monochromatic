// PROTOTYPE ONLY: Candidate G deterministic source-obligation construction.

import { hashContent, } from './document-node.ts';
import {
  CLAUSE_TERMINALS,
  normalizeRealizationLineEndings,
  numberedId,
  sourceSpan,
  trimEnd,
  trimStart,
} from './prototype-realization-coordinate.ts';
import { assertRealizationObligationLedger, } from './prototype-realization-ledger-validation.ts';
import type { ImmutableSlot, } from './prototype-slot-model.ts';
import { realizationObligationEvidenceDigest, } from './prototype-realization-obligation.ts';
import type {
  RealizationObligation,
  RealizationObligationLedger,
  RealizationSourceSlot,
  RealizationSourceSpan,
} from './prototype-realization-model.ts';


//region Obligation construction

/**
 * Clause row plus source slot grouping used to derive inter-slot relations.
 */
type ClauseBuild = {
  readonly obligation: RealizationObligation;
  readonly slotKey: string;
};

/**
 * Splits one immutable source slot into bounded punctuation-ended clauses.
 */
function clausesForSlot({
  sourceBody,
  slot,
  firstIndex,
}: {
  readonly sourceBody: string;
  readonly slot: ImmutableSlot;
  readonly firstIndex: number;
}): readonly ClauseBuild[] {
  if (sourceBody.slice(
    slot.startOffset,
    slot.endOffset,
  ) !== slot.source)
    throw new Error(`realization source slot ${slot.key} differs from normalized body`);
  const collectedBoundaries = (function collectBoundaries(): readonly number[] {
    const held: number[] = [];
    let cursor = slot.startOffset;
    while (cursor < slot.endOffset) {
      const character = sourceBody[cursor];
      cursor += 1;
      if ((character !== undefined) && CLAUSE_TERMINALS.has(character,))
        held.push(cursor,);
    }
    return held;
  })();
  const boundaries = collectedBoundaries.at(-1,) === slot.endOffset
    ? collectedBoundaries
    : [
      ...collectedBoundaries,
      slot.endOffset,
    ];
  const ranges = boundaries.map(function range(
    boundary,
    index,
  ) {
    const previousBoundary = boundaries[index - 1];
    const priorBoundary = (index === 0) || (previousBoundary === undefined)
      ? slot.startOffset
      : previousBoundary;
    const startOffset = trimStart({
      text: sourceBody,
      startOffset: priorBoundary,
      endOffset: boundary,
    });
    const endOffset = trimEnd({
      text: sourceBody,
      startOffset,
      endOffset: boundary,
    });
    return {
      startOffset,
      endOffset,
    };
  },)
    .filter(function nonempty(range,) { return range.startOffset < range.endOffset; },);
  return ranges.map(function clauseBuild(
    range,
    index,
  ) {
    const span = sourceSpan({
      namespace: 'source-body',
      text: sourceBody,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    },);
    const evidence = {
      kind: 'clause',
      sourceSpans: [span,],
      relationEndpoints: [],
      allowedTargetSlotKeys: [slot.key,],
      targetCardinality: 'one-or-more',
      authority: 'source',
    } as const;
    const obligation: RealizationObligation = {
      id: numberedId({
        kind: 'clause',
        index: firstIndex + index,
      }),
      ...evidence,
      evidenceDigest: realizationObligationEvidenceDigest({ obligation: evidence, }),
    };
    return {
      obligation,
      slotKey: slot.key,
    };
  },);
}

/**
 * Derives one cross-slot relation from neighboring nonempty source slots.
 */
function relationBetween({
  left,
  right,
  index,
}: {
  readonly left: ClauseBuild;
  readonly right: ClauseBuild;
  readonly index: number;
}): RealizationObligation {
  const sourceSpans = [
    left.obligation
      .sourceSpans
      .at(-1,),
    right.obligation
      .sourceSpans[0],
  ].filter(function present(span,): span is RealizationSourceSpan { return span !== undefined; },);
  const relationEndpoints = [
    left.obligation
      .id,
    right.obligation
      .id,
  ];
  const evidence = {
    kind: 'relation',
    sourceSpans,
    relationEndpoints,
    allowedTargetSlotKeys: [...new Set([
      left.slotKey,
      right.slotKey,
    ],),],
    targetCardinality: 'one-or-more',
    authority: 'source',
  } as const;
  return {
    id: numberedId({
      kind: 'relation',
      index,
    }),
    ...evidence,
    evidenceDigest: realizationObligationEvidenceDigest({ obligation: evidence, }),
  };
}

/**
 * Builds closed-world clause and inter-slot relation ledger from immutable shell.
 */
export function buildRealizationObligationLedger({
  sourceBody,
  archiveBody,
  slots,
  shellDigest,
  extraObligations = [],
}: {
  readonly sourceBody: string;
  readonly archiveBody: string;
  readonly slots: readonly ImmutableSlot[];
  readonly shellDigest: string;
  readonly extraObligations?: readonly RealizationObligation[];
}): RealizationObligationLedger {
  const normalizedSource = normalizeRealizationLineEndings({ text: sourceBody, });
  const normalizedArchive = normalizeRealizationLineEndings({ text: archiveBody, });
  if (normalizedSource !== sourceBody)
    throw new Error('realization source body must be LF-normalized before shell offsets bind');
  const clauseBuilds = slots.reduce< readonly ClauseBuild[]>(
    function sourceClauses(
      rows,
      slot,
    ) {
    return [
      ...rows,
      ...clausesForSlot({
        sourceBody: normalizedSource,
        slot,
        firstIndex: rows.length,
      }),
    ];
  },
    [],
  );
  const slotGroups = Object.values(Object.groupBy(
    clauseBuilds,
    function bySlot(row,) { return row.slotKey; },
  ),)
    .flatMap(function present(group,): readonly (readonly ClauseBuild[])[] {
      return (group === undefined) || (group.length === 0) ? [] : [group,];
    },);
  const relations = slotGroups.slice(1,)
    .map(function relation(
      group,
      index,
    ) {
    const priorGroup = slotGroups[index];
    const left = priorGroup?.at(-1,);
    const right = group[0];
    if ((left === undefined) || (right === undefined))
      throw new Error('realization relation endpoints are absent');
    return relationBetween({
      left,
      right,
      index,
    });
  },);
  const obligations = [
    ...clauseBuilds.map(function clause(row,) { return row.obligation; },),
    ...relations,
    ...extraObligations,
  ];
  const sourceSlots: readonly RealizationSourceSlot[] = slots.map(function sourceSlot(slot,) {
    return {
      slotKey: slot.key,
      startOffset: slot.startOffset,
      endOffset: slot.endOffset,
      digest: hashContent({ content: normalizedSource.slice(
        slot.startOffset,
        slot.endOffset,
      ), }),
    };
  },);
  const ledger: RealizationObligationLedger = {
    offsetEncoding: 'utf16-code-unit',
    rangeConvention: 'half-open',
    lineEndings: 'lf',
    digestAlgorithm: 'sha256',
    shellDigest,
    sourceBodyDigest: hashContent({ content: normalizedSource, }),
    archiveBodyDigest: hashContent({ content: normalizedArchive, }),
    sourceSlots,
    obligations,
  };
  assertRealizationObligationLedger({
    ledger,
    sourceBody: normalizedSource,
    archiveBody: normalizedArchive,
  });
  return ledger;
}

//endregion Obligation construction
