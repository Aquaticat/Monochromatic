import { isJsonRecord, } from './json-guard.ts';
import { PreparationRootError, } from './preparation-root-error.ts';

//region Closed values from invocation-owned parsed input

/**
 Expected schema position never incorporates an unrecognized input key or evidence text.

 @internal

 @example
 ```ts
 const field: PreparationInputField = { value: record.entries, path: 'inputs.entries' };
 ```
 */
export type PreparationInputField = {
  /**
   Invocation-owned parsed value whose schema is not yet established.
   */
  readonly value: unknown;
  /**
   Authored field path with computed array indexes, never caller-selected error metadata.
   */
  readonly path: string;
};

/**
 Rejects every absent or extra own field before property-level interpretation.
 This helper receives only the decoder's owned JSON objects, not foreign object capabilities.

 @internal

 @param value - owned parsed record candidate

 @param path - authored schema position for a names-only refusal

 @param keys - complete supported own-key inventory at this position

 @returns Record whose field values remain unknown

 @throws PreparationRootError when the complete own-key inventory differs

 @example
 ```ts
 const record = preparationInputRecord({ value, path, keys: ['scope', 'entries'] });
 ```
 */
export function preparationInputRecord({
  value,
  path,
  keys,
}: PreparationInputField & { readonly keys: readonly string[] }): Readonly<Record<string, unknown>> {
  if (Array.isArray(value) || (!isJsonRecord(value)))
    throw new PreparationRootError({ kind: 'input-shape', input: path });
  /**
   Symbol and non-enumerable fields cannot disappear from the schema check.
   */
  const actual = Reflect.ownKeys(value);
  if ((Object.getPrototypeOf(value) !== Object.prototype)
    || (actual.length !== keys.length)
    || (!actual.every(function supported(key): boolean {
      return ((typeof key) === 'string') && keys.includes(key);
    })))
    throw new PreparationRootError({ kind: 'input-shape', input: path });
  return value;
}

/**
 Preserves collection order while leaving each element unknown until its owning decoder runs.

 @internal

 @param value - owned parsed collection candidate

 @param path - authored schema position rather than any element's content

 @returns Explicit parsed elements without an unchecked element-type assertion

 @throws PreparationRootError when this position does not contain an array

 @example
 ```ts
 const entries = preparationInputArray({ value, path });
 ```
 */
export function preparationInputArray({
  value,
  path,
}: PreparationInputField): readonly unknown[] {
  if (!Array.isArray(value))
    throw new PreparationRootError({ kind: 'input-shape', input: path });
  /**
   Native array narrowing must not promote its elements beyond unknown.
   */
  const elements: readonly unknown[] = value;
  return elements;
}

/**
 Preserves exact text, including deliberate empty source or target content.

 @internal

 @param value - owned parsed text candidate

 @param path - authored schema position for the affected input

 @returns Unmodified text with no trimming or implicit coercion

 @throws PreparationRootError when a non-string reaches a text position

 @example
 ```ts
 const sourceText = preparationInputString({ value, path });
 ```
 */
export function preparationInputString({
  value,
  path,
}: PreparationInputField): string {
  if ((typeof value) !== 'string')
    throw new PreparationRootError({ kind: 'input-shape', input: path });
  return value;
}

/**
 Keeps explicit evidence flags distinct from absent values and truthy coercions.

 @internal

 @param value - owned parsed flag candidate

 @param path - authored schema position for the affected input

 @returns Exact boolean evidence flag

 @throws PreparationRootError when the flag is not a boolean

 @example
 ```ts
 const open = preparationInputBoolean({ value, path });
 ```
 */
export function preparationInputBoolean({
  value,
  path,
}: PreparationInputField): boolean {
  if ((typeof value) !== 'boolean')
    throw new PreparationRootError({ kind: 'input-shape', input: path });
  return value;
}

/**
 Reads nonnegative safe counts and coordinates without changing numeric spelling or meaning.

 @internal

 @param value - owned parsed count or coordinate

 @param path - authored schema position for the affected input

 @returns Safe nonnegative integer without fractional or negative-zero ambiguity

 @throws PreparationRootError when the numeric domain differs

 @example
 ```ts
 const offset = preparationInputInteger({ value, path });
 ```
 */
export function preparationInputInteger({
  value,
  path,
}: PreparationInputField): number {
  if (((typeof value) !== 'number') || (!Number.isSafeInteger(value))
    || (value < 0) || Object.is(value, -0))
    throw new PreparationRootError({ kind: 'input-shape', input: path });
  return value;
}

/**
 Checks only the bounded lowercase hexadecimal identity grammar, never review or authenticity.

 @internal

 @param value - owned parsed digest candidate

 @param path - authored schema position for the affected input

 @param characters - exact SHA-1 or SHA-256 representation length selected by the owning field

 @returns Original digest text after exact grammar validation

 @throws PreparationRootError when digest extent or alphabet differs

 @example
 ```ts
 const digest = preparationInputDigest({ value, path, characters: 64 });
 ```
 */
export function preparationInputDigest({
  value,
  path,
  characters,
}: PreparationInputField & { readonly characters: 40 | 64 }): string {
  /**
   Required extent bounds the alphabet scan independently from input content.
   */
  const text = preparationInputString({ value, path });
  if (text.length !== characters)
    throw new PreparationRootError({ kind: 'input-shape', input: path });
  for (const character of text) {
    if (!'0123456789abcdef'.includes(character))
      throw new PreparationRootError({ kind: 'input-shape', input: path });
  }
  return text;
}

/**
 Carries only an authored field name into the next decoder and its diagnostic position.

 @internal

 @param value - current record after its complete key inventory was checked

 @param path - authored position of the containing record

 @param key - expected schema key, never a key selected from unrecognized input

 @returns Unknown field value and its owned schema position

 @example
 ```ts
 const child = preparationInputProperty({ value: record, path, key: 'entries' });
 ```
 */
export function preparationInputProperty({
  value,
  path,
  key,
}: PreparationInputField & {
  readonly value: Readonly<Record<string, unknown>>;
  readonly key: string;
}): PreparationInputField {
  return {
    value: value[key],
    path: `${path}.${key}`,
  };
}

/**
 Applies an owned field decoder in persisted order and freezes the new collection.

 @internal

 @param value - current parsed array candidate

 @param path - authored schema position of this collection

 @param read - field-specific decoder owned by the complete DTO reader

 @returns New ordered collection of individually decoded values

 @throws PreparationRootError when the collection or any element differs from its schema

 @example
 ```ts
 const hashes = preparationInputItems({ value, path, read: readHash });
 ```
 */
export function preparationInputItems<const Item>({
  value,
  path,
  read,
}: PreparationInputField & {
  readonly read: (field: PreparationInputField) => Item;
}): readonly Item[] {
  /**
   Elements remain unknown until the field-specific decoder receives their computed positions.
   */
  const values = preparationInputArray({ value, path });
  return Object.freeze(values.map(function readItem(item: unknown, index: number): Item {
    return read({
      value: item,
      path: `${path}[${String(index)}]`,
    });
  }));
}

/**
 Binds an exact record and its authored path once for a DTO-specific constructor.

 @internal

 @param value - owned parsed record candidate

 @param path - authored schema position of this record

 @param keys - complete supported own-key inventory

 @returns Selector carrying unknown values and owned schema positions into explicit decoders

 @throws PreparationRootError when record shape differs or a decoder requests an unsupported field

 @example
 ```ts
 const field = preparationInputFields({ value, path, keys: ['scope'] });
 const scope = preparationInputString(field('scope'));
 ```
 */
export function preparationInputFields({
  value,
  path,
  keys,
}: PreparationInputField & {
  readonly keys: readonly string[];
}): (key: string) => PreparationInputField {
  /**
   Every own field is checked before the selector is created.
   */
  const allowed = [...keys];
  /**
   Caller mutation of a schema-key array cannot change the selector after validation.
   */
  const record = preparationInputRecord({ value, path, keys: allowed });
  /**
   The decoder supplies this key from its schema, never from arbitrary JSON member names.

   @param key - expected field selected by the DTO-specific constructor

   @returns Unknown field at its authored schema position

   @throws PreparationRootError when the requested key is not part of this schema

   @example
   ```ts
   const field = read('scope');
   ```
   */
  function read(key: string): PreparationInputField {
    if (!allowed.includes(key))
      throw new PreparationRootError({ kind: 'input-shape', input: path });
    return preparationInputProperty({ value: record, path, key });
  }
  return read;
}

//endregion Closed values from invocation-owned parsed input
