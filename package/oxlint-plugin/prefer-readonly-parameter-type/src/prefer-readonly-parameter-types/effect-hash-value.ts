/**
 * Deterministic hash updates for JSON-compatible semantic configuration.
 *
 * @module
 */

import type { Hash, } from 'node:crypto';

/**
 * Updates digest with unambiguous string field.
 *
 * @param digest - Hash receiving length-prefixed text.
 *
 * @param value - Text field to append.
 *
 * @returns same hash for nested calls.
 *
 * @mutates digest - `digest.update` appends field length and bytes.
 *
 * @example
 * ```ts
 * updateHashString({ digest, value: 'strict' });
 * ```
 */
export function updateHashString({
  digest,
  value,
}: {
  readonly digest: Hash;
  readonly value: string;
},): Hash {
  return digest
    .update(String(value.length,),)
    .update(':',)
    .update(value,);
}

/**
 * Tests whether compiler option value is a property-bearing record.
 *
 * @param value - Compiler option value.
 *
 * @returns whether string-keyed properties can be inspected.
 */
function isPlainRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Updates digest with deterministic JSON-compatible value representation.
 *
 * @param digest - Hash receiving canonical fields.
 *
 * @param value - Compiler option value decoded by TypeScript API.
 *
 * @mutates digest - `digest.update` appends deterministic type and value representation.
 *
 * @example
 * ```ts
 * updateHashPlainValue({ digest, value: { strict: true } });
 * ```
 */
export function updateHashPlainValue({
  digest,
  value,
}: {
  readonly digest: Hash;
  readonly value: unknown;
},): void {
  if (value === null) {
    updateHashString({
      digest,
      value: 'null',
    },);
    return;
  }
  if ((typeof value) === 'string') {
    updateHashString({
      digest,
      value: `string:${value}`,
    },);
    return;
  }
  if ((typeof value) === 'number') {
    updateHashString({
      digest,
      value: `number:${value}`,
    },);
    return;
  }
  if ((typeof value) === 'boolean') {
    updateHashString({
      digest,
      value: value ? 'boolean:true' : 'boolean:false',
    },);
    return;
  }
  if ((typeof value) === 'undefined') {
    updateHashString({
      digest,
      value: 'undefined',
    },);
    return;
  }
  if (((typeof value) === 'bigint') || ((typeof value) === 'symbol')
    || ((typeof value) === 'function'))
    throw new Error(`Unsupported compiler option value type: ${typeof value}.`,);
  if (Array.isArray(value,)) {
    updateHashString({
      digest,
      value: 'array',
    },);
    for (const element of value) {
      updateHashPlainValue({
        digest,
        value: element,
      },);
    }
    return;
  }
  if (!isPlainRecord(value,))
    throw new Error('Compiler option fingerprint supports only JSON-compatible values.',);
  updateHashString({
    digest,
    value: 'record',
  },);
  Object.keys(value,)
    .toSorted()
    .forEach(function updateProperty(key,): void {
      updateHashString({
        digest,
        value: key,
      },);
      updateHashPlainValue({
        digest,
        value: value[key],
      },);
    },);
}
