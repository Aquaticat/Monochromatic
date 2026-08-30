// PROTOTYPE ONLY: Candidate B specification and document response contracts.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';

export const MAX_COMPILER_DOCUMENT_CHARACTERS = 200_000;

export type SpecificationUnit = {
  readonly sourceUnitId: string;
  readonly obligations: readonly string[];
};

export type SpecificationResponse = {
  readonly summary: string;
  readonly units: readonly SpecificationUnit[];
};

export type CompilerRealization = {
  readonly sourceUnitId: string;
  readonly targetQuote: string;
  readonly occurrence: number;
};

export type CompilerChange = {
  readonly before: string;
  readonly after: string;
  readonly sourceQuote: string;
  readonly kind: string;
  readonly explanation: string;
};

export type CompilerDocument = {
  readonly mode: 'render' | 'revision' | 'fallback';
  readonly baseDigest: string | null;
  readonly document: string;
  readonly realizations: readonly CompilerRealization[];
  readonly changes: readonly CompilerChange[];
};

const TEXT: Readonly<Record<string, unknown>> = {
  type: 'string',
  minLength: 1,
  maxLength: 2_000,
};

export const SPECIFICATION_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'source_specification',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'units',],
      properties: {
        summary: { type: 'string', maxLength: 4_000, },
        units: {
          type: 'array',
          maxItems: 128,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['sourceUnitId', 'obligations',],
            properties: {
              sourceUnitId: TEXT,
              obligations: {
                type: 'array',
                maxItems: 16,
                items: TEXT,
              },
            },
          },
        },
      },
    },
  },
};

export const COMPILER_DOCUMENT_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'specification_linked_document',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['mode', 'baseDigest', 'document', 'realizations', 'changes',],
      properties: {
        mode: { type: 'string', enum: ['render', 'revision', 'fallback',], },
        baseDigest: { type: ['string', 'null',], },
        document: {
          type: 'string',
          minLength: 1,
          maxLength: MAX_COMPILER_DOCUMENT_CHARACTERS,
        },
        realizations: {
          type: 'array',
          maxItems: 128,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['sourceUnitId', 'targetQuote', 'occurrence',],
            properties: {
              sourceUnitId: TEXT,
              targetQuote: { type: 'string', minLength: 1, maxLength: 4_000, },
              occurrence: { type: 'integer', minimum: 1, maximum: 1_000, },
            },
          },
        },
        changes: {
          type: 'array',
          maxItems: 64,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['before', 'after', 'sourceQuote', 'kind', 'explanation',],
            properties: {
              before: { type: 'string', minLength: 1, },
              after: { type: 'string', },
              sourceQuote: TEXT,
              kind: TEXT,
              explanation: TEXT,
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

export function isSpecificationResponse(value: unknown,): value is SpecificationResponse {
  if ((!isRecord(value,)) || (typeof value.summary !== 'string') || (!Array.isArray(value.units,)))
    return false;
  return value.units.every(function isUnit(unit,): boolean {
    return isRecord(unit,)
      && (typeof unit.sourceUnitId === 'string')
      && (unit.sourceUnitId !== '')
      && Array.isArray(unit.obligations,)
      && unit.obligations.every(function isObligation(obligation,) {
        return (typeof obligation === 'string') && (obligation !== '');
      },);
  },);
}

export function isCompilerDocument(value: unknown,): value is CompilerDocument {
  if ((!isRecord(value,))
    || ((value.mode !== 'render') && (value.mode !== 'revision') && (value.mode !== 'fallback'))
    || ((typeof value.baseDigest !== 'string') && (value.baseDigest !== null))
    || (typeof value.document !== 'string')
    || (value.document === '')
    || (value.document.length > MAX_COMPILER_DOCUMENT_CHARACTERS)
    || (!Array.isArray(value.realizations,))
    || (!Array.isArray(value.changes,)))
    return false;
  const realizationsValid = value.realizations.every(function isRealization(item,): boolean {
    return isRecord(item,)
      && (typeof item.sourceUnitId === 'string')
      && (item.sourceUnitId !== '')
      && (typeof item.targetQuote === 'string')
      && (item.targetQuote !== '')
      && (typeof item.occurrence === 'number')
      && Number.isInteger(item.occurrence,)
      && (item.occurrence >= 1);
  },);
  const changesValid = value.changes.every(function isChange(item,): boolean {
    return isRecord(item,)
      && (typeof item.before === 'string')
      && (item.before !== '')
      && (typeof item.after === 'string')
      && (typeof item.sourceQuote === 'string')
      && (item.sourceQuote !== '')
      && (typeof item.kind === 'string')
      && (item.kind !== '')
      && (typeof item.explanation === 'string')
      && (item.explanation !== '');
  },);
  return realizationsValid && changesValid;
}
