// PROTOTYPE ONLY: Candidate M restartable role-split challenger node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import { assertRiskAttestedCandidate, } from './prototype-risk-challenger-author.ts';
import {
  diagnoseRiskChallenge,
} from './prototype-risk-challenger-guard.ts';
import {
  assertCandidateMManifest,
  candidateMNodeTimeout,
} from './prototype-risk-challenger-manifest.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import {
  CANDIDATE_M_GUARD_FAILURES,
  type CandidateMChallenge,
  type CandidateMChallengeResponse,
  type CandidateMChallengeState,
  type CandidateMChallengerRole,
  type CandidateMCandidate,
  type CandidateMGuardFailure,
} from './prototype-risk-challenger-model.ts';
import {
  executeReviewUnitNode,
  settleReviewUnitNode,
} from './prototype-review-unit-node-execute.ts';
import { restartReviewUnitNode, } from './prototype-review-unit-node-restart.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import { riskChallengeResponseFormat, } from './prototype-risk-challenger-schema.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Admits exact Candidate M challenge with verifier identity.
 *
 * @returns Digest-bound challenge
 */
function admitChallenge({
  response,
  verifierModelId,
  verifierOrdinal,
}: {
  readonly response: CandidateMChallengeResponse;
  readonly verifierModelId: RosterModelId;
  readonly verifierOrdinal: number;
}): CandidateMChallenge {
  /**
   * Challenge identity before self digest.
   */
  const identity = {
    ...response,
    verifierModelId,
    verifierOrdinal,
  };
  return {
    ...identity,
    challengeDigest: hashContent({ content: JSON.stringify(identity,), }),
  };
}

/**
 * Persists admitted Candidate M challenge.
 *
 * @returns Completed challenger state
 */
async function persistChallenge({
  outputDir,
  id,
  record,
  challenge,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly record: CandidateMChallengeState['record'];
  readonly challenge: CandidateMChallenge;
}): Promise<CandidateMChallengeState> {
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      `challenge-${id}.json`,
    ),
    value: challenge,
    label: 'risk challenge',
  },);
  return {
    record,
    challenge,
  };
}

/**
 * Executes or resumes one Candidate M role challenger.
 *
 * @returns Admitted atomic challenge or durable abstention
 *
 * @example
 * ```ts
 * const state = await runRiskChallengerNode({ outputDir, client, candidate, verifierOrdinal, verifierModelId, role, manifest, expectedManifestDigest, messages, sourceReviewPlanDigest, shell, ledger, reviewPlan, sourceText, archiveText, sourcePictures, restart, signal, });
 * ```
 */
export async function runRiskChallengerNode({
  outputDir,
  client,
  candidate,
  verifierOrdinal,
  verifierModelId,
  role,
  manifest,
  expectedManifestDigest,
  messages,
  sourceReviewPlanDigest,
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
  readonly candidate: CandidateMCandidate;
  readonly verifierOrdinal: number;
  readonly verifierModelId: RosterModelId;
  readonly role: CandidateMChallengerRole;
  readonly manifest: CandidateMManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly sourceReviewPlanDigest: string;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<CandidateMChallengeState> {
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
  assertRiskAttestedCandidate({
    candidate,
    shell,
    manifest,
    reviewPlan,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  assertRealizationPicturesReachMessages({
    messages,
    sourcePictures,
  },);
  /**
   * Durable candidate, verifier, and role node identity.
   */
  const id = `risk-challenger-verifier-${String(candidate.candidateOrdinal,)}-${String(verifierOrdinal,)}-${role}`;
  /**
   * Exact role and candidate-bound response format.
   */
  const responseFormat = riskChallengeResponseFormat({
    candidate,
    reviewPlan,
    role,
    sourceReviewPlanDigest,
    pictureCount: sourcePictures.length,
  },);
  /**
   * Mutable guard state scoped to one challenger execution.
   */
  const guardState: { failureCategory: CandidateMGuardFailure } = {
    failureCategory: 'key-set',
  };
  /**
   * Diagnoses parsed provider challenge under captured role authority.
   *
   * @param value - Untrusted parsed provider response
   *
   * @returns Whether response obeys exact challenge contract
   */
  function validate(value: unknown,): value is CandidateMChallengeResponse {
    /**
     * Exact current caller diagnosis.
     */
    const diagnosis = diagnoseRiskChallenge({
      value,
      role,
      candidate,
      reviewPlan,
      sourceReviewPlanDigest,
      pictureCount: sourcePictures.length,
    },);
    if (diagnosis.kind === 'rejected')
      guardState.failureCategory = diagnosis.failure;
    return diagnosis.kind === 'accepted';
  }
  /**
   * Refuses duplicate raw JSON members before parsing.
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
  if (restart) {
    /**
     * Prior terminal state or reusable complete response.
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
      failureCategories: CANDIDATE_M_GUARD_FAILURES,
      signal,
    },);
    if (stored.kind === 'usable') {
      return await persistChallenge({
        outputDir,
        id,
        record: stored.record,
        challenge: admitChallenge({
          response: stored.value,
          verifierModelId,
          verifierOrdinal,
        },),
      });
    }
    if (stored.kind === 'unusable')
      return { record: stored.record, };
  }
  /**
   * Fresh single-dispatch challenger execution.
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
    failureCategory: function category() {
      return {
        kind: 'found',
        value: guardState.failureCategory,
      };
    },
    exchangeTimeoutMs: candidateMNodeTimeout({
      manifest,
      nodeRole: 'challenger',
    },),
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  /**
   * Digest-bound admitted challenge.
   */
  const challenge = admitChallenge({
    response: execution.value,
    verifierModelId,
    verifierOrdinal,
  },);
  /**
   * Durable completed challenger record.
   */
  const record = await settleReviewUnitNode({
    outputDir,
    execution,
    usable: true,
  },);
  return await persistChallenge({
    outputDir,
    id,
    record,
    challenge,
  });
}
