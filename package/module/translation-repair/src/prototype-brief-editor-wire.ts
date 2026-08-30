// PROTOTYPE ONLY: Candidate C preparation brief and editor wire contracts.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';

export type PreparationBriefItem = {
  readonly anchorDomain: 'source' | 'archive' | 'media';
  readonly anchor: string;
  readonly defectClass: string;
  readonly instruction: string;
};

export type PreparationBrief = {
  readonly summary: string;
  readonly items: readonly PreparationBriefItem[];
};

export type SourceRealization = {
  readonly sourceUnitId: string;
  readonly targetQuote: string;
};

export type BriefDisposition = {
  readonly briefId: string;
  readonly disposition: 'applied' | 'not-applicable';
  readonly reason: string;
};

export type BriefEditorDocument = {
  readonly document: string;
  readonly realizations: readonly SourceRealization[];
  readonly briefDispositions: readonly BriefDisposition[];
};

const SHORT_TEXT: Readonly<Record<string, unknown>> = {
  type: 'string',
  minLength: 1,
  maxLength: 512,
};

export const PREPARATION_BRIEF_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'located_preparation_brief',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'items',],
      properties: {
        summary: { type: 'string', maxLength: 2_000, },
        items: {
          type: 'array',
          maxItems: 32,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['anchorDomain', 'anchor', 'defectClass', 'instruction',],
            properties: {
              anchorDomain: { type: 'string', enum: ['source', 'archive', 'media',], },
              anchor: SHORT_TEXT,
              defectClass: SHORT_TEXT,
              instruction: SHORT_TEXT,
            },
          },
        },
      },
    },
  },
};

export const BRIEF_EDITOR_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'brief_informed_complete_document',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['document', 'realizations', 'briefDispositions',],
      properties: {
        document: { type: 'string', minLength: 1, },
        realizations: {
          type: 'array',
          maxItems: 128,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['sourceUnitId', 'targetQuote',],
            properties: {
              sourceUnitId: SHORT_TEXT,
              targetQuote: { type: 'string', minLength: 1, maxLength: 4_000, },
            },
          },
        },
        briefDispositions: {
          type: 'array',
          maxItems: 128,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['briefId', 'disposition', 'reason',],
            properties: {
              briefId: SHORT_TEXT,
              disposition: { type: 'string', enum: ['applied', 'not-applicable',], },
              reason: SHORT_TEXT,
            },
          },
        },
      },
    },
  },
};

function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return (typeof value === 'object') && (value !== null);
}

export function isPreparationBrief(value: unknown,): value is PreparationBrief {
  if ((!isRecord(value,)) || (typeof value.summary !== 'string') || (!Array.isArray(value.items,)))
    return false;
  return value.items.every(function isItem(item,): boolean {
    if (!isRecord(item,))
      return false;
    return ((item.anchorDomain === 'source') || (item.anchorDomain === 'archive') || (item.anchorDomain === 'media'))
      && (typeof item.anchor === 'string')
      && (item.anchor !== '')
      && (typeof item.defectClass === 'string')
      && (item.defectClass !== '')
      && (typeof item.instruction === 'string')
      && (item.instruction !== '');
  },);
}

export function isBriefEditorDocument(value: unknown,): value is BriefEditorDocument {
  if ((!isRecord(value,))
    || (typeof value.document !== 'string')
    || (value.document === '')
    || (!Array.isArray(value.realizations,))
    || (!Array.isArray(value.briefDispositions,)))
    return false;
  const realizationsValid = value.realizations.every(function isRealization(item,): boolean {
    return isRecord(item,)
      && (typeof item.sourceUnitId === 'string')
      && (item.sourceUnitId !== '')
      && (typeof item.targetQuote === 'string')
      && (item.targetQuote !== '');
  },);
  const dispositionsValid = value.briefDispositions.every(function isDisposition(item,): boolean {
    return isRecord(item,)
      && (typeof item.briefId === 'string')
      && ((item.disposition === 'applied') || (item.disposition === 'not-applicable'))
      && (typeof item.reason === 'string')
      && (item.reason !== '');
  },);
  return realizationsValid && dispositionsValid;
}
