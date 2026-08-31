// PROTOTYPE ONLY: Candidate H restartable complete-author node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { SyntheticClient, VisionMessage, } from './chat-contract.ts';
import { admitBoundedAuthorResponse, } from './prototype-bounded-verdict-author.ts';
import { assertBoundedVerdictManifest, } from './prototype-bounded-verdict-manifest.ts';
import type { BoundedVerdictManifest, } from './prototype-bounded-verdict-model.ts';
import type { BoundedAuthorState, } from './prototype-bounded-verdict-settlement.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
} from './prototype-realization-model.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type { ImmutableShell, SlotDocumentResponse, } from './prototype-slot-model.ts';
import {
  executeSlotNode,
  restartSlotNode,
  settleSlotNode,
} from './prototype-slot-runtime.ts';
import { slotDocumentGuard, slotResponseFormat, } from './prototype-slot-wire.ts';

/** Persists runtime-owned candidate outside provider response. */
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
    path: join(outputDir, `candidate-${id}.json`,),
    value: state.candidate,
    label: 'bounded candidate',
  },);
  return state;
}

/** Executes or resumes one manifest-authorized whole-document author. */
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
  assertRealizationPicturesReachMessages({ messages, sourcePictures, });
  const id = `bounded-author-${String(plan.ordinal,)}`;
  const responseFormat = slotResponseFormat({ shell, });
  const validate = slotDocumentGuard({ shell, });
  const validateRawText = function guardRaw(rawText: string,): void {
    assertNoDuplicateJsonMembers({ text: rawText, });
  };
  const admit = function admit(response: SlotDocumentResponse,) {
    return admitBoundedAuthorResponse({
      response,
      shell,
      manifest,
      plan,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  };
  if (restart) {
    const stored = await restartSlotNode({
      outputDir,
      id,
      modelId: plan.modelId,
      manifestDigest: manifest.manifestDigest,
      messages,
      responseFormat,
      validate,
      validateRawText,
      signal,
    },);
    if (stored.kind === 'usable') {
      return await persistCandidate({
        outputDir,
        id,
        state: {
          record: stored.record,
          candidate: admit(stored.value,),
        },
      },);
    }
    if (stored.kind === 'unusable')
      return { record: stored.record, };
  }
  const execution = await executeSlotNode({
    outputDir,
    client,
    id,
    modelId: plan.modelId,
    manifestDigest: manifest.manifestDigest,
    messages,
    responseFormat,
    validate,
    validateRawText,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    const candidate = admit(execution.value,);
    const record = await settleSlotNode({
      outputDir,
      execution,
      usable: true,
    },);
    return await persistCandidate({
      outputDir,
      id,
      state: { record, candidate, },
    },);
  }
  catch (error) {
    const record = await settleSlotNode({
      outputDir,
      execution,
      usable: false,
      failure: error,
    },);
    return { record, };
  }
}
