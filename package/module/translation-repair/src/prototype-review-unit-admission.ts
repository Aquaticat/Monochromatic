// PROTOTYPE ONLY: Candidate K one-review-unit admission.

import { assertReviewUnitBinding, } from './prototype-review-unit-author.ts';
import {
  ReviewUnitAdmissionError,
  assertReviewUnitEvidence,
} from './prototype-review-unit-evidence.ts';
import { diagnoseReviewUnitResponse, } from './prototype-review-unit-guard.ts';
import { assertReviewUnitManifest, } from './prototype-review-unit-manifest.ts';
import type {
  ReviewUnitAuthorSettlement,
  ReviewUnitBallot,
  ReviewUnitManifest,
  ReviewUnitResponse,
  ReviewUnitStatusRow,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import { candidatesFromReviewUnitSettlement, } from './prototype-review-unit-settlement.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Expands one compact string into durable review-subject rows.
 *
 * @returns Rows in canonical subject order
 */
function expandStatuses({
  statuses,
  scope,
  cleanCode,
  subjectIndexes,
}: {
  readonly statuses: string;
  readonly scope: ReviewUnitStatusRow['scope'];
  readonly cleanCode: 'c' | 'p';
  readonly subjectIndexes: readonly number[];
}): readonly ReviewUnitStatusRow[] {
  return subjectIndexes.map(function row(
    subjectIndex,
    position,
  ) {
    /**
     * Current compact status at canonical position.
     */
    const status = statuses[position];
    if ((status !== cleanCode) && (status !== 'd'))
      throw new Error('review unit admitted status alphabet differs');
    return {
      scope,
      subjectIndex,
      status,
    };
  },);
}

/**
 * Admits one complete candidate-scoped verifier response or throws.
 *
 * @returns Runtime-bound ballot after structural and semantic admission
 *
 * @example
 * ```ts
 * const ballot = admitReviewUnitResponse(input,);
 * ```
 */
export function admitReviewUnitResponse({
  response,
  ledger,
  reviewPlan,
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
  readonly reviewPlan: ReviewUnitPlan;
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
}): ReviewUnitBallot {
  assertReviewUnitManifest({
    manifest,
    ledger,
    shell,
    sourceText,
    sourceBody: shell.body,
    archiveBody: archiveText,
    reviewPlan,
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
  })
    .find(function ordinal(value,) { return value.candidateOrdinal === candidateOrdinal; });
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
    reviewPlan,
    candidate,
    pictureCount: sourcePictures.length,
  },);
  if (diagnosis.kind === 'rejected')
    throw new ReviewUnitAdmissionError({
      failureCategory: diagnosis.failure,
      message: 'review unit response shape differs',
    },);
  assertReviewUnitBinding({
    candidate,
    manifest,
    reviewPlan,
    shell,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  assertReviewUnitEvidence({
    response,
    candidate,
    reviewPlan,
    pictureCount: sourcePictures.length,
  });
  /**
   * Clause rows flattened by plan slot groups.
   */
  const clauseRows = reviewPlan.slotGroups
    .flatMap(function group(
      value,
      groupIndex,
    ) {
    return expandStatuses({
      statuses: response.clauseStatusesBySlot[groupIndex] ?? '',
      scope: 'c',
      cleanCode: 'p',
      subjectIndexes: value.clauseSubjectIndexes,
    });
  },);
  return {
    verifierModelId,
    candidateOrdinal,
    manifestDigest: manifest.manifestDigest,
    response,
    statusRows: [
      ...expandStatuses({
        statuses: response.frontMatterStatuses,
        scope: 'fm',
        cleanCode: 'p',
        subjectIndexes: reviewPlan.frontMatterSubjects
          .map(function index(value,) { return value.subjectIndex; }),
      }),
      ...clauseRows,
      ...expandStatuses({
        statuses: response.relationStatuses,
        scope: 'r',
        cleanCode: 'p',
        subjectIndexes: reviewPlan.relations
          .map(function index(value,) { return value.subjectIndex; }),
      }),
      ...expandStatuses({
        statuses: response.slotLanguageStatuses,
        scope: 'sl',
        cleanCode: 'c',
        subjectIndexes: (candidate.mutableSlotKeys
          ?? reviewPlan.slotGroups
          .map(function key(value,) { return value.slotKey; }))
          .map(function index(
            _value,
            position,
          ) { return position; }),
      }),
      ...expandStatuses({
        statuses: response.globalStatuses,
        scope: 'g',
        cleanCode: 'c',
        subjectIndexes: reviewPlan.globalCriteria
          .map(function index(
            _value,
            position,
          ) { return position; }),
      }),
    ],
  };
}
