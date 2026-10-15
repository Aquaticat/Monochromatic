/**
 Admit ordinary native position records before reading any supplied property value. @module
 */
import { SourceInputLocationError } from './input-location-error.ts';

/**
 Supported native slot shapes contain at most the discriminator and two companion values.
 */
const MAX_LOCATION_FIELDS = 3;

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
  if ((keys.length === 0) || (keys.length > MAX_LOCATION_FIELDS)
    || keys.some(function isNonStringLocationKey(key) { 
      return (typeof key) !== 'string'; 
    })) throw new SourceInputLocationError('Source input location requires supported named slot fields');
  for (const key of keys) {
    /**
     A disappearing own property retains the original descriptor failure category.
     */
    const descriptor = Object.getOwnPropertyDescriptor(
      location,
      key
    );
    if (descriptor === undefined) throw new TypeError('Cannot convert undefined or null to object');
    if (!Object.hasOwn(
      descriptor,
      'value'
    )) throw new SourceInputLocationError('Source input location requires data fields');
  }
  return keys.toSorted(function compareLocationKeys(
    left,
    right
  ) {
    if (((typeof left) !== 'string') || ((typeof right) !== 'string')) throw new SourceInputLocationError('Source input location requires string field names');
    return left < right ? -1 : left > right ? 1 : 0;
  })
    .join(',');
}

/**
 Integer admission narrows the original ordinal before its separately retained nonnegative check.

 @param value - untrusted ordinal field

 @returns whether the value is an integer within the native safe-number representation

 @example isInputLocationInteger(0);
 */
export function isInputLocationInteger(value: unknown): value is number {
  return Number.isSafeInteger(value);
}
