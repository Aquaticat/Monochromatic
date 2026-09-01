// PROTOTYPE ONLY: Candidate K restartable one-candidate verifier node.

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { admitReviewUnitResponse, } from './prototype-review-unit-admission.ts';
import { assertReviewUnitBinding, } from './prototype-review-unit-author.ts';
import { ReviewUnitAdmissionError, } from './prototype-review-unit-evidence.ts';
import { diagnoseReviewUnitResponse, } from './prototype-review-unit-guard.ts';
import { reviewUnitHyperModel, } from './prototype-review-unit-hyper.ts';
import { assertReviewUnitManifest, } from './prototype-review-unit-manifest.ts';
import {
  executeReviewUnitNode,
  settleReviewUnitNode,
} from './prototype-review-unit-node-execute.ts';
import type {
  ReviewUnitFailureCategory,
  ReviewUnitNodeRecord,
} from './prototype-review-unit-node-record.ts';
import { restartReviewUnitNode, } from './prototype-review-unit-node-restart.ts';
import {
  REVIEW_UNIT_GUARD_FAILURES,
  type ReviewUnitAuthorSettlement,
  type ReviewUnitCandidate,
  type ReviewUnitGuardFailure,
  type ReviewUnitManifest,
  type ReviewUnitResponse,
} from './prototype-review-unit-model.ts';
import { reviewUnitResponseFormat, } from './prototype-review-unit-schema.ts';
import {
  persistReviewUnitBallot,
  type ReviewUnitVerifierState,
} from './prototype-review-unit-verifier-state.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Sentinel for in-call guard category not yet observed.
 */
const GUARD_FAILURE_UNSET: unique symbol = Symbol('review unit guard failure unset',);

/**
 * Executes or resumes one candidate and verifier Cartesian node.
 *
 * @returns Admitted ballot state or durable abstaining state
 *
 * @example
 * ```ts
 * const state = await runReviewUnitVerifierNode({
 *   outputDir,
 *   client,
 *   candidate,
 *   verifierOrdinal,
 *   verifierModelId,
 *   manifest,
 *   expectedManifestDigest,
 *   messages,
 *   authorSettlement,
 *   shell,
 *   ledger,
 *   sourceText,
 *   archiveText,
 *   sourcePictures,
 *   restart,
 *   signal,
 * });
 * ```
 */
export async function runReviewUnitVerifierNode({
  outputDir,
  client,
  candidate,
  verifierOrdinal,
  verifierModelId,
  manifest,
  expectedManifestDigest,
  messages,
  authorSettlement,
  shell,
  ledger,
  reviewPlan,
  sourceText,
  archiveText,
  sourcePictures,
  restart,
  signal,
}: {
  readonly outputDir: string;
  readonly client: SyntheticClient;
  readonly candidate: ReviewUnitCandidate;
  readonly verifierOrdinal: number;
  readonly verifierModelId: RosterModelId;
  readonly manifest: ReviewUnitManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly authorSettlement: ReviewUnitAuthorSettlement;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<ReviewUnitVerifierState> {
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
  assertReviewUnitBinding({
    candidate,
    manifest,
    reviewPlan,
    shell,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  assertRealizationPicturesReachMessages({
    messages,
    sourcePictures,
  });
  if (signal.aborted)
    throw signal.reason;
  if (manifest.verifierPlan[verifierOrdinal]
    ?.modelId
    !== verifierModelId)
    throw new Error('review unit verifier ordinal differs from manifest');
  /**
   * Durable node identity includes candidate and verifier ordinals.
   */
  const prefix = manifest.authorMode === 'lean-realization'
    ? 'lean-realization-verifier'
    : 'review-unit-verifier';
  /**
   * Candidate and verifier ordinal identity.
   */
  const id = `${prefix}-${String(candidate.candidateOrdinal,)}-${String(verifierOrdinal,)}`;
  /**
   * Strict response contract bound to one candidate.
   */
  const responseFormat = reviewUnitResponseFormat({
    reviewPlan,
    candidate,
    pictureCount: sourcePictures.length,
  });
  /**
   * Mutable diagnostic state scoped to one provider call.
   */
  const diagnostic: {
    guardFailure: ReviewUnitGuardFailure | typeof GUARD_FAILURE_UNSET;
    rawFailure: ReviewUnitGuardFailure | typeof GUARD_FAILURE_UNSET;
  } = {
    guardFailure: GUARD_FAILURE_UNSET,
    rawFailure: GUARD_FAILURE_UNSET,
  };
  /**
   * Parsed guard recording exact privacy-safe failure.
   *
   * @param value - Untrusted parsed provider response
   *
   * @returns Whether response passes exact structural guard
   */
  function validate(value: unknown,): value is ReviewUnitResponse {
    /**
     * Structural diagnosis for current parsed response.
     */
    const diagnosis = diagnoseReviewUnitResponse({
      value,
      reviewPlan,
      candidate,
      pictureCount: sourcePictures.length,
    });
    diagnostic.guardFailure = diagnosis.kind === 'rejected'
      ? diagnosis.failure
      : GUARD_FAILURE_UNSET;
    return diagnosis.kind === 'accepted';
  }
  /**
   * Raw duplicate guard recording exact privacy-safe failure.
   *
   * @param rawText - Exact provider or stored response text
   */
  function validateRawText(rawText: string,): void {
    try {
      assertNoDuplicateJsonMembers({ text: rawText, });
    }
    catch (error) {
      diagnostic.rawFailure = 'raw-duplicate';
      throw error;
    }
  }
  /**
   * Maps transport parser detail and guard closure to finite category.
   *
   * @param detailType - Provider parser classification when available
   *
   * @returns Found guard category or explicit absence
   */
  function failureCategory(
    detailType?: ReviewUnitNodeRecord['failureDetailType'],
  ): ReviewUnitFailureCategory {
    if ((typeof diagnostic.rawFailure) !== 'symbol')
      return {
        kind: 'found',
        value: diagnostic.rawFailure,
      };
    if (detailType === 'unparseable-json')
      return {
        kind: 'found',
        value: 'json-syntax',
      };
    return (typeof diagnostic.guardFailure) === 'symbol'
      ? { kind: 'absent', }
      : {
        kind: 'found',
        value: diagnostic.guardFailure,
      };
  }
  if (restart) {
    /**
     * Prior terminal state or reusable completed response.
     */
    const stored = await restartReviewUnitNode({
      outputDir,
      id,
      modelId: verifierModelId,
      manifestDigest: manifest.manifestDigest,
      messages,
      responseFormat,
      validate,
      validateRawText,
      failureCategories: REVIEW_UNIT_GUARD_FAILURES,
      signal,
    },);
    if (stored.kind === 'usable') {
      return await persistReviewUnitBallot({
        outputDir,
        id,
        state: {
          record: stored.record,
          ballot: admitReviewUnitResponse({
            response: stored.value,
            ledger,
            reviewPlan,
            authorSettlement,
            candidateOrdinal: candidate.candidateOrdinal,
            verifierOrdinal,
            verifierModelId,
            manifest,
            expectedManifestDigest,
            shell,
            sourceText,
            archiveText,
            sourcePictures,
          },),
        },
      },);
    }
    if (stored.kind === 'unusable')
      return { record: stored.record, };
  }
  /**
   * Fresh single-dispatch candidate-scoped verifier execution.
   */
  const execution = await executeReviewUnitNode({
    outputDir,
    client,
    id,
    modelId: verifierModelId,
    manifestDigest: manifest.manifestDigest,
    messages,
    responseFormat,
    validate,
    validateRawText,
    failureCategory,
    exchangeTimeoutMs: reviewUnitHyperModel({ modelId: verifierModelId, })
      .requestTimeoutMs,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    /**
     * Ballot admitted only after exact semantic checks.
     */
    const ballot = admitReviewUnitResponse({
      response: execution.value,
      ledger,
      reviewPlan,
      authorSettlement,
      candidateOrdinal: candidate.candidateOrdinal,
      verifierOrdinal,
      verifierModelId,
      manifest,
      expectedManifestDigest,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
    /**
     * Completed record persisted after ballot admission.
     */
    const record = await settleReviewUnitNode({
      outputDir,
      execution,
      usable: true,
    });
    return await persistReviewUnitBallot({
      outputDir,
      id,
      state: {
        record,
        ballot,
      },
    });
  }
  catch (error) {
    /**
     * Semantic admission category if failure came from bounded contract.
     */
    const category = error instanceof ReviewUnitAdmissionError
      ? error.failureCategory
      : undefined;
    /**
     * Durable abstention record with privacy-safe category.
     */
    const record = await settleReviewUnitNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
      ...(category === undefined ? {} : { failureCategory: category, }),
    },);
    return { record, };
  }
}
