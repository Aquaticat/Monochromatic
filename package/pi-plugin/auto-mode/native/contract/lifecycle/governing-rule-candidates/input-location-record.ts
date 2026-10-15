/**
 Admit ordinary native position records before reading any supplied property value. @module
 */
import { SourceInputLocationError } from './input-location-error.ts';

/**
 Establish ordinary record shape before any slot discriminator is read.

 @param location - untrusted descriptor value from the original source

 @returns assertion exposing named unknown slot values

 @throws SourceInputLocationError for nonordinary records

 @example assertInputLocationRecord(location);
 */
export function assertInputLocationRecord(location: unknown): asserts location is Record<string, unknown> {
  if ((location === null) || ((typeof location) !== 'object')
    || (Object.getPrototypeOf(location) !== Object.prototype)) throw new SourceInputLocationError('Source input location requires an ordinary record');
}

/**
 Order original field names after rejecting unsupported symbol keys.

 @param left - original own property key

 @param right - original own property key

 @returns deterministic lexical ordering for exact slot shape comparison

 @throws SourceInputLocationError for unsupported nonstring names
 */
function compareLocationKeys(left: PropertyKey, right: PropertyKey): number {
  if (((typeof left) !== 'string') || ((typeof right) !== 'string')) throw new SourceInputLocationError('Source input location requires string field names');
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 Reject accessors and unsupported own keys before inspecting native slot contents.

 @param location - original ordinary position record

 @returns sorted exact own field names

 @throws SourceInputLocationError for unsupported key counts or accessor fields

 @example inputLocationShape(location);
 */
export function inputLocationShape(location: Record<string, unknown>): string {
  /**
   Own key enumeration deliberately includes hidden data properties.
   */
  const keys = Reflect.ownKeys(location);
  if ((keys.length === 0) || (keys.length > 3)
    || keys.some(function isNonStringLocationKey(key) { return (typeof key) !== 'string'; })) throw new SourceInputLocationError('Source input location requires supported named slot fields');
  for (const key of keys) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(location, key), 'value')) throw new SourceInputLocationError('Source input location requires data fields');
  }
  return keys.toSorted(compareLocationKeys).join(',');
}

/**
 Ordinal admission preserves the original safe-integer and nonnegative slot profile.

 @param value - untrusted ordinal field

 @returns whether the value can identify an original native position

 @example isInputLocationOrdinal(0);
 */
export function isInputLocationOrdinal(value: unknown): value is number {
  return ((typeof value) === 'number') && Number.isSafeInteger(value) && (value >= 0);
}
