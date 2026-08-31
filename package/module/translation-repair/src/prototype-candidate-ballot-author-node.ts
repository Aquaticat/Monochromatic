// PROTOTYPE ONLY: Candidate I restartable complete-author node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { admitCandidateBallotAuthorResponse, } from './prototype-candidate-ballot-author.ts';
import { assertCandidateBallotManifest, } from './prototype-candidate-ballot-manifest.ts';
import type {
  CandidateBallotCandidate,
  CandidateBallotManifest,
} from './prototype-candidate-ballot-model.ts';
import {
  executeCandidateBallotNode,
  settleCandidateBallotNode,
} from './prototype-candidate-ballot-node-execute.ts';
import { restartCandidateBallotNode, } from './prototype-candidate-ballot-node-restart.ts';
import type { CandidateBallotAuthorState, } from './prototype-candidate-ballot-settlement.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
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
 * Attaches Candidate I author authority at runtime boundary.
 *
 * @returns Complete runtime-owned candidate
 */
function admitAuthorResponse({
  response,
  shell,
  manifest,
  plan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: SlotDocumentResponse;
  readonly shell: ImmutableShell;
  readonly manifest: CandidateBallotManifest;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): CandidateBallotCandidate {
  return admitCandidateBallotAuthorResponse({
    response,
    shell,
    manifest,
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
  readonly state: CandidateBallotAuthorState & {
    readonly candidate: NonNullable<CandidateBallotAuthorState['candidate']>;
  };
}): Promise<CandidateBallotAuthorState> {
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      `candidate-${id}.json`,
    ),
    value: state.candidate,
    label: 'candidate ballot candidate',
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
 * const state = await runCandidateBallotAuthorNode({
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
export async function runCandidateBallotAuthorNode({
  outputDir,
  client,
  plan,
  manifest,
  expectedManifestDigest,
  messages,
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
  readonly plan: RealizationCandidatePlan;
  readonly manifest: CandidateBallotManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<CandidateBallotAuthorState> {
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
  /**
   * Durable node identifier from author ordinal only.
   */
  const id = `candidate-ballot-author-${String(plan.ordinal,)}`;
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
    const stored = await restartCandidateBallotNode({
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
  const execution = await executeCandidateBallotNode({
    outputDir,
    client,
    id,
    modelId: plan.modelId,
    manifestDigest: manifest.manifestDigest,
    messages,
    responseFormat,
    validate,
    validateRawText: validateCandidateAuthorRawText,
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
      plan,
      sourceText,
      archiveText,
      sourcePictures,
    },);
    /**
     * Completed node record after candidate admission.
     */
    const record = await settleCandidateBallotNode({
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
    const record = await settleCandidateBallotNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
    },);
    return { record, };
  }
}
