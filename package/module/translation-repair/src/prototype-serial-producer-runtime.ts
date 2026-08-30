// PROTOTYPE ONLY: finite serial producer execution and adoption.

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import { modelPromptDigest, } from './prompt-uniqueness-client.ts';
import {
  isProducerDocument,
  PRODUCER_RESPONSE_FORMAT,
  producerOutcomeValue,
  type ProducerChange,
  type ProducerDocument,
} from './prototype-serial-producer-wire.ts';
import type { RosterModelId, } from './roster-id.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

export class PrototypeProducerUnavailableError extends Error {
  public constructor({ modelId, }: { readonly modelId: RosterModelId; },) {
    super(`prototype producer ${modelId} returned no usable response`);
    this.name = 'PrototypeProducerUnavailableError';
  }
}

export type SerialProducerRecord = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly manifestDigest: string;
  readonly promptDigest: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly state: 'completed' | 'spent-unusable';
  readonly adopted: boolean;
  readonly failureType?: string;
};

function occurrenceCount({ text, needle, }: { readonly text: string; readonly needle: string; }): number {
  if (needle === '')
    return 0;
  let count = 0;
  let at = 0;
  while (at < text.length) {
    const found = text.indexOf(needle, at,);
    if (found === -1)
      return count;
    count += 1;
    at = found + 1;
  }
  return count;
}

export function applyProducerChanges(
  {
    prior,
    sourceText,
    response,
    allowedKinds,
  }: {
    readonly prior: string;
    readonly sourceText: string;
    readonly response: ProducerDocument;
    readonly allowedKinds: ReadonlySet<string>;
  },
): string {
  const located = response.changes.map(function locate(change: ProducerChange,) {
    if ((change.before === '') || (change.before === change.after))
      throw new Error('producer change has empty or no-op prior anchor');
    if (change.before.length === prior.length)
      throw new Error('producer change cannot replace whole prior document');
    if (!allowedKinds.has(change.kind,))
      throw new Error(`producer change kind ${change.kind} exceeds role authority`);
    if ((change.sourceQuote === '') || (occurrenceCount({ text: sourceText, needle: change.sourceQuote, },) !== 1))
      throw new Error('producer change has no unique exact source anchor');
    const count = occurrenceCount({ text: prior, needle: change.before, },);
    if (count !== 1)
      throw new Error(`producer change prior anchor count ${String(count,)}`);
    const at = prior.indexOf(change.before,);
    return { ...change, at, end: at + change.before.length, };
  },).toSorted(function laterFirst(left, right,): number {
    return (right.at - left.at) || (right.end - left.end);
  },);
  for (let index = 1; index < located.length; index += 1) {
    const earlier = located[index - 1];
    const later = located[index];
    if ((earlier !== undefined) && (later !== undefined) && (later.end > earlier.at))
      throw new Error('producer changes overlap');
  }
  const applied = located.reduce(function apply(current, change,): string {
    return `${current.slice(0, change.at,)}${change.after}${current.slice(change.end,)}`;
  }, prior,);
  if (applied !== response.document)
    throw new Error('producer document differs from declared edit transaction');
  return applied;
}

export function producerContractDigest(
  {
    modelId,
    messages,
    signal,
  }: {
    readonly modelId: RosterModelId;
    readonly messages: readonly ChatMessage[];
    readonly signal: AbortSignal;
  },
): string {
  const promptDigest = modelPromptDigest({ request: { modelId, messages, signal, }, },);
  return hashContent({ content: JSON.stringify({ promptDigest, responseFormat: PRODUCER_RESPONSE_FORMAT, },), },);
}

export type ExecutedProducer = {
  readonly response: ProducerDocument;
  readonly record: SerialProducerRecord;
};

export async function executeProducerNode(
  {
    outputDir,
    records,
    client,
    id,
    modelId,
    manifestDigest,
    messages,
    signal,
  }: {
    readonly outputDir: string;
    readonly records: SerialProducerRecord[];
    readonly client: SyntheticClient;
    readonly id: string;
    readonly modelId: RosterModelId;
    readonly manifestDigest: string;
    readonly messages: readonly ChatMessage[];
    readonly signal: AbortSignal;
  },
): Promise<ExecutedProducer> {
  const promptDigest = producerContractDigest({ modelId, messages, signal, },);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  await writeFileAtomic({ path: join(outputDir, `node-${id}.json`,), text: `${JSON.stringify({
    id,
    modelId,
    manifestDigest,
    promptDigest,
    startedAt,
    state: 'dispatched',
  }, null, 2,)}\n`, },);
  try {
    const outcome = await client.chatJson({
      modelId,
      messages,
      responseFormat: PRODUCER_RESPONSE_FORMAT,
      validate: isProducerDocument,
      signal,
    },);
    const response = producerOutcomeValue({ outcome, modelId, },);
    if (signal.aborted)
      throw signal.reason;
    return {
      response,
      record: {
        id,
        modelId,
        manifestDigest,
        promptDigest,
        startedAt,
        durationMs: Date.now() - startedMs,
        state: 'completed',
        adopted: false,
      },
    };
  }
  catch (error) {
    const record: SerialProducerRecord = {
      id,
      modelId,
      manifestDigest,
      promptDigest,
      startedAt,
      durationMs: Date.now() - startedMs,
      state: 'spent-unusable',
      adopted: false,
      failureType: error instanceof Error ? error.constructor.name : 'unknown',
    };
    records.push(record,);
    await writeFileAtomic({ path: join(outputDir, `node-${id}.json`,), text: `${JSON.stringify(record, null, 2,)}\n`, },);
    if (signal.aborted)
      throw signal.reason;
    throw new PrototypeProducerUnavailableError({ modelId, });
  }
}

export async function recordCompletedProducer(
  {
    outputDir,
    records,
    executed,
    adopted,
  }: {
    readonly outputDir: string;
    readonly records: SerialProducerRecord[];
    readonly executed: ExecutedProducer;
    readonly adopted: boolean;
  },
): Promise<void> {
  const record: SerialProducerRecord = {
    ...executed.record,
    state: adopted ? 'completed' : 'spent-unusable',
    adopted,
  };
  records.push(record,);
  await writeFileAtomic({
    path: join(outputDir, `node-${record.id}.json`,),
    text: `${JSON.stringify(record, null, 2,)}\n`,
  },);
}
