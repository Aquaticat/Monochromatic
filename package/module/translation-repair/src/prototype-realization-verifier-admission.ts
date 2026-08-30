// PROTOTYPE ONLY: Candidate G verifier evidence admission.

import { hashContent, } from './document-node.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import { assertRealizationLedgerBindsShell, } from './prototype-realization-ledger-validation.ts';
import {
  assertRealizationCandidateSetMatchesManifest,
  assertRealizationManifest,
} from './prototype-realization-manifest.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';
import { realizationVerifierResponseGuard, } from './prototype-realization-verifier.ts';
import {
  MAX_REALIZATION_TARGET_ANCHORS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationCandidateVerification,
  type RealizationFinding,
  type RealizationManifest,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
  type RealizationVerifierBallot,
  type RealizationVerifierResponse,
  type RealizedCandidate,
} from './prototype-realization-model.ts';

//region Evidence admission

/**
 * Resolves runtime candidate alias or refuses stale ballot row.
 */
function candidateFor({
  candidates,
  id,
}: {
  readonly candidates: ReadonlyMap<string, RealizedCandidate>;
  readonly id: string;
}): RealizedCandidate {
  const candidate = candidates.get(id,);
  if (candidate === undefined)
    throw new Error(`realization verifier candidate ${id} is unknown`);
  return candidate;
}

/**
 * Validates verifier-cited target range against exact candidate slot.
 */
function assertFindingTargetAnchor({
  anchor,
  candidate,
  allowedTargetSlotKeys,
}: {
  readonly anchor: RealizationTargetAnchor;
  readonly candidate: RealizedCandidate;
  readonly allowedTargetSlotKeys?: readonly string[];
}): void {
  const text = candidate.slots[anchor.slotKey];
  if (text === undefined)
    throw new Error(`realization verifier target slot ${anchor.slotKey} is unknown`);
  if ((allowedTargetSlotKeys !== undefined) && (!allowedTargetSlotKeys.includes(anchor.slotKey,)))
    throw new Error('realization verifier target slot differs from obligation ownership');
  const length = anchor.endOffset - anchor.startOffset;
  if ((!Number.isInteger(anchor.startOffset,))
    || (!Number.isInteger(anchor.endOffset,))
    || (anchor.startOffset < 0)
    || (length <= 0)
    || (anchor.endOffset > text.length))
    throw new Error('realization verifier target anchor is outside half-open slot range');
  if (anchor.digest !== hashContent({ content: text.slice(
    anchor.startOffset,
    anchor.endOffset,
  ), }))
    throw new Error('realization verifier target anchor digest differs');
}

/**
 * Stable logical finding identity independent of alternate evidence quotes.
 */
function findingKey({ finding, }: { readonly finding: RealizationFinding; }): string {
  const subject = finding.scope === 'obligation' ? finding.obligationId : finding.criterion;
  return `${finding.scope}\u0000${subject}\u0000${finding.defectClass}`;
}

/** Recomputes whole runtime candidate provenance, bytes, slots, and realization. */
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
  assertRealizationLedgerBindsShell({ ledger, shell, archiveBody: archiveText, });
  const expectedSlotKeys = shell.slots.map(function key(slot,) { return slot.key; },);
  const actualSlotKeys = Object.keys(candidate.slots,);
  const expectedObligationIds = ledger.obligations.map(function id(obligation,) { return obligation.id; },);
  const actualObligationIds = Object.keys(candidate.realization,);
  if ((actualSlotKeys.length !== expectedSlotKeys.length)
    || expectedSlotKeys.some(function missing(key,) { return !actualSlotKeys.includes(key,); })
    || (actualObligationIds.length !== expectedObligationIds.length)
    || expectedObligationIds.some(function missing(id,) { return !actualObligationIds.includes(id,); }))
    throw new Error(`realization candidate keys differ at ${candidate.candidateId}`);
  const claimedAnchors = ledger.obligations.flatMap(function claims(obligation,) {
    const anchors = candidate.realization[obligation.id] ?? [];
    if ((anchors.length > MAX_REALIZATION_TARGET_ANCHORS)
      || ((obligation.targetCardinality === 'one-or-more') && (anchors.length === 0))
      || ((obligation.targetCardinality === 'shell-owned') && (anchors.length !== 0)))
      throw new Error(`realization candidate cardinality differs at ${obligation.id}`);
    for (const anchor of anchors) {
      assertFindingTargetAnchor({
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
    return anchors.map(function owned(anchor,) { return { obligationId: obligation.id, anchor, }; },);
  },);
  const ownershipOverlaps = claimedAnchors.some(function overlaps(left, index,) {
    return claimedAnchors.slice(index + 1,).some(function rightOverlap(right,) {
      return (left.obligationId !== right.obligationId)
        && (left.anchor.slotKey === right.anchor.slotKey)
        && (left.anchor.startOffset < right.anchor.endOffset)
        && (right.anchor.startOffset < left.anchor.endOffset);
    },);
  },);
  if (ownershipOverlaps)
    throw new Error('realization candidate target ownership overlaps');
  if ((candidate.manifestDigest !== manifestDigest)
    || (candidate.candidateId !== realizationCandidateAlias({
      manifestDigest,
      ordinal: candidate.candidateOrdinal,
    },))
    || !Number.isInteger(candidate.priority,))
    throw new Error(`realization candidate provenance differs at ${candidate.candidateId}`);
  const realizationDigest = hashContent({ content: JSON.stringify(ledger.obligations.map(function binding(obligation,) {
    return [obligation.id, candidate.realization[obligation.id],];
  },),), });
  const document = validateSlotCandidate({
    shell,
    response: { slots: candidate.slots, },
    sourceText,
    archiveText,
    sourcePictures,
  },);
  const documentDigest = hashContent({ content: document, });
  const slotDigest = hashContent({ content: JSON.stringify(shell.slots.map(function binding(slot,) {
    return [slot.key, candidate.slots[slot.key],];
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

/**
 * Validates one complete candidate matrix against manifest and exact candidate bytes.
 */
function assertCandidateVerification({
  verification,
  candidate,
  ledger,
  shell,
  manifestDigest,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly verification: RealizationCandidateVerification;
  readonly candidate: RealizedCandidate;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly manifestDigest: string;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
  assertRealizedCandidateBinding({
    candidate,
    ledger,
    shell,
    manifestDigest,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  if (verification.candidateDigest !== candidate.candidateDigest)
    throw new Error(`realization verifier candidate digest differs at ${candidate.candidateId}`);
  const statuses = new Map(verification.obligations
    .map(function pair(status,) {
    return [
      status.obligationId,
      status,
    ] as const;
  },),);
  const globals = new Map(verification.globalChecks
    .map(function pair(status,) {
    return [
      status.criterion,
      status,
    ] as const;
  },),);
  const obligationMap = new Map(ledger.obligations
    .map(function pair(obligation,) {
    return [
      obligation.id,
      obligation,
    ] as const;
  },),);
  for (const obligation of ledger.obligations) {
    const status = statuses.get(obligation.id,);
    if (status === undefined)
      throw new Error(`realization verifier obligation ${obligation.id} is absent`);
    if (status.obligationEvidenceDigest !== obligation.evidenceDigest)
      throw new Error(`realization verifier source evidence differs at ${obligation.id}`);
    const anchors = status.verifiedTargetAnchors;
    for (const anchor of anchors) {
      assertFindingTargetAnchor({
        anchor,
        candidate,
        allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
      },);
    }
    const anchorKeys = anchors.map(function key(anchor,) {
      return `${anchor.slotKey}\u0000${String(anchor.startOffset,)}\u0000${String(anchor.endOffset,)}`;
    },);
    if (new Set(anchorKeys,).size !== anchorKeys.length)
      throw new Error(`realization verifier anchor repeats at ${obligation.id}`);
    if ((status.status === 'preserved')
      && (obligation.targetCardinality === 'one-or-more')
      && (anchors.length === 0))
      throw new Error(`realization verifier preserved obligation ${obligation.id} has no confirmed anchor`);
  }
  const verifiedOwnership = verification.obligations.flatMap(function owned(status,) {
    return status.verifiedTargetAnchors.map(function anchor(value,) {
      return { obligationId: status.obligationId, anchor: value, };
    },);
  },);
  const verifierOwnershipOverlaps = verifiedOwnership.some(function overlaps(left, index,) {
    return verifiedOwnership.slice(index + 1,).some(function rightOverlap(right,) {
      return (left.obligationId !== right.obligationId)
        && (left.anchor.slotKey === right.anchor.slotKey)
        && (left.anchor.startOffset < right.anchor.endOffset)
        && (right.anchor.startOffset < left.anchor.endOffset);
    },);
  },);
  if (verifierOwnershipOverlaps)
    throw new Error('realization verifier target ownership overlaps');
  for (const criterion of REALIZATION_GLOBAL_CRITERIA) {
    if (globals.get(criterion,) === undefined)
      throw new Error(`realization verifier global criterion ${criterion} is absent`);
  }
  const keys = verification.findings
    .map(function key(finding,) { return findingKey({ finding, }); },);
  if (new Set(keys,).size !== keys.length)
    throw new Error(`realization verifier finding repeats at ${candidate.candidateId}`);
  for (const finding of verification.findings) {
    const obligation = finding.scope === 'obligation'
      ? obligationMap.get(finding.obligationId,)
      : undefined;
    for (const anchor of finding.targetAnchors) {
      if (obligation === undefined)
        assertFindingTargetAnchor({
          anchor,
          candidate,
        },);
      else {
        assertFindingTargetAnchor({
          anchor,
          candidate,
          allowedTargetSlotKeys: obligation.allowedTargetSlotKeys,
        },);
      }
    }
    if (finding.scope === 'obligation') {
      if (obligation === undefined)
        throw new Error(`realization verifier finding obligation ${finding.obligationId} is unknown`);
      if ((finding.defectClass === 'omission') && (finding.targetAnchors.length !== 0))
        throw new Error('realization omission finding must not claim target anchor');
      if ((finding.defectClass !== 'omission') && (finding.targetAnchors.length === 0))
        throw new Error('realization non-omission finding needs target anchor');
    }
    else {
      if (!globals.has(finding.criterion,))
        throw new Error(`realization verifier finding criterion ${finding.criterion} is unknown`);
      if (finding.defectClass === 'omission')
        throw new Error('realization global omission must use source obligation scope');
      if (finding.targetAnchors
        .length
        === 0)
        throw new Error('realization global finding needs target anchor');
    }
  }
  for (const status of verification.obligations) {
    const hasFinding = verification.findings
      .some(function linked(finding,) {
      return (finding.scope === 'obligation') && (finding.obligationId === status.obligationId);
    },);
    if ((status.status === 'defect') !== hasFinding)
      throw new Error(`realization verifier obligation evidence differs at ${status.obligationId}`);
  }
  for (const status of verification.globalChecks) {
    const hasFinding = verification.findings
      .some(function linked(finding,) {
      return (finding.scope === 'global') && (finding.criterion === status.criterion);
    },);
    if ((status.status === 'defect') !== hasFinding)
      throw new Error(`realization verifier global evidence differs at ${status.criterion}`);
  }
}

/**
 * Admits full verifier matrix and attaches runtime-owned identity and manifest.
 */
export function admitRealizationVerifierResponse({
  response,
  ledger,
  candidates,
  verifierModelId,
  manifest,
  expectedManifestDigest,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: RealizationVerifierResponse;
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly RealizedCandidate[];
  readonly verifierModelId: RealizationVerifierBallot['verifierModelId'];
  readonly manifest: RealizationManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): RealizationVerifierBallot {
  assertRealizationManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  assertRealizationCandidateSetMatchesManifest({ candidates, manifest, });
  if (!manifest.verifierModelIds.includes(verifierModelId,))
    throw new Error('realization verifier identity is not manifested');
  const guard = realizationVerifierResponseGuard({
    ledger,
    candidates,
  });
  if (!guard(response,))
    throw new Error('realization verifier response differs from full manifest matrix');
  const candidateMap = new Map(candidates.map(function pair(candidate,) {
    return [
      candidate.candidateId,
      candidate,
    ] as const;
  },),);
  for (const verification of response.candidates) {
    assertCandidateVerification({
      verification,
      candidate: candidateFor({
        candidates: candidateMap,
        id: verification.candidateId,
      }),
      ledger,
      shell,
      manifestDigest: manifest.manifestDigest,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  }
  return {
    verifierModelId,
    manifestDigest: manifest.manifestDigest,
    response,
  };
}

//endregion Evidence admission
