// PROTOTYPE ONLY: Candidate C restart and abort controls.

import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { carriesPicture, } from './chat-contract.ts';
import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  SyntheticClient,
} from './chat-contract.ts';
import { promptPayloadStore, } from './prompt-payload-store.ts';
import { promptUniqueClient, } from './prompt-uniqueness-client.ts';
import {
  executeStructuredNode,
  restartStructuredNode,
  settleStructuredNode,
  structuredNodeContractDigest,
  writePrototypeJson,
} from './prototype-brief-editor-runtime.ts';
import {
  isPreparationBrief,
  PREPARATION_BRIEF_RESPONSE_FORMAT,
  type PreparationBrief,
} from './prototype-brief-editor-wire.ts';

const MODEL_ID = 'hf:moonshotai/Kimi-K3';
const MANIFEST_DIGEST = 'fixture-manifest';
const MESSAGES = [{ role: 'user' as const, content: 'Locate no issue.', },];
const VALUE: PreparationBrief = { summary: 'No issue.', items: [], };

type TemporaryDirectory = {
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

async function temporaryDirectory(): Promise<TemporaryDirectory> {
  const path = await mkdtemp(join(tmpdir(), 'brief-editor-controls-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

function scriptedClient(
  { onCall, }: { readonly onCall: (hasPicture: boolean) => void; },
): SyntheticClient {
  return {
    chatText: async request => {
      await Promise.resolve();
      onCall(carriesPicture({ messages: request.messages, }),);
      return { text: JSON.stringify(VALUE,), };
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      onCall(carriesPicture({ messages: request.messages, }),);
      if (!request.validate(VALUE,))
        throw new Error('runtime control value failed schema');
      return { kind: 'ok', value: VALUE, rawText: JSON.stringify(VALUE,), };
    },
    quotas: async () => { throw new Error('quotas unused by runtime controls'); },
  };
}

export async function runBriefEditorRuntimeControls(): Promise<void> {
  await using directory = await temporaryDirectory();
  let calls = 0;
  const controller = new AbortController();
  const execution = await executeStructuredNode({
    outputDir: directory.path,
    client: scriptedClient({ onCall: function count() { calls += 1; }, }),
    id: 'restart-control',
    modelId: MODEL_ID,
    manifestDigest: MANIFEST_DIGEST,
    messages: MESSAGES,
    responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
    validate: isPreparationBrief,
    signal: controller.signal,
  },);
  if (execution.kind !== 'usable')
    throw new Error('runtime control execution was unusable');
  await settleStructuredNode({ outputDir: directory.path, execution, usable: true, },);
  const restarted = await restartStructuredNode({
    outputDir: directory.path,
    id: 'restart-control',
    modelId: MODEL_ID,
    manifestDigest: MANIFEST_DIGEST,
    messages: MESSAGES,
    responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
    validate: isPreparationBrief,
    signal: new AbortController().signal,
  },);
  if ((restarted.kind !== 'usable') || (calls !== 1))
    throw new Error('runtime completed restart control failed');
  let visionCalls = 0;
  let sawPicture = false;
  const visionMessages = [{
    role: 'user' as const,
    content: [
      { type: 'text' as const, text: 'Inspect image.', },
      { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,AA==', }, },
    ],
  },];
  const visionExecution = await executeStructuredNode({
    outputDir: directory.path,
    client: promptUniqueClient({
      inner: scriptedClient({ onCall: function watch(hasPicture,) {
        visionCalls += 1;
        sawPicture = hasPicture;
      }, }),
      store: promptPayloadStore({ dir: join(directory.path, 'vision-payloads',), }),
    },),
    id: 'vision-control',
    modelId: MODEL_ID,
    manifestDigest: MANIFEST_DIGEST,
    messages: visionMessages,
    responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
    validate: isPreparationBrief,
    signal: controller.signal,
  },);
  if ((visionExecution.kind !== 'usable') || (visionCalls !== 1) || (!sawPicture))
    throw new Error('runtime vision wrapper control failed');
  await settleStructuredNode({ outputDir: directory.path, execution: visionExecution, usable: true, },);
  const visionRestart = await restartStructuredNode({
    outputDir: directory.path,
    id: 'vision-control',
    modelId: MODEL_ID,
    manifestDigest: MANIFEST_DIGEST,
    messages: visionMessages,
    responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
    validate: isPreparationBrief,
    signal: new AbortController().signal,
  },);
  if (visionRestart.kind !== 'usable')
    throw new Error('runtime vision restart control failed');
  const indeterminateId = 'indeterminate-control';
  await writePrototypeJson({
    path: join(directory.path, `node-${indeterminateId}.json`,),
    value: {
      id: indeterminateId,
      modelId: MODEL_ID,
      manifestDigest: MANIFEST_DIGEST,
      promptDigest: structuredNodeContractDigest({
        modelId: MODEL_ID,
        messages: MESSAGES,
        responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
        signal: controller.signal,
      },),
      startedAt: new Date().toISOString(),
      state: 'dispatched',
    },
  },);
  const indeterminate = await restartStructuredNode({
    outputDir: directory.path,
    id: indeterminateId,
    modelId: MODEL_ID,
    manifestDigest: MANIFEST_DIGEST,
    messages: MESSAGES,
    responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
    validate: isPreparationBrief,
    signal: controller.signal,
  },);
  if ((indeterminate.kind !== 'unusable')
    || (indeterminate.record.failureType !== 'IndeterminateTransmission'))
    throw new Error('runtime indeterminate transmission control failed');
  const abortController = new AbortController();
  const abortReason = new Error('fixture exact abort identity');
  abortController.abort(abortReason,);
  let caught: unknown;
  try {
    await executeStructuredNode({
      outputDir: directory.path,
      client: scriptedClient({ onCall: function ignore() {}, }),
      id: 'abort-control',
      modelId: MODEL_ID,
      manifestDigest: MANIFEST_DIGEST,
      messages: MESSAGES,
      responseFormat: PREPARATION_BRIEF_RESPONSE_FORMAT,
      validate: isPreparationBrief,
      signal: abortController.signal,
    },);
  }
  catch (error) {
    caught = error;
  }
  if (caught !== abortReason)
    throw new Error('runtime exact abort identity control failed');
  const abortRecord = JSON.parse(
    await readFile(join(directory.path, 'node-abort-control.json',), 'utf8',),
  ) as { readonly failureType?: string; };
  if (abortRecord.failureType !== 'CallerAbort')
    throw new Error('runtime abort record control failed');
}
