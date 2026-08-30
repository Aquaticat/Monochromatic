// PROTOTYPE ONLY: complete-document producer wire contract.

import type { ChatJsonOutcome, } from './chat-contract.ts';

export type ProducerChange = {
  readonly before: string;
  readonly after: string;
  readonly sourceQuote: string;
  readonly kind: string;
  readonly explanation: string;
};

export type ProducerDocument = {
  readonly document: string;
  readonly changes: readonly ProducerChange[];
  readonly note: string;
};

export const PRODUCER_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'complete_document_revision',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['document', 'changes', 'note',],
      properties: {
        document: { type: 'string', minLength: 1, },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['before', 'after', 'sourceQuote', 'kind', 'explanation',],
            properties: {
              before: { type: 'string', },
              after: { type: 'string', },
              sourceQuote: { type: 'string', },
              kind: { type: 'string', },
              explanation: { type: 'string', },
            },
          },
        },
        note: { type: 'string', },
      },
    },
  },
} as const;

export function isProducerDocument(value: unknown,): value is ProducerDocument {
  if ((typeof value !== 'object') || (value === null))
    return false;
  const record = value as Record<string, unknown>;
  if ((typeof record.document !== 'string') || (!Array.isArray(record.changes,)) || (typeof record.note !== 'string'))
    return false;
  return record.changes.every(function isChange(change,): boolean {
    if ((typeof change !== 'object') || (change === null))
      return false;
    const item = change as Record<string, unknown>;
    return (typeof item.before === 'string')
      && (typeof item.after === 'string')
      && (typeof item.sourceQuote === 'string')
      && (typeof item.kind === 'string')
      && (typeof item.explanation === 'string');
  },);
}

export function producerOutcomeValue(
  { outcome, modelId, }: { readonly outcome: ChatJsonOutcome<ProducerDocument>; readonly modelId: string; },
): ProducerDocument {
  if (outcome.kind !== 'ok')
    throw new Error(`prototype producer ${modelId} returned ${outcome.kind}`);
  return outcome.value;
}
