// PROTOTYPE ONLY: Candidate H restartable complete-author node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { admitBoundedAuthorResponse, } from './prototype-bounded-verdict-author.ts';
import { assertBoundedVerdictManifest, } from './prototype-bounded-verdict-manifest.ts';
import type {
  BoundedCandidate,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import type { BoundedAuthorState, } from './prototype-bounded-verdict-settlement.ts';
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
  executeSlotNode,
  restartSlotNode,
  settleSlotNode,
} from './prototype-slot-runtime.ts';
import {
  slotDocumentGuard,
  slotResponseFormat,
} from './prototype-slot-wire.ts';

/**
 * Refuses duplicate members before ordinary JSON parsing erases them.
 *
 * @param rawText - Exact provider or stored response text
 */
function validateBoundedRawText(rawText: string,): void {
  assertNoDuplicateJsonMembers({ text: rawText, });
}

/**
 * Attaches Candidate H author authority at runtime boundary.
 *
 * @returns Complete admitted candidate
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
  readonly manifest: BoundedVerdictManifest;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): BoundedCandidate {
  return admitBoundedAuthorResponse({
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
 * Persists runtime-owned candidate outside provider response.
 *
 * @returns Terminal author state after immutable persistence
 */
async function persistCandidate({
  outputDir,
  id,
  state,
}: {
  readonly outputDir: string;
  readonly id: string;
  readonly state: BoundedAuthorState & { readonly candidate: NonNullable<BoundedAuthorState['candidate']>; };
}): Promise<BoundedAuthorState> {
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      `candidate-${id}.json`,
    ),
    value: state.candidate,
    label: 'bounded candidate',
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
 * const state = await runBoundedAuthorNode({
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
export async function runBoundedAuthorNode({
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
  readonly manifest: BoundedVerdictManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<BoundedAuthorState> {
  assertBoundedVerdictManifest({
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
   * Durable node identifier derived only from manifest ordinal.
   */
  const id = `bounded-author-${String(plan.ordinal,)}`;
  /**
   * Strict fixed-key author response contract.
   */
  const responseFormat = slotResponseFormat({ shell, });
  /**
   * Parsed author response guard bound to immutable shell.
   */
  const validate = slotDocumentGuard({ shell, });
  if (restart) {
    /**
     * Prior durable terminal state or reusable completed response.
     */
    const stored = await restartSlotNode({
      outputDir,
      id,
      modelId: plan.modelId,
      manifestDigest: manifest.manifestDigest,
      messages,
      responseFormat,
      validate,
      validateRawText: validateBoundedRawText,
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
  const execution = await executeSlotNode({
    outputDir,
    client,
    id,
    modelId: plan.modelId,
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
     * Completed node record persisted only after candidate admission.
     */
    const record = await settleSlotNode({
      outputDir,
      execution,
      usable: true,
    },);
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
    const record = await settleSlotNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
    },);
    return { record, };
  }
}
