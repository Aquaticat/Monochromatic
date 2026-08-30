// PROTOTYPE ONLY: finite accountable-editor payload contracts.

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import type { RosterModelId, } from './roster-id.ts';

export type PrototypeFinding = {
  readonly kind: string;
  readonly targetQuote: string;
  readonly sourceQuote: string;
  readonly explanation: string;
};

export type PrototypeAudit = {
  readonly findings: readonly PrototypeFinding[];
};

export type PrototypeDraft = {
  readonly document: string;
  readonly notes: string;
};

export type PrototypePatch = {
  readonly before: string;
  readonly after: string;
  readonly findingIds: readonly string[];
};

export type PrototypeCommit = {
  readonly patches: readonly PrototypePatch[];
  readonly resolvedFindingIds: readonly string[];
  readonly notes: string;
};

const STRING_PROPERTY = { type: 'string', } as const;

export const DRAFT_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'finite_editor_draft',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['document', 'notes',],
      properties: {
        document: STRING_PROPERTY,
        notes: STRING_PROPERTY,
      },
    },
  },
};

export const AUDIT_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'finite_editor_audit',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['findings',],
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'targetQuote', 'sourceQuote', 'explanation',],
            properties: {
              kind: {
                type: 'string',
                enum: [
                  'wrong-meaning',
                  'omission',
                  'addition',
                  'identity-change',
                  'attribution',
                  'grammar',
                  'usage',
                  'unclear-expression',
                  'register-mismatch',
                  'unclear-reference',
                  'tense-inconsistency',
                  'chronology',
                  'repetition',
                  'paragraph-relation',
                ],
              },
              targetQuote: STRING_PROPERTY,
              sourceQuote: STRING_PROPERTY,
              explanation: STRING_PROPERTY,
            },
          },
        },
      },
    },
  },
};

export const COMMIT_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'finite_editor_commit',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['patches', 'resolvedFindingIds', 'notes',],
      properties: {
        patches: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['before', 'after', 'findingIds',],
            properties: {
              before: STRING_PROPERTY,
              after: STRING_PROPERTY,
              findingIds: {
                type: 'array',
                items: STRING_PROPERTY,
              },
            },
          },
        },
        resolvedFindingIds: {
          type: 'array',
          items: STRING_PROPERTY,
        },
        notes: STRING_PROPERTY,
      },
    },
  },
};

function isRecord(value: unknown,): value is Record<string, unknown> {
  return (typeof value === 'object') && (value !== null) && (!Array.isArray(value,));
}

function isStringArray(value: unknown,): value is readonly string[] {
  return Array.isArray(value,) && value.every((item,) => typeof item === 'string');
}

export function isPrototypeDraft(value: unknown,): value is PrototypeDraft {
  return isRecord(value,)
    && (typeof value.document === 'string')
    && (typeof value.notes === 'string');
}

export function isPrototypeAudit(value: unknown,): value is PrototypeAudit {
  return isRecord(value,)
    && Array.isArray(value.findings,)
    && value.findings.every((finding,) => isRecord(finding,)
      && (typeof finding.kind === 'string')
      && (typeof finding.targetQuote === 'string')
      && (typeof finding.sourceQuote === 'string')
      && (typeof finding.explanation === 'string'));
}

export function isPrototypeCommit(value: unknown,): value is PrototypeCommit {
  return isRecord(value,)
    && Array.isArray(value.patches,)
    && value.patches.every((patch,) => isRecord(patch,)
      && (typeof patch.before === 'string')
      && (typeof patch.after === 'string')
      && isStringArray(patch.findingIds,))
    && isStringArray(value.resolvedFindingIds,)
    && (typeof value.notes === 'string');
}

export async function askPrototypeJson<ValueT,>(
  {
    client,
    modelId,
    messages,
    responseFormat,
    validate,
    signal,
  }: {
    readonly client: SyntheticClient;
    readonly modelId: RosterModelId;
    readonly messages: readonly ChatMessage[];
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown,) => value is ValueT;
    readonly signal: AbortSignal;
  },
): Promise<ValueT> {
  const outcome = await client.chatJson({
    modelId,
    messages,
    responseFormat,
    validate,
    signal,
    exchangeTimeoutMs: 360_000,
  },);
  if (outcome.kind !== 'ok')
    throw new Error(`prototype ${modelId} returned ${outcome.kind}`);
  return outcome.value;
}
