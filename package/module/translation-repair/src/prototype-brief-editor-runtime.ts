// PROTOTYPE ONLY: Candidate C finite node execution and restart records.

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
  VisionMessage,
} from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import { modelPromptDigest, } from './prompt-uniqueness-client.ts';
import type { RosterModelId, } from './roster-id.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

export async function writePrototypeJson(
  { path, value, }: { readonly path: string; readonly value: unknown; },
): Promise<void> {
  await writeFileAtomic({ path, text: `${JSON.stringify(value, null, 2,)}\n`, },);
}

export type BriefEditorNodeRecord = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly manifestDigest: string;
  readonly promptDigest: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly state: 'completed' | 'spent-unusable';
  readonly responseDigest?: string;
  readonly failureType?: string;
  readonly failureDigest?: string;
};

export type StructuredNodeExecution<ValueT,> = {
  readonly kind: 'usable';
  readonly value: ValueT;
  readonly record: Omit<BriefEditorNodeRecord, 'state' | 'responseDigest'>;
} | {
  readonly kind: 'unusable';
  readonly record: BriefEditorNodeRecord;
};

export function structuredNodeContractDigest(
  {
    modelId,
    messages,
    responseFormat,
    signal,
  }: {
    readonly modelId: RosterModelId;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly signal: AbortSignal;
  },
): string {
  const promptDigest = modelPromptDigest({ request: { modelId, messages, signal, }, },);
  return hashContent({ content: JSON.stringify({ promptDigest, responseFormat, },), },);
}

async function writeNode(
  {
    outputDir,
    record,
  }: {
    readonly outputDir: string;
    readonly record: BriefEditorNodeRecord | Record<string, unknown>;
  },
): Promise<void> {
  await writeFileAtomic({
    path: join(outputDir, `node-${String(record.id,)}.json`,),
    text: `${JSON.stringify(record, null, 2,)}\n`,
  },);
}

function failureDigest({ error, }: { readonly error: unknown; }): string {
  const message = error instanceof Error ? `${error.name}:${error.message}` : String(error,);
  return hashContent({ content: message, });
}

export async function executeStructuredNode<ValueT,>(
  {
    outputDir,
    client,
    id,
    modelId,
    manifestDigest,
    messages,
    responseFormat,
    validate,
    signal,
  }: {
    readonly outputDir: string;
    readonly client: SyntheticClient;
    readonly id: string;
    readonly modelId: RosterModelId;
    readonly manifestDigest: string;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown) => value is ValueT;
    readonly signal: AbortSignal;
  },
): Promise<StructuredNodeExecution<ValueT>> {
  const promptDigest = structuredNodeContractDigest({ modelId, messages, responseFormat, signal, },);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  await writeNode({ outputDir, record: {
    id,
    modelId,
    manifestDigest,
    promptDigest,
    startedAt,
    state: 'dispatched',
  }, },);
  try {
    const outcome = await client.chatJson({ modelId, messages, responseFormat, validate, signal, },);
    if (signal.aborted)
      throw signal.reason;
    if (outcome.kind !== 'ok') {
      const record: BriefEditorNodeRecord = {
        id,
        modelId,
        manifestDigest,
        promptDigest,
        startedAt,
        durationMs: Date.now() - startedMs,
        state: 'spent-unusable',
        failureType: outcome.kind,
      };
      await writeNode({ outputDir, record, },);
      return { kind: 'unusable', record, };
    }
    return {
      kind: 'usable',
      value: outcome.value,
      record: {
        id,
        modelId,
        manifestDigest,
        promptDigest,
        startedAt,
        durationMs: Date.now() - startedMs,
      },
    };
  }
  catch (error) {
    if (signal.aborted) {
      const record: BriefEditorNodeRecord = {
        id,
        modelId,
        manifestDigest,
        promptDigest,
        startedAt,
        durationMs: Date.now() - startedMs,
        state: 'spent-unusable',
        failureType: 'CallerAbort',
        failureDigest: failureDigest({ error: signal.reason, }),
      };
      await writeNode({ outputDir, record, },);
      throw signal.reason;
    }
    const record: BriefEditorNodeRecord = {
      id,
      modelId,
      manifestDigest,
      promptDigest,
      startedAt,
      durationMs: Date.now() - startedMs,
      state: 'spent-unusable',
      failureType: error instanceof Error ? error.constructor.name : 'unknown',
      failureDigest: failureDigest({ error, }),
    };
    await writeNode({ outputDir, record, },);
    return { kind: 'unusable', record, };
  }
}

export async function settleStructuredNode<ValueT,>(
  {
    outputDir,
    execution,
    usable,
    failureType,
    failure,
  }: {
    readonly outputDir: string;
    readonly execution: Extract<StructuredNodeExecution<ValueT>, { readonly kind: 'usable'; }>;
    readonly usable: boolean;
    readonly failureType?: string;
    readonly failure?: unknown;
  },
): Promise<BriefEditorNodeRecord> {
  const responseText = `${JSON.stringify(execution.value, null, 2,)}\n`;
  const record: BriefEditorNodeRecord = {
    ...execution.record,
    state: usable ? 'completed' : 'spent-unusable',
    responseDigest: hashContent({ content: responseText, },),
    ...(failureType === undefined ? {} : { failureType, }),
    ...(failure === undefined ? {} : { failureDigest: failureDigest({ error: failure, }), }),
  };
  await writeFileAtomic({
    path: join(outputDir, `response-${record.id}.json`,),
    text: responseText,
  },);
  await writeNode({ outputDir, record, },);
  return record;
}

export type RestartedNode<ValueT,> = {
  readonly kind: 'pending';
} | {
  readonly kind: 'unusable';
  readonly record: BriefEditorNodeRecord;
} | {
  readonly kind: 'usable';
  readonly record: BriefEditorNodeRecord;
  readonly value: ValueT;
};

export async function restartStructuredNode<ValueT,>(
  {
    outputDir,
    id,
    modelId,
    manifestDigest,
    messages,
    responseFormat,
    validate,
    signal,
  }: {
    readonly outputDir: string;
    readonly id: string;
    readonly modelId: RosterModelId;
    readonly manifestDigest: string;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown) => value is ValueT;
    readonly signal: AbortSignal;
  },
): Promise<RestartedNode<ValueT>> {
  const nodePath = join(outputDir, `node-${id}.json`,);
  let text: string;
  try {
    text = await readFile(nodePath, 'utf8',);
  }
  catch (error) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return { kind: 'pending', };
    throw error;
  }
  const stored = JSON.parse(text,) as Partial<Omit<BriefEditorNodeRecord, 'state'>> & {
    readonly state?: BriefEditorNodeRecord['state'] | 'dispatched';
  };
  const promptDigest = structuredNodeContractDigest({ modelId, messages, responseFormat, signal, },);
  if ((stored.id !== id)
    || (stored.modelId !== modelId)
    || (stored.manifestDigest !== manifestDigest)
    || (stored.promptDigest !== promptDigest))
    throw new Error(`restart binding differs at ${id}`);
  if (stored.state === 'dispatched') {
    const record: BriefEditorNodeRecord = {
      id,
      modelId,
      manifestDigest,
      promptDigest,
      startedAt: stored.startedAt ?? '',
      durationMs: 0,
      state: 'spent-unusable',
      failureType: 'IndeterminateTransmission',
    };
    await writeNode({ outputDir, record, },);
    return { kind: 'unusable', record, };
  }
  if ((stored.state !== 'completed') && (stored.state !== 'spent-unusable'))
    throw new Error(`restart state invalid at ${id}`);
  const record = stored as BriefEditorNodeRecord;
  if (record.state === 'spent-unusable')
    return { kind: 'unusable', record, };
  const responseText = await readFile(join(outputDir, `response-${id}.json`,), 'utf8',);
  if (record.responseDigest !== hashContent({ content: responseText, },))
    throw new Error(`restart response digest differs at ${id}`);
  const value: unknown = JSON.parse(responseText,);
  if (!validate(value,))
    throw new Error(`restart response schema differs at ${id}`);
  return { kind: 'usable', record, value, };
}
