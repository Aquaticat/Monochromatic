// PROTOTYPE ONLY: Candidate G author wire schema and deterministic admission.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import { MAX_SLOT_CHARACTERS, } from './prototype-slot-model.ts';
import {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_OBLIGATIONS,
  MAX_REALIZATION_TARGET_ANCHORS,
  type RealizationAuthorResponse,
  type RealizationCandidateId,
  type RealizationClaim,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
} from './prototype-realization-model.ts';

//region Runtime aliases

/**
 * Derives opaque candidate alias from manifest and non-priority plan ordinal.
 */
export function realizationCandidateAlias({
  manifestDigest,
  ordinal,
}: {
  readonly manifestDigest: string;
  readonly ordinal: number;
}): RealizationCandidateId {
  if ((!Number.isInteger(ordinal,)) || (ordinal < 0)
    || (ordinal >= MAX_REALIZATION_CANDIDATES))
    throw new Error('realization candidate alias ordinal is outside finite bound');
  const suffix = hashContent({ content: JSON.stringify({
    manifestDigest,
    ordinal,
  }), })
    .slice(
      0,
      16,
    );
  return `candidate-${suffix}`;
}

//endregion Runtime aliases

//region Schema

/**
 * JSON schema shared by every bounded target anchor.
 */
const TARGET_ANCHOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'slotKey',
    'startOffset',
    'endOffset',
    'digest',
  ],
  properties: {
    slotKey: {
      type: 'string',
      minLength: 1,
      maxLength: 32,
    },
    startOffset: {
      type: 'integer',
      minimum: 0,
      maximum: MAX_SLOT_CHARACTERS,
    },
    endOffset: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_SLOT_CHARACTERS,
    },
    digest: {
      type: 'string',
      minLength: 64,
      maxLength: 64,
    },
  },
} as const;

/**
 * Builds strict duplicate-detectable author response schema from manifest rows.
 */
export function realizationAuthorResponseFormat({
  shell,
  ledger,
}: {
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
}): JsonSchemaResponseFormat {
  if ((ledger.obligations
    .length
    === 0) || (ledger.obligations
      .length
      > MAX_REALIZATION_OBLIGATIONS))
    throw new Error('realization author schema obligation count is outside finite bound');
  return {
    type: 'json_schema',
    json_schema: {
      name: 'verified_realization_author',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'slots',
          'realization',
        ],
        properties: {
          slots: {
            type: 'array',
            minItems: shell.slots
              .length,
            maxItems: shell.slots
              .length,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'slotKey',
                'text',
              ],
              properties: {
                slotKey: {
                  type: 'string',
                  enum: shell.slots
                    .map(function key(slot,) { return slot.key; },),
                },
                text: {
                  type: 'string',
                  minLength: 1,
                  maxLength: MAX_SLOT_CHARACTERS,
                },
              },
            },
          },
          realization: {
            type: 'array',
            minItems: ledger.obligations
              .length,
            maxItems: ledger.obligations
              .length,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'obligationId',
                'targetAnchors',
              ],
              properties: {
                obligationId: {
                  type: 'string',
                  enum: ledger.obligations
                    .map(function id(obligation,) { return obligation.id; },),
                },
                targetAnchors: {
                  type: 'array',
                  minItems: 0,
                  maxItems: MAX_REALIZATION_TARGET_ANCHORS,
                  items: TARGET_ANCHOR_SCHEMA,
                },
              },
            },
          },
        },
      },
    },
  };
}

//endregion Schema

//region Structural guards

/**
 * Reads unknown value as readonly record without widening to any.
 */
function recordValue({ value, }: { readonly value: unknown; }): Readonly<Record<string, unknown>> | undefined {
  return ((typeof value) === 'object') && (value !== null)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

/**
 * Checks exact own keys independent of key order.
 */
function hasExactKeys({
  value,
  expected,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly expected: readonly string[];
}): boolean {
  const actual = Object.keys(value,);
  return (actual.length === expected.length) && expected.every(function held(key,) { return actual.includes(key,); });
}

/**
 * Checks bounded target anchor primitive wire shape.
 */
function isTargetAnchor(value: unknown,): value is RealizationTargetAnchor {
  const record = recordValue({ value, });
  return (record !== undefined)
    && hasExactKeys({
      value: record,
      expected: [
        'slotKey',
        'startOffset',
        'endOffset',
        'digest',
      ],
    })
    && ((typeof record.slotKey) === 'string')
    && Number.isInteger(record.startOffset,)
    && Number.isInteger(record.endOffset,)
    && ((typeof record.digest) === 'string')
    && (record.digest
      .length
      === 64);
}

/**
 * Checks one duplicate-detectable realization claim wire row.
 */
function isRealizationClaim(value: unknown,): value is RealizationClaim {
  const record = recordValue({ value, });
  return (record !== undefined)
    && hasExactKeys({
      value: record,
      expected: [
        'obligationId',
        'targetAnchors',
      ],
    })
    && ((typeof record.obligationId) === 'string')
    && Array.isArray(record.targetAnchors,)
    && (record.targetAnchors
      .length
      <= MAX_REALIZATION_TARGET_ANCHORS)
    && record.targetAnchors
    .every(isTargetAnchor,);
}

/**
 * Builds author type guard for one exact shell and obligation manifest.
 */
export function realizationAuthorResponseGuard({
  shell,
  ledger,
}: {
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
}): (value: unknown) => value is RealizationAuthorResponse {
  if ((ledger.obligations
    .length
    === 0) || (ledger.obligations
      .length
      > MAX_REALIZATION_OBLIGATIONS))
    throw new Error('realization author guard obligation count is outside finite bound');
  const expectedSlots = shell.slots
    .map(function key(slot,) { return slot.key; },);
  const expectedObligations = ledger.obligations
    .map(function id(obligation,) { return obligation.id; },);
  return function isRealizationAuthorResponse(value: unknown,): value is RealizationAuthorResponse {
    const record = recordValue({ value, });
    if ((record === undefined)
      || (!hasExactKeys({
        value: record,
        expected: [
          'slots',
          'realization',
        ],
      }))
      || (!Array.isArray(record.slots,))
      || (!Array.isArray(record.realization,))
      || (record.slots
        .length
        !== expectedSlots.length)
      || (record.realization
        .length
        !== expectedObligations.length))
      return false;
    const slotRows = record.slots
      .map(recordValueFromUnknown,);
    if (slotRows.some(function absent(row,) { return row === undefined; }))
      return false;
    const slotKeys = slotRows.flatMap(function slot(row,): readonly string[] {
      if ((row === undefined)
        || (!hasExactKeys({
          value: row,
          expected: [
            'slotKey',
            'text',
          ],
        }))
        || ((typeof row.slotKey) !== 'string')
        || ((typeof row.text) !== 'string')
        || (row.text
          .trim()
          === '')
        || (row.text
          .length
          > MAX_SLOT_CHARACTERS))
        return [];
      return [row.slotKey,];
    },);
    if ((slotKeys.length !== expectedSlots.length)
      || (new Set(slotKeys,).size !== slotKeys.length)
      || expectedSlots.some(function missing(key,) { return !slotKeys.includes(key,); }))
      return false;
    if (!record.realization
      .every(isRealizationClaim,))
      return false;
    const obligationIds = record.realization
      .map(function id(claim,) { return claim.obligationId; },);
    return (new Set(obligationIds,).size === obligationIds.length)
      && expectedObligations.every(function missing(id,) { return obligationIds.includes(id,); });
  };
}

/**
 * Adapts unknown value for array map without destructuring ambiguity.
 */
function recordValueFromUnknown(value: unknown,): Readonly<Record<string, unknown>> | undefined {
  return recordValue({ value, });
}

//endregion Structural guards
