//region Untrusted JSON narrowing

/**
 Narrows parsed JSON to a non-array object.

 @param value - Parsed JSON or YAML value.

 @returns Whether properties can be read by key.

 @example
 ```ts
 isJsonRecord(JSON.parse('{"a":1}'));
 // => true
 ```
 */
export function isJsonRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value,));
}

/**
 Reads one property from an untrusted value without asserting its shape.

 @param value - Parsed value that may or may not be an object.

 @param key - Property to read.

 @returns Property value, or undefined when the value is not an object.

 @example
 ```ts
 fieldOf({ value: { a: 1 }, key: 'a' });
 // => 1
 ```
 */
export function fieldOf(
  {
    value,
    key,
  }: {
    readonly value: unknown;
    readonly key: string;
  },
): unknown {
  return isJsonRecord(value,) ? value[key] : undefined;
}

/**
 Reads the first element of an untrusted value without asserting its shape.

 @param value - Parsed value that may or may not be an array.

 @returns First element, or undefined when the value is not a non-empty array.

 @example
 ```ts
 firstItem(['a']);
 // => 'a'
 ```
 */
export function firstItem(value: unknown,): unknown {
  return Array.isArray(value,) ? (value as readonly unknown[])[0] : undefined;
}

/**
 Narrows an untrusted value to an array of strings.

 @param value - Parsed value.

 @returns Whether every element is a string.

 @example
 ```ts
 isStringArray(['a', 'b']);
 // => true
 ```
 */
export function isStringArray(value: unknown,): value is readonly string[] {
  return Array.isArray(value,) && (value as readonly unknown[]).every(function isString(item,) {
    return (typeof item) === 'string';
  },);
}

//endregion Untrusted JSON narrowing
