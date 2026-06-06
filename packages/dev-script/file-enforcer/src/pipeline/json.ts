//region JSON object editing: parse, merge, and omit on flat JSON objects

/* oxlint-disable no-restricted-syntax/no-nullish-union -- JSON null is a legitimate JSON data value in this union, not a nullish-absence escape. */
/**
 * JSON value, mirroring the data model `JSON.parse` yields.
 * The object member is an inline index signature rather than {@link JsonObject}
 * so the alias recurses only through object types, avoiding a self-reference cycle.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue; };
/* oxlint-enable no-restricted-syntax/no-nullish-union */

/**
 * Mutable JSON object keyed by string, used as the working shape for edits.
 */
export type JsonObject = Record<string, JsonValue>;

/**
 * Checks whether a value is a non-array JSON object.
 *
 * @param value - Value to test.
 *
 * @returns Whether value is a non-null, non-array object.
 *
 * @example
 * ```ts
 * isJsonObject({});
 * ```
 */
export function isJsonObject(value: unknown,): value is JsonObject {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Parses JSON text expected to hold an object.
 *
 * @param content - JSON text.
 *
 * @param label - Identifier surfaced in the error when content is not an object.
 *
 * @returns Parsed JSON object.
 *
 * @throws Error when content does not parse to a non-array object.
 *
 * @example
 * ```ts
 * parseJsonObject({ content: '{"a":1}', label: 'settings' });
 * ```
 */
export function parseJsonObject(
  {
    content,
    label,
  }: {
    readonly content: string;
    readonly label: string
  },
): JsonObject {
  /**
   * Raw parse result before object validation.
   */
  const parsed: unknown = JSON.parse(content,);
  if (!isJsonObject(parsed,)) throw new Error(`'${label}' must be a JSON object`,);
  return parsed;
}

/**
 * Formats a JSON object with two-space indentation and no trailing newline.
 * Matches how JetBrains LSP4IJ template settings store embedded JSON.
 *
 * @param value - JSON object to format.
 *
 * @returns Indented JSON text.
 *
 * @example
 * ```ts
 * formatJsonObject({ value: { a: 1 } });
 * ```
 */
export function formatJsonObject({ value, }: { readonly value: Readonly<JsonObject>; },): string {
  return JSON.stringify(
    value,
    null,
    2,
  );
}

/**
 * Copies an object without one key, preserving the order of remaining keys.
 *
 * @param object - Source object.
 *
 * @param key - Key to exclude.
 *
 * @returns Copy without key.
 *
 * @example
 * ```ts
 * omitJsonKey({ object: { a: 1, b: 2 }, key: 'a' });
 * ```
 */
export function omitJsonKey(
  {
    object,
    key,
  }: {
    readonly key: string;
    readonly object: Readonly<JsonObject>
  },
): JsonObject {
  /**
   * Working copy without the omitted key.
   */
  const updated: JsonObject = {};
  for (const [entryKey, entryValue,] of Object.entries(object,)) {
    if (entryKey !== key) updated[entryKey] = entryValue;
  }
  return updated;
}

/**
 * Merges scalar overrides and array unions into a flat JSON object.
 * Existing keys keep their position; new keys append in argument order, so
 * stable inputs produce byte-stable `formatJsonObject` output. `set` is applied
 * before `arrayUnion`; array unions keep existing string members then append new
 * ones, deduplicated.
 *
 * @param base - Source object copied before edits.
 *
 * @param set - Scalar or structured values to assign by key.
 *
 * @param arrayUnion - String arrays unioned into the existing array at each key.
 *
 * @returns Merged copy of base.
 *
 * @example
 * ```ts
 * mergeFlatJson({ base: { a: 1 }, set: { b: false }, arrayUnion: { c: ['x'] } });
 * ```
 */
export function mergeFlatJson(
  {
    base,
    set,
    arrayUnion,
  }: {
    readonly arrayUnion?: Readonly<Record<string, readonly string[]>>;
    readonly base: Readonly<JsonObject>;
    readonly set?: Readonly<Record<string, JsonValue>>;
  },
): JsonObject {
  /**
   * Working copy of base with edits applied.
   */
  const updated: JsonObject = { ...base, };
  if (set !== undefined) {
    for (const [key, value,] of Object.entries(set,)) {
      updated[key] = value;
    }
  }
  if (arrayUnion !== undefined) {
    for (const [key, additions,] of Object.entries(arrayUnion,)) {
      /**
       * Existing value at the key, if any.
       */
      const existing = updated[key];
      /**
       * Existing string members, ignoring non-string entries.
       */
      const existingMembers = Array.isArray(existing,)
        ? existing.filter(function keepString(member,): member is string {
          return (typeof member) === 'string';
        },)
        : [];
      updated[key] = [...new Set([
        ...existingMembers,
        ...additions,
      ],),];
    }
  }
  return updated;
}

/**
 * Adds default keys to an object only where absent, preserving existing values.
 *
 * @param base - Source object copied before edits.
 *
 * @param defaults - Values applied only for keys missing from base.
 *
 * @returns Merged copy of base.
 *
 * @example
 * ```ts
 * mergeObjectDefaults({ base: { a: 1 }, defaults: { a: 9, b: 2 } });
 * // { a: 1, b: 2 }
 * ```
 */
export function mergeObjectDefaults(
  {
    base,
    defaults,
  }: {
    readonly base: Readonly<JsonObject>;
    readonly defaults: Readonly<Record<string, JsonValue>>
  },
): JsonObject {
  /**
   * Working copy of base with defaults applied.
   */
  const updated: JsonObject = { ...base, };
  for (const [key, value,] of Object.entries(defaults,)) {
    updated[key] ??= value;
  }
  return updated;
}

//endregion JSON object editing
