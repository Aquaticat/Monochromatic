// PROTOTYPE ONLY: Candidate D abort and indeterminate-transmission controls.

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import type { JsonSchemaResponseFormat, SyntheticClient, } from './chat-contract.ts';
import {
  executeSlotNode,
  restartSlotNode,
  settleSlotNode,
  type SlotNodeRecord,
} from './prototype-slot-runtime.ts';

const RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: { name: 'fixture', schema: { type: 'object', }, },
};
const MODEL_ID = 'hf:moonshotai/Kimi-K3';
const MESSAGES = [{ role: 'user' as const, content: 'cat fixture', },];

function unusedClientMethods(): Pick<SyntheticClient, 'chatText' | 'quotas'> {
  return {
    chatText: async function unusedText() {
      await Promise.resolve();
      throw new Error('unused runtime control text call');
    },
    quotas: async function unusedQuotas() {
      await Promise.resolve();
      throw new Error('unused runtime control quota call');
    },
  };
}

export async function runSlotRuntimeControls(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'immutable-shell-runtime-',),);
  const abortDir = join(root, 'abort',);
  const indeterminateDir = join(root, 'indeterminate',);
  const guardMismatchDir = join(root, 'guard-mismatch',);
  const unparseableDir = join(root, 'unparseable',);
  await Promise.all([
    mkdir(abortDir,),
    mkdir(indeterminateDir,),
    mkdir(guardMismatchDir,),
    mkdir(unparseableDir,),
  ],);
  const reason = new Error('fixture exact abort');
  const controller = new AbortController();
  controller.abort(reason,);
  const abortClient: SyntheticClient = {
    ...unusedClientMethods(),
    chatJson: async function abortJson(request,) {
      await Promise.resolve();
      throw request.signal.reason;
    },
  };
  let caught: unknown;
  try {
    await executeSlotNode({
      outputDir: abortDir,
      client: abortClient,
      id: 'abort-author',
      modelId: MODEL_ID,
      manifestDigest: 'abort-manifest',
      messages: MESSAGES,
      responseFormat: RESPONSE_FORMAT,
      validate: function validates(_value: unknown): _value is unknown { return true; },
      signal: controller.signal,
    },);
  }
  catch (error) {
    caught = error;
  }
  if (caught !== reason)
    throw new Error('immutable shell exact abort identity control failed');
  const abortRecord = JSON.parse(await readFile(join(abortDir, 'node-abort-author.json',), 'utf8',),) as SlotNodeRecord;
  if ((abortRecord.state !== 'spent-unusable') || (abortRecord.failureType !== 'CallerAbort'))
    throw new Error('immutable shell abort record control failed');

  const mismatchCases = [
    {
      id: 'guard-mismatch',
      outputDir: guardMismatchDir,
      reason: 'caller-guard-rejected',
      expected: 'caller-guard-rejected',
    },
    {
      id: 'unparseable',
      outputDir: unparseableDir,
      reason: 'unparseable-json',
      expected: 'unparseable-json',
    },
    {
      id: 'truncated-thinking',
      outputDir: join(root, 'truncated-thinking',),
      reason: 'truncated-thinking',
      expected: 'truncated-thinking',
    },
    {
      id: 'other-schema-mismatch',
      outputDir: join(root, 'other-schema-mismatch',),
      reason: undefined,
      expected: 'other-schema-mismatch',
    },
  ] as const;
  await Promise.all(mismatchCases.slice(2,).map(async function create(item,) {
    await mkdir(item.outputDir,);
  },),);
  await Promise.all(mismatchCases.map(async function mismatch(item,) {
    const mismatchClient: SyntheticClient = {
      ...unusedClientMethods(),
      chatJson: async function mismatchJson() {
        await Promise.resolve();
        return {
          kind: 'schema-mismatch' as const,
          rawText: '{}',
          ...(item.reason === undefined ? {} : { reason: item.reason, }),
          detail: 'fixture schema mismatch',
        };
      },
    };
    const outcome = await executeSlotNode({
      outputDir: item.outputDir,
      client: mismatchClient,
      id: item.id,
      modelId: MODEL_ID,
      manifestDigest: `${item.id}-manifest`,
      messages: MESSAGES,
      responseFormat: RESPONSE_FORMAT,
      validate: function validates(_value: unknown): _value is unknown { return true; },
      signal: new AbortController().signal,
    },);
    if ((outcome.kind !== 'unusable') || (outcome.record.failureDetailType !== item.expected))
      throw new Error(`immutable shell ${item.id} detail control failed`);
  },),);

  const response = { value: 'fixture', };
  const successClient: SyntheticClient = {
    ...unusedClientMethods(),
    chatJson: async function successJson(request,) {
      await Promise.resolve();
      if (!request.validate(response,))
        throw new Error('immutable shell runtime control response rejected');
      return { kind: 'ok', value: response, rawText: JSON.stringify(response,), };
    },
  };
  const signal = new AbortController().signal;
  const execution = await executeSlotNode({
    outputDir: indeterminateDir,
    client: successClient,
    id: 'indeterminate-author',
    modelId: MODEL_ID,
    manifestDigest: 'indeterminate-manifest',
    messages: MESSAGES,
    responseFormat: RESPONSE_FORMAT,
    validate: function validates(value: unknown): value is typeof response {
      return (typeof value === 'object') && (value !== null) && ('value' in value) && (value.value === 'fixture');
    },
    signal,
  },);
  if (execution.kind !== 'usable')
    throw new Error('immutable shell indeterminate setup control failed');
  await settleSlotNode({ outputDir: indeterminateDir, execution, usable: true, },);
  const nodePath = join(indeterminateDir, 'node-indeterminate-author.json',);
  const completed = JSON.parse(await readFile(nodePath, 'utf8',),) as SlotNodeRecord;
  await writeFile(nodePath, `${JSON.stringify({ ...completed, state: 'dispatched', }, null, 2,)}\n`,);
  const restarted = await restartSlotNode({
    outputDir: indeterminateDir,
    id: 'indeterminate-author',
    modelId: MODEL_ID,
    manifestDigest: 'indeterminate-manifest',
    messages: MESSAGES,
    responseFormat: RESPONSE_FORMAT,
    validate: function validates(value: unknown): value is typeof response {
      return (typeof value === 'object') && (value !== null) && ('value' in value) && (value.value === 'fixture');
    },
    signal,
  },);
  if ((restarted.kind !== 'unusable') || (restarted.record.failureType !== 'IndeterminateTransmission'))
    throw new Error('immutable shell indeterminate transmission control failed');
  await rm(root, { recursive: true, force: true, },);
}
