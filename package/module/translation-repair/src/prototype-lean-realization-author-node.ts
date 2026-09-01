// PROTOTYPE ONLY: Candidate L restartable complete author node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { admitLeanRealizationResponse, } from './prototype-lean-realization-author.ts';
import {
  leanRealizationGuard,
  leanRealizationResponseFormat,
} from './prototype-lean-realization-wire.ts';
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
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
} from './prototype-realization-model.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type {
  ImmutableShell,
  SlotDocumentResponse,
} from './prototype-slot-model.ts';

/**
 * Refuses duplicate response members before parsing erases them.
 *
 * @param rawText - Exact provider response text
 */
function validateRawText(rawText: string,): void {
  assertNoDuplicateJsonMembers({ text: rawText, });
}

/**
 * Persists complete Candidate L candidate.
 *
 * @returns Terminal author state
 */
async function persistCandidate({
  outputDir,
  id,
  record,
  candidate,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly record: ReviewUnitAuthorState['record'];
  readonly candidate: ReviewUnitCandidate;
}): Promise<ReviewUnitAuthorState> {
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      `candidate-${id}.json`,
    ),
    value: candidate,
    label: 'lean realization candidate',
  });
  return {
    record,
    candidate,
  };
}

/**
 * Executes or resumes one Candidate L complete author.
 *
 * @returns Complete candidate or durable unusable state
 *
 * @example
 * ```ts
 * const state = await runLeanRealizationAuthorNode({ outputDir, client, plan, manifest, expectedManifestDigest, messages, shell, ledger, reviewPlan, sourceText, archiveText, sourcePictures, restart, signal, });
 * ```
 */
export async function runLeanRealizationAuthorNode({
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
  });
  if (manifest.authorMode !== 'lean-realization')
    throw new Error('lean realization author manifest mode differs');
  assertRealizationPicturesReachMessages({
    messages,
    sourcePictures,
  });
  /**
   * Durable static author node identity.
   */
  const id = `lean-realization-author-${String(plan.ordinal,)}`;
  /**
   * Exact 27-value author response schema.
   */
  const responseFormat = leanRealizationResponseFormat({
    shell,
    reviewPlan,
  });
  /**
   * Parsed response guard bound to mutable keys.
   */
  const validate = leanRealizationGuard({
    shell,
    reviewPlan,
  });
  /**
   * Admits one parsed complete response under captured runtime authority.
   *
   * @param response - Complete provider slot response
   *
   * @returns Runtime-owned candidate
   */
  function admit(response: SlotDocumentResponse,): ReviewUnitCandidate {
    return admitLeanRealizationResponse({
      response,
      shell,
      manifest,
      reviewPlan,
      plan,
      sourceText,
      archiveText,
      sourcePictures,
    });
  }
  if (restart) {
    /**
     * Prior terminal state or reusable complete response.
     */
    const stored = await restartReviewUnitNode({
      outputDir,
      id,
      modelId: plan.modelId,
      manifestDigest: manifest.manifestDigest,
      messages,
      responseFormat,
      validate,
      validateRawText,
      signal,
    });
    if (stored.kind === 'usable') {
      return await persistCandidate({
        outputDir,
        id,
        record: stored.record,
        candidate: admit(stored.value,),
      });
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
    validateRawText,
    exchangeTimeoutMs: reviewUnitHyperModel({ modelId: plan.modelId, })
      .requestTimeoutMs,
    signal,
  });
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    /**
     * Complete candidate after deterministic admission.
     */
    const candidate = admit(execution.value,);
    /**
     * Durable completed node row.
     */
    const record = await settleReviewUnitNode({
      outputDir,
      execution,
      usable: true,
    });
    return await persistCandidate({
      outputDir,
      id,
      record,
      candidate,
    });
  }
  catch (error) {
    /**
     * Durable no-effect node row.
     */
    const record = await settleReviewUnitNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
    });
    return { record, };
  }
}
