// PROTOTYPE ONLY: Candidate K one-review unit admission.

import { assertReviewUnitBinding, } from './prototype-review-unit-author.ts';
import {
  ReviewUnitAdmissionError,
  assertReviewUnitEvidence,
} from './prototype-review-unit-evidence.ts';
import { diagnoseReviewUnitResponse, } from './prototype-review-unit-guard.ts';
import { assertReviewUnitManifest, } from './prototype-review-unit-manifest.ts';
import type {
  ReviewUnitAuthorSettlement,
  ReviewUnitResponse,
  ReviewUnitManifest,
  ReviewUnitStatusRow,
  CandidateScopedBallot,
} from './prototype-review-unit-model.ts';
import { candidatesFromReviewUnitSettlement, } from './prototype-review-unit-settlement.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Expands one compact string into durable manifest-indexed rows.
 *
 * @returns Rows in status-string order
 */
function expandStatuses({
  statuses,
  scope,
  cleanCode,
}: {
  readonly statuses: string;
  readonly scope: ReviewUnitStatusRow['scope'];
  readonly cleanCode: 'c' | 'p';
}): readonly ReviewUnitStatusRow[] {
  return (function expand(): readonly ReviewUnitStatusRow[] {
    /**
     * Runtime-owned rows.
     */
    const rows: ReviewUnitStatusRow[] = [];
    /**
     * UTF-16 cursor is exact because status alphabet is ASCII.
     */
    let manifestIndex = 0;
    while (manifestIndex < statuses.length) {
      /**
       * Current compact status.
       */
      const status = statuses[manifestIndex];
      if ((status !== cleanCode) && (status !== 'd'))
        throw new Error('review unit admitted status alphabet differs');
      rows.push({
        scope,
        manifestIndex,
        status,
      },);
      manifestIndex += 1;
    }
    return rows;
  })();
}

/**
 * Admits one complete candidate-scoped verifier response or throws.
 *
 * @returns Runtime-bound ballot after structural and semantic admission
 *
 * @example
 * ```ts
 * const ballot = admitReviewUnitResponse({
 *   response,
 *   ledger,
 *   authorSettlement,
 *   candidateOrdinal,
 *   verifierOrdinal,
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
export function admitReviewUnitResponse({
  response,
  ledger,
  authorSettlement,
  candidateOrdinal,
  verifierOrdinal,
  verifierModelId,
  manifest,
  expectedManifestDigest,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: ReviewUnitResponse;
  readonly ledger: RealizationObligationLedger;
  readonly authorSettlement: ReviewUnitAuthorSettlement;
  readonly candidateOrdinal: number;
  readonly verifierOrdinal: number;
  readonly verifierModelId: RosterModelId;
  readonly manifest: ReviewUnitManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): CandidateScopedBallot {
  assertReviewUnitManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  /**
   * Manifest verifier plan at exact ordinal.
   */
  const verifierPlan = manifest.verifierPlan[verifierOrdinal];
  if ((verifierPlan === undefined) || (verifierPlan.modelId !== verifierModelId))
    throw new ReviewUnitAdmissionError({
      failureCategory: 'candidate-binding',
      message: 'review unit verifier identity differs',
    },);
  /**
   * Candidate selected only from total author settlement.
   */
  const candidate = candidatesFromReviewUnitSettlement({
    settlement: authorSettlement,
    manifest,
  },)
    .find(function ordinal(value,) {
    return value.candidateOrdinal === candidateOrdinal;
  },);
  if (candidate === undefined)
    throw new ReviewUnitAdmissionError({
      failureCategory: 'candidate-binding',
      message: 'review unit author ordinal is unavailable',
    },);
  /**
   * First privacy-safe structural failure category.
   */
  const diagnosis = diagnoseReviewUnitResponse({
    value: response,
    ledger,
    candidate,
  },);
  if (diagnosis.kind === 'rejected')
    throw new ReviewUnitAdmissionError({
      failureCategory: diagnosis.failure,
      message: 'review unit response shape differs',
    },);
  assertReviewUnitBinding({
    candidate,
    manifest,
    shell,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  assertReviewUnitEvidence({
    response,
    candidate,
    ledger,
  });
  return {
    verifierModelId,
    candidateOrdinal,
    manifestDigest: manifest.manifestDigest,
    response,
    statusRows: [
      ...expandStatuses({
        statuses: response.obligationStatuses,
        scope: 'o',
        cleanCode: 'p',
      },),
      ...expandStatuses({
        statuses: response.globalStatuses,
        scope: 'g',
        cleanCode: 'c',
      },),
    ],
  };
}
