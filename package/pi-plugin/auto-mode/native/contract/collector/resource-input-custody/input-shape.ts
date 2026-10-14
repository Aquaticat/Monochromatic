/**
 Native resource copies validate own data fields before retaining their values.

 @module
 */
import { SourceCollectionError } from '../errors.ts';

//region Ordinary records and arrays retain the native resource profile

/**
 A single captured text retains the original input byte ceiling.
 */
const MAX_TEXT_BYTES = 65_536;

/**
 Narrow ordinary records without asserting types for their unexamined fields.

 @param value - original native value requiring named property access

 @returns whether ordinary or null-prototype record lookup is supported
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null)
    && ((Object.getPrototypeOf(value) === Object.prototype) || (Object.getPrototypeOf(value) === null));
}

/**
 Require ordinary object ownership without invoking a field accessor.

 @param value - original value supplied by the native loader

 @param label - input named in rejection diagnostics

 @returns checked record whose fields remain unknown

 @throws SourceCollectionError when the input is outside the ordinary record profile

 @example
 ```ts
 requireInputRecord({ value: { path: 'AGENTS.md' }, label: 'Context file' });
 ```
 */
export function requireInputRecord({
  value,
  label
}: {
  readonly value: unknown;
  readonly label: string;
}): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new SourceCollectionError(`${label} requires an ordinary record`);
  return value;
}

/**
 Read only an enumerable own data property after checking its descriptor.

 @param value - original record or array whose selected entry must not be an accessor

 @param key - original own key selected by the native schema

 @param message - input-specific rejection identifying the missing evidence

 @returns original data value without invoking its accessor

 @throws SourceCollectionError when the selected property is missing, hidden, or an accessor

 @example
 ```ts
 readInputData({ value: { path: 'AGENTS.md' }, key: 'path', message: 'Missing context path' });
 ```
 */
export function readInputData({
  value,
  key,
  message
}: {
  readonly value: object;
  readonly key: PropertyKey;
  readonly message: string;
}): unknown {
  /**
   Descriptor lookup leaves an accessor's getter uncalled.
   */
  const property = Object.getOwnPropertyDescriptor(
    value,
    key
  );
  if ((property?.enumerable !== true) || (!Object.hasOwn(
    property,
    'value'
  ))) throw new SourceCollectionError(message);
  return property.value;
}

/**
 Select the exact native field set without admitting hidden or symbolic additions.

 @param value - original record whose schema is fixed by the native resource boundary

 @param keys - required original field names

 @param label - input named in rejection diagnostics

 @returns ordinary record with the required data fields

 @throws SourceCollectionError when fields differ from the declared native schema

 @example
 ```ts
 requireInputFields({ value: { agentsFiles: [] }, keys: ['agentsFiles'], label: 'Context input' });
 ```
 */
export function requireInputFields({
  value,
  keys,
  label
}: {
  readonly value: unknown;
  readonly keys: readonly string[];
  readonly label: string;
}): Readonly<Record<string, unknown>> {
  /**
   The checked record still retains the original native identity.
   */
  const record = requireInputRecord({
    value,
    label
  });
  /**
   Symbols and hidden fields remain part of exact schema membership.
   */
  const actual = Reflect.ownKeys(record);
  if ((actual.length !== keys.length) || actual.some(function unexpectedField(key) {
    return ((typeof key) !== 'string') || (!keys.includes(key));
  })) throw new SourceCollectionError(`${label} has unsupported fields`);
  for (const key of keys) readInputData({
    value: record,
    key,
    message: `${label} requires data fields`
  });
  return record;
}

/**
 Retain immutable text without truncating an oversized source.

 @param value - original input whose complete text is required

 @param label - input named in rejection diagnostics

 @returns complete input text within the original byte ceiling

 @throws SourceCollectionError when text is missing or exceeds the original profile

 @example
 ```ts
 requireInputText({ value: 'complete source', label: 'System input' });
 ```
 */
export function requireInputText({
  value,
  label
}: {
  readonly value: unknown;
  readonly label: string;
}): string {
  if (((typeof value) !== 'string') || (Buffer.byteLength(value) > MAX_TEXT_BYTES)) throw new SourceCollectionError(`${label} requires bounded text`);
  return value;
}

/**
 Narrow array entries to unknown without propagating Array.isArray's any element type.

 @param value - native value whose ordinary array prototype is required

 @returns whether ordinary array indexing is supported
 */
function isOrdinaryArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && (Object.getPrototypeOf(value) === Array.prototype);
}

/**
 Retain only bounded dense arrays with enumerable own data entries.

 @param value - original list to validate before copying

 @param label - input named in rejection diagnostics

 @param maximum - original schema's entry ceiling

 @returns original list after every entry descriptor is checked

 @throws SourceCollectionError when the list is sparse, extended, or contains accessors

 @example
 ```ts
 requireInputList({ value: ['complete source'], label: 'Append input', maximum: 32 });
 ```
 */
export function requireInputList({
  value,
  label,
  maximum
}: {
  readonly value: unknown;
  readonly label: string;
  readonly maximum: number;
}): readonly unknown[] {
  if ((!isOrdinaryArray(value)) || (value.length > maximum)
    || (Reflect.ownKeys(value)
      .length
      !== (value.length + 1))) throw new SourceCollectionError(`${label} requires a bounded ordinary dense array`);
  for (let index = 0; index < value.length; index++) {
    readInputData({
      value,
      key: String(index),
      message: `${label} contains a missing or accessor entry`
    });
  }
  return value;
}

//endregion Ordinary records and arrays retain the native resource profile
