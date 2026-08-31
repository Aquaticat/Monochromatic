// PROTOTYPE ONLY: Candidate G full runtime candidate revalidation.

import { hashContent, } from './document-node.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import { assertRealizationLedgerBindsShell, } from './prototype-realization-ledger-validation.ts';
import {
  MAX_REALIZATION_TARGET_ANCHORS,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
  type RealizedCandidate,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';

/** Obligation ownership attached to one exact immutable target range. */
type OwnedTargetAnchor = {
  readonly obligationId: string;
  readonly anchor: RealizationTargetAnchor;
};

/**
 * Validates candidate-owned target range against exact allowed slot bytes.
 */
function assertCandidateTargetAnchor({
  anchor,
  candidate,
  allowedTargetSlotKeys,
}: {
  readonly anchor: RealizationTargetAnchor;
  readonly candidate: RealizedCandidate;
  readonly allowedTargetSlotKeys: readonly string[];
}): void {
  const text = candidate.slots[anchor.slotKey];
  if ((text === undefined) || (!allowedTargetSlotKeys.includes(anchor.slotKey,)))
    throw new Error('realization candidate target slot differs from obligation ownership');
  const length = anchor.endOffset - anchor.startOffset;
  if ((!Number.isInteger(anchor.startOffset,))
    || (!Number.isInteger(anchor.endOffset,))
    || (anchor.startOffset < 0)
    || (length <= 0)
    || (anchor.endOffset > text.length))
    throw new Error('realization candidate target anchor is outside half-open slot range');
  if (anchor.digest !== hashContent({ content: text.slice(
    anchor.startOffset,
    anchor.endOffset,
  ), }))
    throw new Error('realization candidate target anchor digest differs');
}

/**
 * Recomputes whole runtime candidate provenance, bytes, slots, and realization.
 */
export function assertRealizedCandidateBinding({
  candidate,
  ledger,
  shell,
  manifestDigest,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly candidate: RealizedCandidate;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly manifestDigest: string;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
  assertRealizationLedgerBindsShell({
    ledger,
    shell,
    archiveBody: archiveText,
  });
  const expectedSlotKeys = shell.slots
    .map(function key(slot,) { return slot.key; },);
  const actualSlotKeys = Object.keys(candidate.slots,);
  const expectedObligationIds = ledger.obligations
    .map(function id(obligation,) { return obligation.id; },);
  const actualObligationIds = Object.keys(candidate.realization,);
  if ((actualSlotKeys.length !== expectedSlotKeys.length)
    || expectedSlotKeys.some(function missing(key,) { return !actualSlotKeys.includes(key,); })
    || (actualObligationIds.length !== expectedObligationIds.length)
    || expectedObligationIds.some(function missing(id,) { return !actualObligationIds.includes(id,); }))
    throw new Error(`realization candidate keys differ at ${candidate.candidateId}`);
  const claimedAnchors = ledger.obligations
    .flatMap(function claims(obligation,) {
    const anchors = candidate.realization[obligation.id] ?? [];
    if ((anchors.length > MAX_REALIZATION_TARGET_ANCHORS)
      || ((obligation.targetCardinality === 'one-or-more') && (anchors.length === 0))
      || ((obligation.targetCardinality === 'shell-owned') && (anchors.length > 0)))
      throw new Error(`realization candidate cardinality differs at ${obligation.id}`);
    for (const anchor of anchors) {
      assertCandidateTargetAnchor({
        anchor,
        candidate,
        allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
      },);
    }
    const keys = anchors.map(function key(anchor,) {
      return `${anchor.slotKey}\u0000${String(anchor.startOffset,)}\u0000${String(anchor.endOffset,)}`;
    },);
    if (new Set(keys,).size !== keys.length)
      throw new Error(`realization candidate anchor repeats at ${obligation.id}`);
    return anchors.map(function owned(anchor,): OwnedTargetAnchor {
      return {
        obligationId: obligation.id,
        anchor,
      };
    },);
  },);
  const ownershipOverlaps = claimedAnchors.some(function overlaps(
    left,
    index,
  ) {
    return claimedAnchors.slice(index + 1,)
      .some(function rightOverlap(right,) {
      return (left.obligationId !== right.obligationId)
        && (left.anchor
          .slotKey
          === right.anchor
          .slotKey)
        && (left.anchor
          .startOffset
          < right.anchor
          .endOffset)
        && (right.anchor
          .startOffset
          < left.anchor
          .endOffset);
    },);
  },);
  if (ownershipOverlaps)
    throw new Error('realization candidate target ownership overlaps');
  if ((candidate.manifestDigest !== manifestDigest)
    || (candidate.candidateId !== realizationCandidateAlias({
      manifestDigest,
      ordinal: candidate.candidateOrdinal,
    },))
    || (!Number.isInteger(candidate.priority,)))
    throw new Error(`realization candidate provenance differs at ${candidate.candidateId}`);
  const realizationDigest = hashContent({ content: JSON.stringify(ledger.obligations
    .map(function binding(obligation,) {
    return [
      obligation.id,
      candidate.realization[obligation.id],
    ];
  },),), });
  const document = validateSlotCandidate({
    shell,
    response: { slots: candidate.slots, },
    sourceText,
    archiveText,
    sourcePictures,
  },);
  const documentDigest = hashContent({ content: document, });
  const slotDigest = hashContent({ content: JSON.stringify(shell.slots
    .map(function binding(slot,) {
    return [
      slot.key,
      candidate.slots[slot.key],
    ];
  },),), });
  const candidateDigest = hashContent({ content: JSON.stringify({
    candidateId: candidate.candidateId,
    candidateOrdinal: candidate.candidateOrdinal,
    manifestDigest,
    modelId: candidate.modelId,
    priority: candidate.priority,
    documentDigest,
    slotDigest,
    realizationDigest,
  },), });
  if ((candidate.document !== document)
    || (candidate.documentDigest !== documentDigest)
    || (candidate.slotDigest !== slotDigest)
    || (candidate.realizationDigest !== realizationDigest)
    || (candidate.candidateDigest !== candidateDigest))
    throw new Error(`realization candidate binding differs at ${candidate.candidateId}`);
}
