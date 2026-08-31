// PROTOTYPE ONLY: Candidate I restartable one-candidate verifier node.

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { admitCandidateBallotResponse, } from './prototype-candidate-ballot-admission.ts';
import { CandidateBallotAdmissionError, } from './prototype-candidate-ballot-evidence.ts';
import { diagnoseCandidateBallotResponse, } from './prototype-candidate-ballot-guard.ts';
import { assertCandidateBallotManifest, } from './prototype-candidate-ballot-manifest.ts';
import {
  executeCandidateBallotNode,
  settleCandidateBallotNode,
} from './prototype-candidate-ballot-node-execute.ts';
import type {
  CandidateBallotFailureCategory,
  CandidateBallotNodeRecord,
} from './prototype-candidate-ballot-node-record.ts';
import { restartCandidateBallotNode, } from './prototype-candidate-ballot-node-restart.ts';
import type {
  CandidateBallotAuthorSettlement,
  CandidateBallotCandidate,
  CandidateBallotGuardFailure,
  CandidateBallotManifest,
  CandidateBallotResponse,
} from './prototype-candidate-ballot-model.ts';
import { candidateBallotResponseFormat, } from './prototype-candidate-ballot-schema.ts';
import {
  persistCandidateScopedBallot,
  type CandidateBallotVerifierState,
} from './prototype-candidate-ballot-verifier-state.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Sentinel for in-call guard category not yet observed.
 */
const GUARD_FAILURE_UNSET: unique symbol = Symbol('candidate ballot guard failure unset',);

/**
 * Executes or resumes one candidate and verifier Cartesian node.
 *
 * @returns Admitted ballot state or durable abstaining state
 *
 * @example
 * ```ts
 * const state = await runCandidateBallotVerifierNode({
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
export async function runCandidateBallotVerifierNode({
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
  sourceText,
  archiveText,
  sourcePictures,
  restart,
  signal,
}: {
  readonly outputDir: string;
  readonly client: SyntheticClient;
  readonly candidate: CandidateBallotCandidate;
  readonly verifierOrdinal: number;
  readonly verifierModelId: RosterModelId;
  readonly manifest: CandidateBallotManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly authorSettlement: CandidateBallotAuthorSettlement;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<CandidateBallotVerifierState> {
  assertCandidateBallotManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  assertRealizationPicturesReachMessages({
    messages,
    sourcePictures,
  });
  if (manifest.verifierPlan[verifierOrdinal]
    ?.modelId
    !== verifierModelId)
    throw new Error('candidate ballot verifier ordinal differs from manifest');
  /**
   * Durable node identity includes candidate and verifier ordinals.
   */
  const id = `candidate-ballot-verifier-${String(candidate.candidateOrdinal,)}-${String(verifierOrdinal,)}`;
  /**
   * Strict response contract bound to one candidate.
   */
  const responseFormat = candidateBallotResponseFormat({
    ledger,
    candidate,
  });
  /**
   * Mutable diagnostic state scoped to one provider call.
   */
  const diagnostic: {
    guardFailure: CandidateBallotGuardFailure | typeof GUARD_FAILURE_UNSET;
    rawFailure: CandidateBallotGuardFailure | typeof GUARD_FAILURE_UNSET;
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
  function validate(value: unknown,): value is CandidateBallotResponse {
    /**
     * Structural diagnosis for current parsed response.
     */
    const diagnosis = diagnoseCandidateBallotResponse({
      value,
      ledger,
      candidate,
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
    detailType?: CandidateBallotNodeRecord['failureDetailType'],
  ): CandidateBallotFailureCategory {
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
    const stored = await restartCandidateBallotNode({
      outputDir,
      id,
      modelId: verifierModelId,
      manifestDigest: manifest.manifestDigest,
      messages,
      responseFormat,
      validate,
      validateRawText,
      signal,
    },);
    if (stored.kind === 'usable') {
      return await persistCandidateScopedBallot({
        outputDir,
        id,
        state: {
          record: stored.record,
          ballot: admitCandidateBallotResponse({
            response: stored.value,
            ledger,
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
  const execution = await executeCandidateBallotNode({
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
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    /**
     * Ballot admitted only after exact semantic checks.
     */
    const ballot = admitCandidateBallotResponse({
      response: execution.value,
      ledger,
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
    const record = await settleCandidateBallotNode({
      outputDir,
      execution,
      usable: true,
    });
    return await persistCandidateScopedBallot({
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
    const category = error instanceof CandidateBallotAdmissionError
      ? error.failureCategory
      : undefined;
    /**
     * Durable abstention record with privacy-safe category.
     */
    const record = await settleCandidateBallotNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
      ...(category === undefined ? {} : { failureCategory: category, }),
    },);
    return { record, };
  }
}
