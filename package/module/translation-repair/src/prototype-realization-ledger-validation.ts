// PROTOTYPE ONLY: Candidate G obligation-ledger validation.

import { hashContent, } from './document-node.ts';
import {
  assertObligationGrammar,
  assertSourceSpan,
  SOURCE_SLOT_ABSENT,
  sourceSlotForSpan,
} from './prototype-realization-ledger-grammar.ts';
import { realizationObligationEvidenceDigest, } from './prototype-realization-obligation.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import {
  MAX_REALIZATION_OBLIGATIONS,
  MAX_REALIZATION_RELATION_ENDPOINTS,
  MAX_REALIZATION_SOURCE_SPANS,
  type RealizationObligation,
  type RealizationObligationId,
  type RealizationObligationLedger,
  type RealizationSourceSlot,
  type RealizationSourceSpan,
} from './prototype-realization-model.ts';

//region Ledger validation

/**
 * Validates manifest source slots and their exact normalized body coverage.
 */
function assertSourceSlots({
  sourceSlots,
  sourceBody,
}: {
  readonly sourceSlots: readonly RealizationSourceSlot[];
  readonly sourceBody: string;
}): ReadonlyMap<string, RealizationSourceSlot> {
  if (sourceSlots.length === 0)
    throw new Error('realization source slot set is empty');
  const keys = sourceSlots.map(function key(slot,) { return slot.slotKey; },);
  if (new Set(keys,).size !== keys.length)
    throw new Error('realization source slot key repeats');
  const ordered = sourceSlots.toSorted(function position(
    left,
    right,
  ) { return left.startOffset - right.startOffset; },);
  ordered.forEach(function valid(
    slot,
    index,
  ) {
    const prior = ordered[index - 1];
    if ((!Number.isInteger(slot.startOffset,))
      || (!Number.isInteger(slot.endOffset,))
      || (slot.startOffset < 0)
      || (slot.startOffset >= slot.endOffset)
      || (slot.endOffset > sourceBody.length)
      || ((prior !== undefined) && (slot.startOffset < prior.endOffset)))
      throw new Error('realization source slot range differs from shell');
    if (slot.digest !== hashContent({ content: sourceBody.slice(
      slot.startOffset,
      slot.endOffset,
    ), }))
      throw new Error('realization source slot digest differs');
  },);
  return new Map(sourceSlots.map(function pair(slot,) { return [
    slot.slotKey,
    slot,
  ] as const; },),);
}

/**
 * Proves clause spans cover every non-whitespace source slot unit exactly once.
 */
function assertClauseCoverage({
  obligations,
  sourceSlots,
  sourceBody,
}: {
  readonly obligations: readonly RealizationObligation[];
  readonly sourceSlots: ReadonlyMap<string, RealizationSourceSlot>;
  readonly sourceBody: string;
}): void {
  for (const slot of sourceSlots.values()) {
    const spans = obligations
      .filter(function clause(obligation,) { return obligation.kind === 'clause'; },)
      .flatMap(function owned(obligation,): readonly RealizationSourceSpan[] {
        const span = obligation.sourceSpans[0];
        if (span === undefined)
          return [];
        const sourceSlot = sourceSlotForSpan({
          span,
          sourceSlots,
        });
        return (sourceSlot !== SOURCE_SLOT_ABSENT) && (sourceSlot.slotKey === slot.slotKey) ? [span,] : [];
      },)
      .toSorted(function position(
        left,
        right,
      ) { return left.startOffset - right.startOffset; },);
    let cursor = slot.startOffset;
    for (const span of spans) {
      if ((span.startOffset < cursor) || (sourceBody.slice(
        cursor,
        span.startOffset,
      )
        .trim()
        !== ''))
        throw new Error(`realization clause coverage overlaps or skips source slot ${slot.slotKey}`);
      cursor = span.endOffset;
    }
    if ((spans.length === 0) || (sourceBody.slice(
      cursor,
      slot.endOffset,
    )
      .trim()
      !== ''))
      throw new Error(`realization clause coverage is incomplete at source slot ${slot.slotKey}`);
  }
}

/**
 * Proves ledger source slots and shell digest match supplied immutable shell.
 */
export function assertRealizationLedgerBindsShell({
  ledger,
  shell,
  archiveBody,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly archiveBody: string;
}): void {
  const expected = shell.slots
    .map(function sourceSlot(slot,) {
    return {
      slotKey: slot.key,
      startOffset: slot.startOffset,
      endOffset: slot.endOffset,
      digest: hashContent({ content: shell.body
        .slice(
          slot.startOffset,
          slot.endOffset,
        ), }),
    };
  },);
  if ((ledger.shellDigest !== shell.shellDigest)
    || (JSON.stringify(ledger.sourceSlots,) !== JSON.stringify(expected,)))
    throw new Error('realization ledger source slots differ from immutable shell');
  assertRealizationObligationLedger({
    ledger,
    sourceBody: shell.body,
    archiveBody,
  },);
}

/**
 * Refuses unbounded, duplicate, dangling, or misbound obligation ledgers.
 */
export function assertRealizationObligationLedger({
  ledger,
  sourceBody,
  archiveBody,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly sourceBody: string;
  readonly archiveBody: string;
}): void {
  if ((ledger.offsetEncoding !== 'utf16-code-unit')
    || (ledger.rangeConvention !== 'half-open')
    || (ledger.lineEndings !== 'lf')
    || (ledger.digestAlgorithm !== 'sha256'))
    throw new Error('realization ledger coordinate or digest convention differs');
  if ((ledger.obligations
    .length
    === 0) || (ledger.obligations
      .length
      > MAX_REALIZATION_OBLIGATIONS))
    throw new Error('realization obligation count is outside finite bound');
  if ((ledger.sourceBodyDigest !== hashContent({ content: sourceBody, }))
    || (ledger.archiveBodyDigest !== hashContent({ content: archiveBody, })))
    throw new Error('realization ledger body digest differs');
  const sourceSlotMap = assertSourceSlots({
    sourceSlots: ledger.sourceSlots,
    sourceBody,
  });
  const ids = ledger.obligations
    .map(function identity(obligation,) { return obligation.id; });
  if (new Set(ids,).size !== ids.length)
    throw new Error('realization obligation id repeats');
  const idSet = new Set<RealizationObligationId>(ids,);
  const obligationMap = new Map(ledger.obligations
    .map(function pair(obligation,) {
    return [
      obligation.id,
      obligation,
    ] as const;
  },),);
  for (const obligation of ledger.obligations) {
    if ((obligation.sourceSpans
      .length
      > MAX_REALIZATION_SOURCE_SPANS)
      || (obligation.relationEndpoints
        .length
        > MAX_REALIZATION_RELATION_ENDPOINTS))
      throw new Error('realization obligation collection exceeds finite bound');
    for (const span of obligation.sourceSpans)
      assertSourceSpan({
        span,
        sourceBody,
        archiveBody,
      });
    if (!obligation.relationEndpoints
      .every(function known(endpoint,) { return idSet.has(endpoint,); }))
      throw new Error('realization relation endpoint is unknown');
    assertObligationGrammar({
      obligation,
      obligations: obligationMap,
      sourceSlots: sourceSlotMap,
    });
    const evidenceDigest = realizationObligationEvidenceDigest({ obligation: {
      kind: obligation.kind,
      sourceSpans: obligation.sourceSpans,
      relationEndpoints: obligation.relationEndpoints,
      allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
      targetCardinality: obligation.targetCardinality,
      authority: obligation.authority,
    }, });
    if (obligation.evidenceDigest !== evidenceDigest)
      throw new Error('realization obligation evidence digest differs');
  }
  assertClauseCoverage({
    obligations: ledger.obligations,
    sourceSlots: sourceSlotMap,
    sourceBody,
  });
}

//endregion Ledger validation
