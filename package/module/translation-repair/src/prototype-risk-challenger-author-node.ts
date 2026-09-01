// PROTOTYPE ONLY: Candidate M restartable risk-attested author node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import {
  admitRiskAttestedAuthorResponse,
} from './prototype-risk-challenger-author.ts';
import {
  diagnoseRiskAttestedAuthorResponse,
  riskAttestedAuthorResponseFormat,
} from './prototype-risk-challenger-author-wire.ts';
import {
  assertCandidateMManifest,
  candidateMNodeTimeout,
} from './prototype-risk-challenger-manifest.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import {
  CANDIDATE_M_GUARD_FAILURES,
  type CandidateMAuthorResponse,
  type CandidateMAuthorState,
  type CandidateMCandidate,
  type CandidateMGuardFailure,
} from './prototype-risk-challenger-model.ts';
import {
  executeReviewUnitNode,
  settleReviewUnitNode,
} from './prototype-review-unit-node-execute.ts';
import { restartReviewUnitNode, } from './prototype-review-unit-node-restart.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
} from './prototype-realization-model.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Persists complete Candidate M candidate.
 *
 * @returns Completed author state
 */
async function persistCandidate({
  outputDir,
  id,
  record,
  candidate,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly record: CandidateMAuthorState['record'];
  readonly candidate: CandidateMCandidate;
}): Promise<CandidateMAuthorState> {
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      `candidate-${id}.json`,
    ),
    value: candidate,
    label: 'risk challenger candidate',
  },);
  return {
    record,
    candidate,
  };
}

/**
 * Executes or resumes one Candidate M complete author.
 *
 * @returns Complete risk-bound candidate or durable unusable state
 *
 * @example
 * ```ts
 * const state = await runRiskAttestedAuthorNode({ outputDir, client, plan, manifest, expectedManifestDigest, messages, shell, ledger, reviewPlan, sourceText, archiveText, sourcePictures, restart, signal, });
 * ```
 */
export async function runRiskAttestedAuthorNode({
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
  readonly manifest: CandidateMManifest;
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
}): Promise<CandidateMAuthorState> {
  assertCandidateMManifest({
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
  },);
  /**
   * Durable static author node identity.
   */
  const id = `risk-challenger-author-${String(plan.ordinal,)}`;
  /**
   * Exact author response format.
   */
  const responseFormat = riskAttestedAuthorResponseFormat({
    shell,
    reviewPlan,
  },);
  /**
   * Mutable guard state scoped to one node execution.
   */
  const guardState: { failureCategory: CandidateMGuardFailure } = {
    failureCategory: 'key-set',
  };
  /**
   * Candidate M parsed guard with exact category capture.
   *
   * @param value - Untrusted parsed provider response
   *
   * @returns Whether response obeys exact author contract
   */
  function validate(value: unknown,): value is CandidateMAuthorResponse {
    /**
     * Exact caller diagnosis under current shell authority.
     */
    const diagnosis = diagnoseRiskAttestedAuthorResponse({
      value,
      shell,
      reviewPlan,
    },);
    if (diagnosis.kind === 'rejected')
      guardState.failureCategory = diagnosis.failure;
    return diagnosis.kind === 'accepted';
  }
  /**
   * Raw duplicate guard before parse erases member multiplicity.
   *
   * @param rawText - Exact provider tool-input text
   */
  function validateRawText(rawText: string,): void {
    try {
      assertNoDuplicateJsonMembers({ text: rawText, });
    }
    catch (error) {
      guardState.failureCategory = 'raw-duplicate';
      throw error;
    }
  }
  /**
   * Admits parsed complete response under runtime authority.
   *
   * @param response - Exact risk-attested author response
   *
   * @returns Complete risk-bound candidate
   */
  function admit(response: CandidateMAuthorResponse,): CandidateMCandidate {
    return admitRiskAttestedAuthorResponse({
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
      failureCategories: CANDIDATE_M_GUARD_FAILURES,
      signal,
    },);
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
    failureCategory: function category() {
      return {
        kind: 'found',
        value: guardState.failureCategory,
      };
    },
    exchangeTimeoutMs: candidateMNodeTimeout({
      manifest,
      nodeRole: 'author',
    },),
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    /**
     * Complete candidate after deterministic admission.
     */
    const candidate = admit(execution.value,);
    /**
     * Durable completed author record.
     */
    const record = await settleReviewUnitNode({
      outputDir,
      execution,
      usable: true,
    },);
    return await persistCandidate({
      outputDir,
      id,
      record,
      candidate,
    });
  }
  catch (error) {
    /**
     * Durable spent record after deterministic admission failure.
     */
    const record = await settleReviewUnitNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
      failureCategory: 'candidate-binding',
    },);
    return { record, };
  }
}
