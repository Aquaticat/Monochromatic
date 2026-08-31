// PROTOTYPE ONLY: Candidate G restartable complete-author wave node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { SyntheticClient, VisionMessage, } from './chat-contract.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import { admitRealizationAuthorResponse, } from './prototype-realization-admission.ts';
import {
  realizationAuthorResponseFormat,
  realizationAuthorResponseGuard,
} from './prototype-realization-author.ts';
import { assertRealizationManifest, } from './prototype-realization-manifest.ts';
import type {
  RealizationAuthorResponse,
  RealizationCandidatePlan,
  RealizationManifest,
  RealizationObligationLedger,
  RealizedCandidate,
} from './prototype-realization-model.ts';
import { assertRealizationPicturesReachMessages, } from './prototype-realization-vision.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import {
  executeSlotNode,
  restartSlotNode,
  settleSlotNode,
  type SlotNodeRecord,
} from './prototype-slot-runtime.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';

/** Complete or no-effect result from one fixed author node. */
export type RealizationAuthorState = {
  readonly record: SlotNodeRecord;
  readonly candidate?: RealizedCandidate;
};

/** Persists runtime-owned admitted candidate while response remains restart source. */
async function persistRealizationCandidate({ outputDir, id, record, candidate, }: {
  readonly outputDir: string;
  readonly id: string;
  readonly record: SlotNodeRecord;
  readonly candidate: RealizedCandidate;
}): Promise<RealizationAuthorState> {
  await writePrototypeJson({
    path: join(outputDir, `candidate-${id}.json`,),
    value: candidate,
  },);
  return { record, candidate, };
}

/** Executes or deterministically resumes one manifest-authorized complete candidate. */
export async function runRealizationAuthorNode({
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
  readonly manifest: RealizationManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<RealizationAuthorState> {
  assertRealizationManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  assertRealizationPicturesReachMessages({ messages, sourcePictures, });
  const id = `realization-author-${String(plan.ordinal,)}`;
  const responseFormat = realizationAuthorResponseFormat({ shell, ledger, });
  const validate = realizationAuthorResponseGuard({ shell, ledger, });
  const validateRawText = function guardRaw(rawText: string,): void {
    assertNoDuplicateJsonMembers({ text: rawText, });
  };
  const admit = function admit(response: RealizationAuthorResponse,): RealizedCandidate {
    return admitRealizationAuthorResponse({
      response,
      shell,
      ledger,
      manifest,
      expectedManifestDigest,
      candidateOrdinal: plan.ordinal,
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
    if (stored.kind === 'usable')
      return await persistRealizationCandidate({
        outputDir,
        id,
        record: stored.record,
        candidate: admit(stored.value,),
      },);
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
    const record = await settleSlotNode({ outputDir, execution, usable: true, },);
    return await persistRealizationCandidate({ outputDir, id, record, candidate, });
  }
  catch (error) {
    const record = await settleSlotNode({ outputDir, execution, usable: false, failure: error, },);
    return { record, };
  }
}
