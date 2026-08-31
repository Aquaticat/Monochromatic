// PROTOTYPE ONLY: Candidate H bounded all-candidate ballot admission.

import { hashContent, } from './document-node.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import { assertBoundedCandidateBinding, } from './prototype-bounded-verdict-author.ts';
import { assertBoundedVerdictManifest, } from './prototype-bounded-verdict-manifest.ts';
import {
  BOUNDED_VERDICT_FINDING_CAP,
  type BoundedCandidate,
  type BoundedCandidateVerification,
  type BoundedFinding,
  type BoundedVerifierBallot,
  type BoundedVerifierResponse,
  type BoundedVerdictManifest,
  type BoundedAuthorSettlement,
} from './prototype-bounded-verdict-model.ts';
import {
  candidatesFromBoundedSettlement,
} from './prototype-bounded-verdict-settlement.ts';
import { boundedVerifierResponseGuard, } from './prototype-bounded-verdict-verifier-guard.ts';
import {
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Stable finding subject key independent of target evidence.
 *
 * @returns Scope and manifest index logical identity
 */
function findingKey({ finding, }: { readonly finding: BoundedFinding; }): string {
  return `${finding.scope}\u0000${String(finding.manifestIndex,)}`;
}

/**
 * Stable defect subject keys from complete status arrays.
 *
 * @returns Every explicit defect status as logical subject key
 */
function defectKeys({ verification, }: {
  readonly verification: BoundedCandidateVerification;
}): readonly string[] {
  return [
    ...verification.obligationStatuses
      .flatMap(function defect(
        code,
        index,
      ) {
      return code === 'd' ? [`o\u0000${String(index,)}`,] : [];
    },),
    ...verification.globalStatuses
      .flatMap(function defect(
        code,
        index,
      ) {
      return code === 'd' ? [`g\u0000${String(index,)}`,] : [];
    },),
  ];
}

/**
 * Refuses stale or overlapping UTF-16 target location.
 */
function assertAnchor({
  anchor,
  candidate,
  allowedSlotKeys,
}: {
  readonly anchor: RealizationTargetAnchor;
  readonly candidate: BoundedCandidate;
  readonly allowedSlotKeys?: readonly string[];
}): void {
  /**
   * Candidate slot cited by target anchor.
   */
  const text = candidate.slots[anchor.slotKey];
  /**
   * UTF-16 half-open anchor width.
   */
  const length = anchor.endOffset - anchor.startOffset;
  if ((text === undefined)
    || ((allowedSlotKeys !== undefined) && (!allowedSlotKeys.includes(anchor.slotKey,)))
    || (!Number.isInteger(anchor.startOffset,))
    || (!Number.isInteger(anchor.endOffset,))
    || (anchor.startOffset < 0)
    || (length <= 0)
    || (anchor.endOffset > text.length)
    || (anchor.digest !== hashContent({
      content: text.slice(
        anchor.startOffset,
        anchor.endOffset,
      ),
    },)))
    throw new Error('bounded verifier target anchor differs');
}

/**
 * Refuses repeated or overlapping anchors inside one finding.
 */
function assertDisjointAnchors({ anchors, }: {
  readonly anchors: readonly RealizationTargetAnchor[];
}): void {
  /**
   * Anchors ordered by slot then half-open offsets.
   */
  const ordered = anchors.toSorted(function location(
    left,
    right,
  ) {
    return left.slotKey
      .localeCompare(right.slotKey,)
      || (left.startOffset - right.startOffset)
      || (left.endOffset - right.endOffset);
  },);
  for (const [index, anchor,] of ordered.entries()) {
    /**
     * Prior anchor whose endpoint constrains this start.
     */
    const previous = ordered[index - 1];
    if ((previous !== undefined)
      && (previous.slotKey === anchor.slotKey)
      && (previous.endOffset > anchor.startOffset))
      throw new Error('bounded verifier target anchors overlap');
  }
}

/**
 * Validates one finding against candidate and manifest subject.
 */
function assertFinding({
  finding,
  candidate,
  ledger,
}: {
  readonly finding: BoundedFinding;
  readonly candidate: BoundedCandidate;
  readonly ledger: RealizationObligationLedger;
}): void {
  /**
   * Canonical defect class selected by compact index.
   */
  const defectClass = CONDITIONAL_DEFECT_CLASSES[finding.defectClassIndex];
  if (defectClass === undefined)
    throw new Error('bounded verifier defect class index differs');
  if ((finding.scope === 'g') && (defectClass === 'omission'))
    throw new Error('bounded verifier global omission class differs');
  /**
   * Whether source-located omission intentionally carries no target anchor.
   */
  const omission = (finding.scope === 'o') && (defectClass === 'omission');
  if ((omission && (finding.targetAnchors
    .length
    > 0))
    || ((!omission) && (finding.targetAnchors
      .length
      === 0)))
    throw new Error('bounded verifier omission target evidence differs');
  /**
   * Source obligation selected by finding manifest index.
   */
  const obligation = finding.scope === 'o'
    ? ledger.obligations[finding.manifestIndex]
    : undefined;
  if ((finding.scope === 'o') && (obligation === undefined))
    throw new Error('bounded verifier obligation index differs');
  if (omission && ((obligation?.sourceSpans
    .length
    ?? 0) === 0))
    throw new Error('bounded verifier omission obligation lacks source location');
  if ((finding.scope === 'g')
    && (REALIZATION_GLOBAL_CRITERIA[finding.manifestIndex] === undefined))
    throw new Error('bounded verifier global index differs');
  finding.targetAnchors
    .forEach(function anchor(value,) {
    assertAnchor({
      anchor: value,
      candidate,
      ...(obligation === undefined
        ? {}
        : { allowedSlotKeys: obligation.allowedTargetSlotKeys, }),
    },);
  },);
  assertDisjointAnchors({ anchors: finding.targetAnchors, });
}

/**
 * Validates exact overflow and finding-to-defect algebra for one row.
 */
function assertVerification({
  verification,
  candidate,
  ledger,
}: {
  readonly verification: BoundedCandidateVerification;
  readonly candidate: BoundedCandidate;
  readonly ledger: RealizationObligationLedger;
}): void {
  /**
   * Every explicit defect subject in complete status arrays.
   */
  const defects = defectKeys({ verification, });
  /**
   * Overflow bit derived exclusively from defect count and fixed cap.
   */
  const expectedOverflow = defects.length > BOUNDED_VERDICT_FINDING_CAP;
  /**
   * Unique logical subjects carried by bounded findings.
   */
  const keys = verification.findings
    .map(function key(finding,) {
    return findingKey({ finding, });
  },);
  if ((verification.overflow !== expectedOverflow)
    || (new Set(keys,).size !== keys.length)
    || keys.some(function unrelated(key,) { return !defects.includes(key,); }))
    throw new Error('bounded verifier overflow or finding subject differs');
  if (expectedOverflow) {
    if (verification.findings
      .length
      !== BOUNDED_VERDICT_FINDING_CAP)
      throw new Error('bounded verifier overflow certificate count differs');
  }
  else if ((verification.findings
    .length
    !== defects.length)
    || defects.some(function missing(key,) { return !keys.includes(key,); }))
    throw new Error('bounded verifier complete finding coverage differs');
  verification.findings
    .forEach(function finding(value,) {
    assertFinding({
      finding: value,
      candidate,
      ledger,
    });
  },);
}

/**
 * Admits atomic complete Candidate H verifier response or throws.
 *
 * @returns Runtime-bound complete verifier ballot
 *
 * @example
 * ```ts
 * const ballot = admitBoundedVerifierResponse({
 *   response,
 *   ledger,
 *   authorSettlement,
 *   verifierModelId,
 *   manifest,
 *   expectedManifestDigest,
 *   shell,
 *   sourceText,
 *   archiveText,
 *   sourcePictures,
 * });
 * ```
 */
export function admitBoundedVerifierResponse({
  response,
  ledger,
  authorSettlement,
  verifierModelId,
  manifest,
  expectedManifestDigest,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: BoundedVerifierResponse;
  readonly ledger: RealizationObligationLedger;
  readonly authorSettlement: BoundedAuthorSettlement;
  readonly verifierModelId: RosterModelId;
  readonly manifest: BoundedVerdictManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): BoundedVerifierBallot {
  assertBoundedVerdictManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  if (!manifest.verifierModelIds
    .includes(verifierModelId,))
    throw new Error('bounded verifier identity is not manifest-authorized');
  /**
   * Complete candidate set derived only from total author settlement.
   */
  const candidates = candidatesFromBoundedSettlement({
    settlement: authorSettlement,
    manifest,
  },);
  /**
   * Structural guard bound to exact candidate and ledger dimensions.
   */
  const guard = boundedVerifierResponseGuard({
    ledger,
    candidates,
  });
  if (!guard(response,))
    throw new Error('bounded verifier response shape differs');
  /**
   * Candidate lookup by anonymous runtime alias.
   */
  const byId = new Map(candidates.map(function candidate(value,) {
    return [
      value.candidateId,
      value,
    ] as const;
  },),);
  for (const candidate of candidates) {
    assertBoundedCandidateBinding({
      candidate,
      manifest,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  }
  for (const verification of response.candidates) {
    /**
     * Candidate bound to current complete verification row.
     */
    const candidate = byId.get(verification.candidateId,);
    if (candidate === undefined)
      throw new Error('bounded verifier candidate alias differs');
    assertVerification({
      verification,
      candidate,
      ledger,
    });
  }
  return {
    verifierModelId,
    manifestDigest: manifest.manifestDigest,
    response,
  };
}
