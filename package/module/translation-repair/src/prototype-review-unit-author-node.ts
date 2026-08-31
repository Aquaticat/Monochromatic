// PROTOTYPE ONLY: Candidate K restartable complete-author node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { admitReviewUnitAuthorResponse, } from './prototype-review-unit-author.ts';
import { reviewUnitHyperModel, } from './prototype-review-unit-hyper.ts';
import { assertReviewUnitManifest, } from './prototype-review-unit-manifest.ts';
import type {
  ReviewUnitCandidate,
  ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import {
  executeReviewUnitNode,
  settleReviewUnitNode,
} from './prototype-review-unit-node-execute.ts';
import { restartReviewUnitNode, } from './prototype-review-unit-node-restart.ts';
import type { ReviewUnitAuthorState, } from './prototype-review-unit-settlement.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
} from './prototype-realization-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type {
  ImmutableShell,
  SlotDocumentResponse,
} from './prototype-slot-model.ts';
import {
  slotDocumentGuard,
  slotResponseFormat,
} from './prototype-slot-wire.ts';

/**
 * Refuses duplicate members before parsing erases them.
 *
 * @param rawText - Exact provider or stored response text
 */
function validateCandidateAuthorRawText(rawText: string,): void {
  assertNoDuplicateJsonMembers({ text: rawText, });
}

/**
 * Attaches Candidate K author authority at runtime boundary.
 *
 * @returns Complete runtime-owned candidate
 */
function admitAuthorResponse({
  response,
  shell,
  manifest,
  reviewPlan,
  plan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: SlotDocumentResponse;
  readonly shell: ImmutableShell;
  readonly manifest: ReviewUnitManifest;
  readonly reviewPlan: ReviewUnitPlan;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): ReviewUnitCandidate {
  return admitReviewUnitAuthorResponse({
    response,
    shell,
    manifest,
    reviewPlan,
    plan,
    sourceText,
    archiveText,
    sourcePictures,
  },);
}

/**
 * Persists runtime-owned complete candidate.
 *
 * @returns Terminal author state after candidate persistence
 */
async function persistCandidate({
  outputDir,
  id,
  state,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly state: ReviewUnitAuthorState & {
    readonly candidate: NonNullable<ReviewUnitAuthorState['candidate']>;
  };
}): Promise<ReviewUnitAuthorState> {
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      `candidate-${id}.json`,
    ),
    value: state.candidate,
    label: 'review unit candidate',
  },);
  return state;
}

/**
 * Executes or resumes one manifest-authorized whole-document author.
 *
 * @returns Complete candidate state or durable unusable state
 *
 * @example
 * ```ts
 * const state = await runReviewUnitAuthorNode({
 *   outputDir,
 *   client,
 *   plan,
 *   manifest,
 *   expectedManifestDigest,
 *   messages,
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
export async function runReviewUnitAuthorNode({
  outputDir,
  client,
  plan,
  manifest,
  expectedManifestDigest,
  messages,
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
  readonly plan: RealizationCandidatePlan;
  readonly manifest: ReviewUnitManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<ReviewUnitAuthorState> {
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
  assertRealizationPicturesReachMessages({
    messages,
    sourcePictures,
  });
  /**
   * Durable node identifier from author ordinal only.
   */
  const id = `review-unit-author-${String(plan.ordinal,)}`;
  /**
   * Strict fixed-key author response contract.
   */
  const responseFormat = slotResponseFormat({ shell, });
  /**
   * Parsed author guard bound to immutable shell.
   */
  const validate = slotDocumentGuard({ shell, });
  if (restart) {
    /**
     * Prior terminal state or reusable completed response.
     */
    const stored = await restartReviewUnitNode({
      outputDir,
      id,
      modelId: plan.modelId,
      manifestDigest: manifest.manifestDigest,
      messages,
      responseFormat,
      validate,
      validateRawText: validateCandidateAuthorRawText,
      signal,
    },);
    if (stored.kind === 'usable') {
      return await persistCandidate({
        outputDir,
        id,
        state: {
          record: stored.record,
          candidate: admitAuthorResponse({
            response: stored.value,
            shell,
            manifest,
            reviewPlan,
            plan,
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
   * Fresh single-dispatch author execution.
   */
  const execution = await executeReviewUnitNode({
    outputDir,
    client,
    id,
    modelId: plan.modelId,
    manifestDigest: manifest.manifestDigest,
    messages,
    responseFormat,
    validate,
    validateRawText: validateCandidateAuthorRawText,
    exchangeTimeoutMs: reviewUnitHyperModel({ modelId: plan.modelId, })
      .requestTimeoutMs,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    /**
     * Candidate admitted through deterministic publication checks.
     */
    const candidate = admitAuthorResponse({
      response: execution.value,
      shell,
      manifest,
      reviewPlan,
      plan,
      sourceText,
      archiveText,
      sourcePictures,
    },);
    /**
     * Completed node record after candidate admission.
     */
    const record = await settleReviewUnitNode({
      outputDir,
      execution,
      usable: true,
    });
    return await persistCandidate({
      outputDir,
      id,
      state: {
        record,
        candidate,
      },
    },);
  }
  catch (error) {
    /**
     * Durable no-effect record for failed deterministic admission.
     */
    const record = await settleReviewUnitNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
    },);
    return { record, };
  }
}
