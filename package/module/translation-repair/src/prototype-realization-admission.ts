// PROTOTYPE ONLY: Candidate G author candidate admission.

import { hashContent, } from './document-node.ts';
import { assertRealizationManifest, } from './prototype-realization-manifest.ts';
import {
  realizationAuthorResponseGuard,
  realizationCandidateAlias,
} from './prototype-realization-author.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';
import type {
  RealizationAuthorResponse,
  RealizationManifest,
  RealizationObligation,
  RealizationObligationLedger,
  RealizationTargetAnchor,
  RealizedCandidate,
} from './prototype-realization-model.ts';

//region Candidate admission

/**
 * Resolves exact manifest obligation or refuses unknown author row.
 */
function obligationFor({
  obligations,
  id,
}: {
  readonly obligations: ReadonlyMap<string, RealizationObligation>;
  readonly id: string;
}): RealizationObligation {
  const obligation = obligations.get(id,);
  if (obligation === undefined)
    throw new Error(`realization author obligation ${id} is unknown`);
  return obligation;
}

/**
 * Validates one target anchor against compiled slot text.
 */
function assertTargetAnchor({
  anchor,
  slots,
  obligation,
}: {
  readonly anchor: RealizationTargetAnchor;
  readonly slots: Readonly<Record<string, string>>;
  readonly obligation: RealizationObligation;
}): void {
  const text = slots[anchor.slotKey];
  if (text === undefined)
    throw new Error(`realization target anchor slot ${anchor.slotKey} is unknown`);
  if (!obligation.allowedTargetSlotKeys
    .includes(anchor.slotKey,))
    throw new Error(`realization target anchor slot differs from obligation ${obligation.id}`);
  const length = anchor.endOffset - anchor.startOffset;
  if ((!Number.isInteger(anchor.startOffset,))
    || (!Number.isInteger(anchor.endOffset,))
    || (anchor.startOffset < 0)
    || (length <= 0)
    || (anchor.endOffset > text.length))
    throw new Error('realization target anchor is outside half-open slot range');
  if (anchor.digest !== hashContent({ content: text.slice(
    anchor.startOffset,
    anchor.endOffset,
  ), }))
    throw new Error('realization target anchor digest differs');
}

/**
 * Converts structurally valid author response into runtime-bound whole candidate.
 */
export function admitRealizationAuthorResponse({
  response,
  shell,
  ledger,
  manifest,
  expectedManifestDigest,
  candidateOrdinal,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: RealizationAuthorResponse;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly manifest: RealizationManifest;
  readonly expectedManifestDigest: string;
  readonly candidateOrdinal: number;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): RealizedCandidate {
  assertRealizationManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  const plan = manifest.candidatePlan
    .find(function planned(value,) { return value.ordinal === candidateOrdinal; },);
  if (plan === undefined)
    throw new Error('realization author candidate ordinal is not manifested');
  const guard = realizationAuthorResponseGuard({
    shell,
    ledger,
  });
  if (!guard(response,))
    throw new Error('realization author response differs from manifest shape');
  const slots = Object.fromEntries(response.slots
    .map(function slot(row,) {
    return [
      row.slotKey,
      row.text,
    ] as const;
  },),);
  const obligations = new Map(ledger.obligations
    .map(function entry(obligation,) {
    return [
      obligation.id,
      obligation,
    ] as const;
  },),);
  const realizationEntries = response.realization
    .map(function claim(row,) {
    const obligation = obligationFor({
      obligations,
      id: row.obligationId,
    });
    if ((obligation.targetCardinality === 'one-or-more') && (row.targetAnchors
      .length
      === 0))
      throw new Error(`realization author obligation ${row.obligationId} has no target anchor`);
    if ((obligation.targetCardinality === 'shell-owned') && (row.targetAnchors
      .length
      > 0))
      throw new Error(`realization shell-owned obligation ${row.obligationId} claims model target`);
    for (const anchor of row.targetAnchors)
      assertTargetAnchor({
        anchor,
        slots,
        obligation,
      });
    const canonicalAnchors = row.targetAnchors
      .toSorted(function location(
        left,
        right,
      ) {
      return left.slotKey
        .localeCompare(right.slotKey,)
        || (left.startOffset - right.startOffset)
        || (left.endOffset - right.endOffset)
        || left.digest
        .localeCompare(right.digest,);
    },);
    const anchorKeys = canonicalAnchors
      .map(function key(anchor,) {
      return `${anchor.slotKey}\u0000${String(anchor.startOffset,)}\u0000${String(anchor.endOffset,)}`;
    },);
    if (new Set(anchorKeys,).size !== anchorKeys.length)
      throw new Error(`realization author obligation ${row.obligationId} repeats target anchor`);
    return [
      row.obligationId,
      canonicalAnchors,
    ] as const;
  },);
  const claimedAnchors = realizationEntries.flatMap(function claims(entry,) {
    return entry[1]
      .map(function owned(anchor,) { return {
        obligationId: entry[0],
        anchor,
      }; },);
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
    throw new Error('realization target ownership overlaps across obligations');
  const realization = Object.fromEntries(ledger.obligations
    .map(function ordered(obligation,) {
    const entry = realizationEntries.find(function matching(value,) { return value[0] === obligation.id; },);
    if (entry === undefined)
      throw new Error(`realization author obligation ${obligation.id} is absent after admission`);
    return entry;
  },),);
  const document = validateSlotCandidate({
    shell,
    response: { slots, },
    sourceText,
    archiveText,
    sourcePictures,
  },);
  const documentDigest = hashContent({ content: document, });
  const slotDigest = hashContent({ content: JSON.stringify(shell.slots
    .map(function binding(slot,) {
    return [
      slot.key,
      slots[slot.key],
    ];
  },),), });
  const realizationDigest = hashContent({ content: JSON.stringify(ledger.obligations
    .map(function binding(obligation,) {
    return [
      obligation.id,
      realization[obligation.id],
    ];
  },),), });
  const candidateId = realizationCandidateAlias({
    manifestDigest: manifest.manifestDigest,
    ordinal: candidateOrdinal,
  });
  return {
    candidateId,
    candidateOrdinal,
    manifestDigest: manifest.manifestDigest,
    modelId: plan.modelId,
    priority: plan.priority,
    document,
    documentDigest,
    slotDigest,
    realizationDigest,
    candidateDigest: hashContent({ content: JSON.stringify({
      candidateId,
      candidateOrdinal,
      manifestDigest: manifest.manifestDigest,
      modelId: plan.modelId,
      priority: plan.priority,
      documentDigest,
      slotDigest,
      realizationDigest,
    }), }),
    slots,
    realization,
  };
}

//endregion Candidate admission
