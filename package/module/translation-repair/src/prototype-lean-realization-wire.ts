// PROTOTYPE ONLY: Candidate L closed 27-value author response boundary.

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { isJsonRecord, } from './json-guard.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  MAX_SLOT_CHARACTERS,
  type ImmutableShell,
  type SlotDocumentResponse,
} from './prototype-slot-model.ts';

/**
 * Canonical mutable keys with front matter before body slots.
 *
 * @returns Exact Candidate L response-key order
 *
 * @example
 * ```ts
 * const keys = leanRealizationSlotKeys({ shell, reviewPlan, });
 * ```
 */
export function leanRealizationSlotKeys({
  shell,
  reviewPlan,
}: {
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
}): readonly string[] {
  return [
    ...reviewPlan.frontMatterSubjects
      .map(function key(subject,) {
      return subject.targetSlotKey;
    },),
    ...shell.slots
      .map(function key(slot,) { return slot.key; }),
  ];
}

/**
 * Candidate L author schema for every mutable target value.
 *
 * @returns Strict response format with exact mutable keys
 *
 * @example
 * ```ts
 * const format = leanRealizationResponseFormat({ shell, reviewPlan, });
 * ```
 */
export function leanRealizationResponseFormat({
  shell,
  reviewPlan,
}: {
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
}): JsonSchemaResponseFormat {
  /**
   * Canonical mutable response keys.
   */
  const keys = leanRealizationSlotKeys({
    shell,
    reviewPlan,
  });
  /**
   * String schemas keyed by mutable target identity.
   */
  const properties = Object.fromEntries(keys.map(function property(key,) {
    return [
      key,
      {
        type: 'string',
        minLength: 1,
        maxLength: MAX_SLOT_CHARACTERS,
      },
    ];
  },),);
  return {
    type: 'json_schema',
    json_schema: {
      name: 'lean_realization_slots',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['slots',],
        properties: {
          slots: {
            type: 'object',
            additionalProperties: false,
            required: keys,
            properties,
          },
        },
      },
    },
  };
}

/**
 * Candidate L parsed-response guard for exact mutable key set.
 *
 * @returns Guard refusing missing, extra, empty, or oversized values
 *
 * @example
 * ```ts
 * const valid = leanRealizationGuard({ shell, reviewPlan, })(value);
 * ```
 */
export function leanRealizationGuard({
  shell,
  reviewPlan,
}: {
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
}): (value: unknown) => value is SlotDocumentResponse {
  /**
   * Canonical key set captured by returned guard.
   */
  const expected = leanRealizationSlotKeys({
    shell,
    reviewPlan,
  });
  return function isLeanRealizationResponse(value: unknown): value is SlotDocumentResponse {
    if (((typeof value) !== 'object')
      || (value === null)
      || (Object.keys(value,)
        .length
        !== 1)
      || (!('slots' in value)))
      return false;
    /**
     * Untrusted nested slot map.
     */
    const { slots, } = value;
    if (!isJsonRecord(slots,))
      return false;
    /**
     * Actual untrusted slot keys.
     */
    const actual = Object.keys(slots,);
    if ((actual.length !== expected.length)
      || expected.some(function missing(key,) { return !actual.includes(key,); }))
      return false;
    return expected.every(function valid(key,) {
      /**
       * Untrusted value assigned to current key.
       */
      const text = slots[key];
      return ((typeof text) === 'string')
        && (text.trim() !== '')
        && (text.length <= MAX_SLOT_CHARACTERS);
    },);
  };
}
