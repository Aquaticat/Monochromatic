// PROTOTYPE ONLY: Candidate H restartable all-candidate verifier node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { admitBoundedVerifierResponse, } from './prototype-bounded-verdict-admission.ts';
import { assertBoundedVerdictManifest, } from './prototype-bounded-verdict-manifest.ts';
import type {
  BoundedAuthorSettlement,
  BoundedVerifierBallot,
  BoundedVerifierResponse,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import { candidatesFromBoundedSettlement, } from './prototype-bounded-verdict-settlement.ts';
import { boundedVerifierResponseGuard, } from './prototype-bounded-verdict-verifier-guard.ts';
import { boundedVerifierResponseFormat, } from './prototype-bounded-verdict-verifier-schema.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import {
  executeSlotNode,
  restartSlotNode,
  settleSlotNode,
  type SlotNodeRecord,
} from './prototype-slot-runtime.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Complete or abstaining terminal verifier state.
 */
export type BoundedVerifierState = {
  readonly record: SlotNodeRecord;
  readonly ballot?: BoundedVerifierBallot;
};

/**
 * Refuses duplicate members before ordinary JSON parsing erases them.
 *
 * @param rawText - Exact provider or stored response text
 */
function validateBoundedRawText(rawText: string,): void {
  assertNoDuplicateJsonMembers({ text: rawText, });
}

/**
 * Attaches verifier identity after complete semantic admission.
 *
 * @returns Runtime-bound complete verifier ballot
 */
function admitVerifierResponse({
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
  return admitBoundedVerifierResponse({
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
  },);
}

/**
 * Persists runtime-owned admitted ballot.
 *
 * @returns Terminal verifier state after immutable persistence
 */
async function persistBallot({
  outputDir,
  id,
  state,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly state: BoundedVerifierState & { readonly ballot: BoundedVerifierBallot; };
}): Promise<BoundedVerifierState> {
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      `ballot-${id}.json`,
    ),
    value: state.ballot,
    label: 'bounded ballot',
  },);
  return state;
}

/**
 * Executes or resumes one fixed complete verifier matrix.
 *
 * @returns Admitted ballot state or durable abstaining state
 *
 * @example
 * ```ts
 * const state = await runBoundedVerifierNode({
 *   outputDir,
 *   client,
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
export async function runBoundedVerifierNode({
  outputDir,
  client,
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
  readonly verifierOrdinal: number;
  readonly verifierModelId: RosterModelId;
  readonly manifest: BoundedVerdictManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly authorSettlement: BoundedAuthorSettlement;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<BoundedVerifierState> {
  assertBoundedVerdictManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  /**
   * Complete candidate set derived from total author settlement.
   */
  const candidates = candidatesFromBoundedSettlement({
    settlement: authorSettlement,
    manifest,
  },);
  if (candidates.length === 0)
    throw new Error('bounded verifier author settlement has no candidate');
  assertRealizationPicturesReachMessages({
    messages,
    sourcePictures,
  });
  if (manifest.verifierModelIds[verifierOrdinal] !== verifierModelId)
    throw new Error('bounded verifier ordinal differs from manifest');
  /**
   * Durable node identifier derived only from verifier ordinal.
   */
  const id = `bounded-verifier-${String(verifierOrdinal,)}`;
  /**
   * Dynamic strict response format bound to exact candidate set.
   */
  const responseFormat = boundedVerifierResponseFormat({
    ledger,
    candidates,
  });
  /**
   * Parsed response guard bound to exact matrix dimensions.
   */
  const validate = boundedVerifierResponseGuard({
    ledger,
    candidates,
  });
  if (restart) {
    /**
     * Prior durable terminal state or reusable completed response.
     */
    const stored = await restartSlotNode({
      outputDir,
      id,
      modelId: verifierModelId,
      manifestDigest: manifest.manifestDigest,
      messages,
      responseFormat,
      validate,
      validateRawText: validateBoundedRawText,
      signal,
    },);
    if (stored.kind === 'usable') {
      return await persistBallot({
        outputDir,
        id,
        state: {
          record: stored.record,
          ballot: admitVerifierResponse({
            response: stored.value,
            ledger,
            authorSettlement,
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
   * Fresh single-dispatch verifier execution.
   */
  const execution = await executeSlotNode({
    outputDir,
    client,
    id,
    modelId: verifierModelId,
    manifestDigest: manifest.manifestDigest,
    messages,
    responseFormat,
    validate,
    validateRawText: validateBoundedRawText,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    /**
     * Ballot admitted only as complete all-candidate response.
     */
    const ballot = admitVerifierResponse({
      response: execution.value,
      ledger,
      authorSettlement,
      verifierModelId,
      manifest,
      expectedManifestDigest,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
    /**
     * Completed node record persisted after ballot admission.
     */
    const record = await settleSlotNode({
      outputDir,
      execution,
      usable: true,
    },);
    return await persistBallot({
      outputDir,
      id,
      state: {
        record,
        ballot,
      },
    },);
  }
  catch (error) {
    /**
     * Durable no-effect record for verifier abstention.
     */
    const record = await settleSlotNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
    },);
    return { record, };
  }
}
