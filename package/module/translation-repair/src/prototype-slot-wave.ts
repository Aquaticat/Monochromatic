// PROTOTYPE ONLY: Candidate D reusable complete-candidate node wave.

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import type { SlotAuthorNode, } from './prototype-slot-plan.ts';
import {
  executeSlotNode,
  restartSlotNode,
  settleSlotNode,
  type SlotNodeRecord,
} from './prototype-slot-runtime.ts';
import type {
  ImmutableShell,
  SlotDocumentResponse,
} from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';
import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { VisionMessage, } from './chat-contract.ts';

export type SlotState = {
  readonly record: SlotNodeRecord;
  readonly value?: SlotDocumentResponse;
  readonly document?: string;
};

export async function runSlotCandidateNode(
  {
    outputDir,
    client,
    node,
    manifestDigest,
    messages,
    responseFormat,
    validate,
    shell,
    sourceText,
    archiveText,
    sourcePictures,
    restart,
    signal,
  }: {
    readonly outputDir: string;
    readonly client: SyntheticClient;
    readonly node: SlotAuthorNode;
    readonly manifestDigest: string;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown) => value is SlotDocumentResponse;
    readonly shell: ImmutableShell;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourcePictures: readonly { readonly assetName: string; }[];
    readonly restart: boolean;
    readonly signal: AbortSignal;
  },
): Promise<SlotState> {
  if (restart) {
    const stored = await restartSlotNode({
      outputDir,
      id: node.id,
      modelId: node.modelId,
      manifestDigest,
      messages,
      responseFormat,
      validate,
      signal,
    },);
    if (stored.kind === 'usable') {
      const document = validateSlotCandidate({
        shell,
        response: stored.value,
        sourceText,
        archiveText,
        sourcePictures,
      },);
      return { record: stored.record, value: stored.value, document, };
    }
    if (stored.kind === 'unusable')
      return { record: stored.record, };
  }
  const execution = await executeSlotNode({
    outputDir,
    client,
    id: node.id,
    modelId: node.modelId,
    manifestDigest,
    messages,
    responseFormat,
    validate,
    signal,
  },);
  if (execution.kind === 'unusable')
    return { record: execution.record, };
  try {
    const document = validateSlotCandidate({
      shell,
      response: execution.value,
      sourceText,
      archiveText,
      sourcePictures,
    },);
    const record = await settleSlotNode({ outputDir, execution, usable: true, },);
    return { record, value: execution.value, document, };
  }
  catch (error) {
    const record = await settleSlotNode({ outputDir, execution, usable: false, failure: error, },);
    return { record, };
  }
}
