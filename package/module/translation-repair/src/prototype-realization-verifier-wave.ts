// PROTOTYPE ONLY: Candidate G restartable complete-matrix verifier wave node.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { SyntheticClient, VisionMessage, } from './chat-contract.ts';
import { assertNoDuplicateJsonMembers, } from './prototype-json-member-guard.ts';
import {
  candidatesFromRealizationAuthorSettlement,
  type RealizationAuthorSettlement,
} from './prototype-realization-author-settlement.ts';
import { assertRealizationManifest, } from './prototype-realization-manifest.ts';
import type {
  RealizationManifest,
  RealizationObligationLedger,
  RealizationVerifierBallot,
  RealizationVerifierResponse,
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
import { admitRealizationVerifierResponse, } from './prototype-realization-verifier-admission.ts';
import { realizationVerifierResponseFormat, } from './prototype-realization-verifier-schema.ts';
import { realizationVerifierResponseGuard, } from './prototype-realization-verifier.ts';
import type { RosterModelId, } from './roster-id.ts';

/** Complete or abstaining result from one fixed verifier node. */
export type RealizationVerifierState = {
  readonly record: SlotNodeRecord;
  readonly ballot?: RealizationVerifierBallot;
};

/** Persists runtime-owned ballot while response remains restart source. */
async function persistRealizationBallot({ outputDir, id, record, ballot, }: {
  readonly outputDir: string;
  readonly id: string;
  readonly record: SlotNodeRecord;
  readonly ballot: RealizationVerifierBallot;
}): Promise<RealizationVerifierState> {
  await writePrototypeJson({
    path: join(outputDir, `ballot-${id}.json`,),
    value: ballot,
  },);
  return { record, ballot, };
}

/** Executes or deterministically resumes one manifest-authorized full-matrix verifier. */
export async function runRealizationVerifierNode({
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
  readonly manifest: RealizationManifest;
  readonly expectedManifestDigest: string;
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly authorSettlement: RealizationAuthorSettlement;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<RealizationVerifierState> {
  assertRealizationManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  const candidates = candidatesFromRealizationAuthorSettlement({ settlement: authorSettlement, manifest, });
  if (candidates.length === 0)
    throw new Error('realization verifier author settlement has no candidate');
  assertRealizationPicturesReachMessages({ messages, sourcePictures, });
  if (manifest.verifierModelIds[verifierOrdinal] !== verifierModelId)
    throw new Error('realization verifier ordinal differs from manifest');
  const id = `realization-verifier-${String(verifierOrdinal,)}`;
  const responseFormat = realizationVerifierResponseFormat({ ledger, candidates, });
  const validate = realizationVerifierResponseGuard({ ledger, candidates, });
  const validateRawText = function guardRaw(rawText: string,): void {
    assertNoDuplicateJsonMembers({ text: rawText, });
  };
  const admit = function admit(response: RealizationVerifierResponse,): RealizationVerifierBallot {
    return admitRealizationVerifierResponse({
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
  };
  if (restart) {
    const stored = await restartSlotNode({
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
    if (stored.kind === 'usable')
      return await persistRealizationBallot({
        outputDir,
        id,
        record: stored.record,
        ballot: admit(stored.value,),
      },);
    if (stored.kind === 'unusable')
      return { record: stored.record, };
  }
  const execution = await executeSlotNode({
    outputDir,
    client,
    id,
    modelId: verifierModelId,
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
    const ballot = admit(execution.value,);
    const record = await settleSlotNode({ outputDir, execution, usable: true, },);
    return await persistRealizationBallot({ outputDir, id, record, ballot, });
  }
  catch (error) {
    const record = await settleSlotNode({ outputDir, execution, usable: false, failure: error, },);
    return { record, };
  }
}
