// PROTOTYPE ONLY: Candidate D audit-bound finite node execution and restart.

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

export type SlotNodeRecord = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly manifestDigest: string;
  readonly basePromptDigest: string;
  readonly promptDigest: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly state: 'completed' | 'spent-unusable';
  readonly responseDigest?: string;
  readonly providerResponseDigest?: string;
  readonly replyCacheKey?: string;
  readonly failureType?: string;
  readonly failureDetailType?: 'caller-guard-rejected' | 'unparseable-json' | 'truncated-thinking' | 'other-schema-mismatch';
  readonly failureDigest?: string;
};

type DispatchRecord = Omit<SlotNodeRecord, 'durationMs' | 'state'> & { readonly state: 'dispatched'; };

export type SlotExecution<ValueT,> = {
  readonly kind: 'usable';
  readonly value: ValueT;
  readonly rawText: string;
  readonly record: Omit<SlotNodeRecord, 'state' | 'durationMs' | 'responseDigest'> & {
    readonly durationMs: number;
  };
} | {
  readonly kind: 'unusable';
  readonly record: SlotNodeRecord;
};

function digestFailure({ value, }: { readonly value: unknown; }): string {
  const text = value instanceof Error ? `${value.name}:${value.message}` : String(value,);
  return hashContent({ content: text, });
}

function basePromptDigest(
  {
    modelId,
    messages,
    signal,
  }: {
    readonly modelId: RosterModelId;
    readonly messages: readonly (ChatMessage | VisionMessage)[];
    readonly signal: AbortSignal;
  },
): string {
  return modelPromptDigest({ request: { modelId, messages, signal, }, },);
}

function contractDigest(
  {
    baseDigest,
    responseFormat,
  }: {
    readonly baseDigest: string;
    readonly responseFormat: JsonSchemaResponseFormat;
  },
): string {
  return hashContent({ content: JSON.stringify({ basePromptDigest: baseDigest, responseFormat, },), });
}

async function writeSlotNode(
  {
    outputDir,
    record,
  }: {
    readonly outputDir: string;
    readonly record: SlotNodeRecord | DispatchRecord;
  },
): Promise<void> {
  await writeFileAtomic({
    path: join(outputDir, `node-${record.id}.json`,),
    text: `${JSON.stringify(record, null, 2,)}\n`,
  },);
}

export async function executeSlotNode<ValueT,>(
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
): Promise<SlotExecution<ValueT>> {
  const baseDigest = basePromptDigest({ modelId, messages, signal, });
  const promptDigest = contractDigest({ baseDigest, responseFormat, });
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const binding = { id, modelId, manifestDigest, basePromptDigest: baseDigest, promptDigest, startedAt, };
  await writeSlotNode({ outputDir, record: { ...binding, state: 'dispatched', }, },);
  try {
    const outcome = await client.chatJson({ modelId, messages, responseFormat, validate, signal, },);
    if (signal.aborted)
      throw signal.reason;
    const durationMs = Date.now() - startedMs;
    if (outcome.kind !== 'ok') {
      const detail = outcome.kind === 'schema-mismatch' ? outcome.detail : outcome.marker;
      const record: SlotNodeRecord = {
        ...binding,
        durationMs,
        state: 'spent-unusable',
        providerResponseDigest: hashContent({ content: outcome.rawText, }),
        replyCacheKey: baseDigest,
        failureType: outcome.kind,
        ...(outcome.kind === 'schema-mismatch'
          ? { failureDetailType: outcome.reason ?? 'other-schema-mismatch', }
          : {}),
        failureDigest: digestFailure({ value: `${outcome.kind}:${detail}`, }),
      };
      await writeSlotNode({ outputDir, record, },);
      return { kind: 'unusable', record, };
    }
    return {
      kind: 'usable',
      value: outcome.value,
      rawText: outcome.rawText,
      record: {
        ...binding,
        durationMs,
        providerResponseDigest: hashContent({ content: outcome.rawText, }),
        replyCacheKey: baseDigest,
      },
    };
  }
  catch (error) {
    if (signal.aborted) {
      const record: SlotNodeRecord = {
        ...binding,
        durationMs: Date.now() - startedMs,
        state: 'spent-unusable',
        failureType: 'CallerAbort',
        failureDigest: digestFailure({ value: signal.reason, }),
      };
      await writeSlotNode({ outputDir, record, },);
      throw signal.reason;
    }
    const record: SlotNodeRecord = {
      ...binding,
      durationMs: Date.now() - startedMs,
      state: 'spent-unusable',
      failureType: error instanceof Error ? error.constructor.name : 'unknown',
      failureDigest: digestFailure({ value: error, }),
    };
    await writeSlotNode({ outputDir, record, },);
    return { kind: 'unusable', record, };
  }
}

export async function settleSlotNode<ValueT,>(
  {
    outputDir,
    execution,
    usable,
    failure,
  }: {
    readonly outputDir: string;
    readonly execution: Extract<SlotExecution<ValueT>, { readonly kind: 'usable'; }>;
    readonly usable: boolean;
    readonly failure?: unknown;
  },
): Promise<SlotNodeRecord> {
  const responseText = `${JSON.stringify(execution.value, null, 2,)}\n`;
  const record: SlotNodeRecord = {
    ...execution.record,
    state: usable ? 'completed' : 'spent-unusable',
    responseDigest: hashContent({ content: responseText, }),
    ...(failure === undefined ? {} : {
      failureType: failure instanceof Error ? failure.constructor.name : 'unknown',
      failureDigest: digestFailure({ value: failure, }),
    }),
  };
  await writeFileAtomic({ path: join(outputDir, `response-${record.id}.json`,), text: responseText, },);
  await writeSlotNode({ outputDir, record, },);
  return record;
}

export type RestartedSlotNode<ValueT,> = {
  readonly kind: 'pending';
} | {
  readonly kind: 'unusable';
  readonly record: SlotNodeRecord;
} | {
  readonly kind: 'usable';
  readonly record: SlotNodeRecord;
  readonly value: ValueT;
};

export async function restartSlotNode<ValueT,>(
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
): Promise<RestartedSlotNode<ValueT>> {
  const nodePath = join(outputDir, `node-${id}.json`,);
  let nodeText: string;
  try {
    nodeText = await readFile(nodePath, 'utf8',);
  }
  catch (error) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return { kind: 'pending', };
    throw error;
  }
  const stored = JSON.parse(nodeText,) as Omit<Partial<SlotNodeRecord>, 'state'> & {
    readonly state?: SlotNodeRecord['state'] | 'dispatched';
  };
  const baseDigest = basePromptDigest({ modelId, messages, signal, });
  const promptDigest = contractDigest({ baseDigest, responseFormat, });
  if ((stored.id !== id)
    || (stored.modelId !== modelId)
    || (stored.manifestDigest !== manifestDigest)
    || (stored.basePromptDigest !== baseDigest)
    || (stored.promptDigest !== promptDigest))
    throw new Error(`immutable shell restart binding differs at ${id}`);
  if (stored.state === 'dispatched') {
    const record: SlotNodeRecord = {
      id,
      modelId,
      manifestDigest,
      basePromptDigest: baseDigest,
      promptDigest,
      startedAt: stored.startedAt ?? '',
      durationMs: 0,
      state: 'spent-unusable',
      failureType: 'IndeterminateTransmission',
      failureDigest: digestFailure({ value: 'IndeterminateTransmission', }),
    };
    await writeSlotNode({ outputDir, record, },);
    return { kind: 'unusable', record, };
  }
  if ((stored.state !== 'completed') && (stored.state !== 'spent-unusable'))
    throw new Error(`immutable shell restart state differs at ${id}`);
  const record = stored as SlotNodeRecord;
  if (record.state === 'spent-unusable')
    return { kind: 'unusable', record, };
  const responseText = await readFile(join(outputDir, `response-${id}.json`,), 'utf8',);
  if (record.responseDigest !== hashContent({ content: responseText, }))
    throw new Error(`immutable shell restart response digest differs at ${id}`);
  const value: unknown = JSON.parse(responseText,);
  if (!validate(value,))
    throw new Error(`immutable shell restart response schema differs at ${id}`);
  return { kind: 'usable', record, value, };
}
