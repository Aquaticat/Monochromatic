/**
 Value kinds and one-line renders for the failure difference walker in
 `value-difference.ts`.

 A "role" is how the differ compares two values of one kind:
 text by lines,
 ordered lists and typed buffers copy-for-copy with order,
 unordered collections copy-for-copy without order,
 records key by key,
 and leaves by identity or scalar equality.
 Kinds outside their role's reach render as leaves.

 @module
 */

//region Value kinds

/**
 The display kind of a value, matching how chai's deep equality groups it:
 boxed primitives keep their box kind,
 class instances read as `Object` since chai ignores constructor identity,
 and errors get their own kind since chai compares their message.

 @param value - value read

 @returns Kind label such as `Array`,
   `Uint8Array`,
   `Object`,
   or `number`

 @mutates value - Tag reads may invoke `Symbol.toStringTag` getters or proxy traps.

 @example
 ```ts
 valueKind([1,]);    // 'Array'
 valueKind(new Map(,),); // 'Map'
 ```
 */
export function valueKind(value: unknown,): string {
  if (value === null)
    return 'null';
  const valueType = typeof value;
  if (valueType !== 'object')
    return valueType;
  return Object.prototype.toString
    .call(value,)
    .slice(8, -1,);
}

/**
 How the differ walks two values of the same kind.
 `text` splits into lines,
 `ordered` compares entries copy-for-copy with order,
 `unordered` compares entries copy-for-copy without order,
 `record` compares keys,
 and `leaf` renders both values on one line.

 @param value - value read

 @returns Role name for the value's kind

 @example
 ```ts
 valueRole(new Set([1,],),); // 'unordered'
 ```
 */
export function valueRole(value: unknown,): 'text' | 'ordered' | 'unordered' | 'record' | 'leaf' {
  const kind = valueKind(value,);
  if (kind === 'string')
    return 'text';
  if ((kind === 'Array') || (kind === 'Arguments'))
    return 'ordered';
  if ((kind === 'ArrayBuffer') || (kind === 'DataView') || kind.endsWith('Array',))
    return 'ordered';
  if ((kind === 'Map') || (kind === 'Set'))
    return 'unordered';
  if (kind === 'Object')
    return 'record';
  return 'leaf';
}

//endregion Value kinds

//region One-line value render

/**
 Renders one value on a single line,
 never throwing and never containing a line break,
 so one difference stays one log line.

 Strings quote and escape,
 zero keeps its sign,
 cycles mark `[Circular]`,
 and a getter that throws renders `[unrepresentable]`.

 @param value - value to render

 @returns Single-line rendering

 @mutates value - Rendering may invoke getters, proxy traps, `Symbol.toPrimitive`, `toString`, or `valueOf`.

 @example
 ```ts
 renderValue({ naps: 2, },); // '{ naps: 2 }'
 renderValue('a\nb',);       // '"a\\nb"'
 ```
 */
export function renderValue(value: unknown,): string {
  return renderValueInner({
    value,
    open: [],
  },);
}

/**
 Recursive worker behind {@link renderValue},
 carrying the container stack so a self-referential value marks its cycle
 instead of recursing forever.

 @param value - value to render

 @param open - containers still being rendered above this value

 @returns Single-line rendering

 @mutates value - Rendering may invoke getters, proxy traps, `Symbol.toPrimitive`, `toString`, or `valueOf`.
 */
function renderValueInner({
  value,
  open,
}: {
  readonly value: unknown;
  readonly open: readonly unknown[];
},): string {
  if (value === null)
    return 'null';
  const valueType = typeof value;
  if (valueType === 'string')
    return JSON.stringify(value,);
  if (valueType === 'number')
    return numberText(value,);
  if (valueType === 'bigint')
    return `${value.toString()}n`;
  if (valueType === 'symbol')
    return String(value,);
  if (valueType === 'function')
    return functionText(value,);
  if (valueType !== 'object')
    return String(value,);
  if (open.includes(value,))
    return '[Circular]';
  const kind = valueKind(value,);
  const nested = [
    ...open,
    value,
  ];
  if (kind === 'Array')
    return listText({
      entries: value as readonly unknown[],
      open: nested,
    },);
  if (kind === 'Arguments')
    return `Arguments${listText({
      entries: Array.from(value as ArrayLike<unknown>,),
      open: nested,
    },)}`;
  if ((kind === 'ArrayBuffer') || (kind === 'DataView') || kind.endsWith('Array',))
    return `${kind}${listText({
      entries: Array.from(value as ArrayLike<unknown>,),
      open: nested,
    },)}`;
  if (kind === 'Map')
    return mapText({
      entries: value as ReadonlyMap<unknown, unknown>,
      open: nested,
    },);
  if (kind === 'Set')
    return `Set${listText({
      entries: [...(value as ReadonlySet<unknown>,),],
      open: nested,
    },)}`;
  if (kind === 'Date')
    return dateText(value as Date,);
  if (kind === 'RegExp')
    return String(value,);
  if (kind === 'Error')
    return errorText(value as Error,);
  if (Error.isError(value,))
    return errorText(value,);
  if ((kind === 'String') || (kind === 'Number') || (kind === 'Boolean'))
    return boxedText({
      kind,
      value,
    },);
  if ((kind === 'Promise') || (kind === 'WeakMap') || (kind === 'WeakSet'))
    return `[${kind}]`;
  return recordText({
    value,
    open: nested,
  },);
}

/**
 Renders a number,
 keeping the sign of zero and naming the non-finite spellings so `+0`
 against `-0` and `NaN` against `1` read apart.

 @param value - number to render

 @returns Number text

 @example
 ```ts
 numberText(-0,); // '-0'
 ```
 */
function numberText(value: number,): string {
  if (Object.is(value, -0,))
    return '-0';
  if (value === 0)
    return '+0';
  return String(value,);
}

/**
 Renders a function by name so two named functions with one body read apart
 from one anonymous function.

 @param value - function to render

 @returns `[Function: name]` or `[Function]`

 @mutates value - Reading `.name` may invoke a getter or proxy trap.
 */
function functionText(value: (...args: never[]) => unknown,): string {
  return value.name
    ? `[Function: ${value.name}]`
    : '[Function]';
}

/**
 Renders a list body as `[ a, b ]`,
 quoting each entry through {@link renderValueInner}.

 @param entries - entries to render

 @param open - containers still being rendered above the entries

 @returns Bracketed entry list

 @mutates entries - Entry rendering may invoke getters, proxy traps, `Symbol.toPrimitive`, `toString`, or `valueOf`.
 */
function listText({
  entries,
  open,
}: {
  readonly entries: readonly unknown[];
  readonly open: readonly unknown[];
},): string {
  const parts: string[] = [];
  for (const entry of entries) {
    parts.push(renderValueInner({
      value: entry,
      open,
    },),);
  }
  return `[ ${parts.join(', ',)} ]`;
}

/**
 Renders a map as `Map{ k => v }`,
 entry by entry through {@link renderValueInner}.

 @param entries - map to render

 @param open - containers still being rendered above the entries

 @returns Map rendering

 @mutates entries - Entry rendering may invoke getters, proxy traps, `Symbol.toPrimitive`, `toString`, or `valueOf`.
 */
function mapText({
  entries,
  open,
}: {
  readonly entries: ReadonlyMap<unknown, unknown>;
  readonly open: readonly unknown[];
},): string {
  const parts: string[] = [];
  for (const [key, entryValue] of entries) {
    parts.push(`${renderValueInner({
      value: key,
      open,
    },)} => ${renderValueInner({
      value: entryValue,
      open,
    },)}`);
  }
  return `Map{ ${parts.join(', ',)} }`;
}

/**
 Renders a date by its ISO text,
 naming `Invalid Date` where no time exists.

 @param value - date to render

 @returns Date rendering

 @mutates value - `toJSON` may invoke a user hook.
 */
function dateText(value: Date,): string {
  const json = value.toJSON();
  return json === null
    ? 'Invalid Date'
    : json;
}

/**
 Renders an error as `Name: message` so two errors differing only in message
 read apart on one line.

 @param value - error to render

 @returns Error rendering

 @mutates value - Reading `.name` and `.message` may invoke getters or proxy traps.
 */
function errorText(value: Error,): string {
  return `${value.name}: ${value.message}`;
}

/**
 Renders a boxed primitive as `[String: 'a']` so a box reads apart from the
 primitive it holds.

 @param kind - box kind name

 @param value - boxed value

 @returns Boxed rendering

 @mutates value - `valueOf` may invoke a user hook.
 */
function boxedText({
  kind,
  value,
}: {
  readonly kind: string;
  readonly value: object;
},): string {
  return `[${kind}: ${renderValueInner({
    value: (value as { valueOf(): unknown; }).valueOf(),
    open: [],
  },)}]`;
}

/**
 Renders a record as `{ k: v }` over its own enumerable string and symbol
 keys,
 matching which keys chai's deep equality reads.

 @param value - record to render

 @param open - containers still being rendered above the record

 @returns Record rendering

 @mutates value - Key reads may invoke getters or proxy traps.
 */
function recordText({
  value,
  open,
}: {
  readonly value: object;
  readonly open: readonly unknown[];
},): string {
  const parts: string[] = [];
  for (const key of enumerableKeys(value,)) {
    parts.push(`${renderValueInner({
      value: key,
      open,
    },)}: ${renderValueInner({
      value: Reflect.get(value, key,),
      open,
    },)}`);
  }
  return `{ ${parts.join(', ',)} }`;
}

/**
 The own enumerable string and symbol keys of a record,
 in the order chai's deep equality compares them.

 @param value - record to read

 @returns Own enumerable keys

 @mutates value - `Reflect.ownKeys` and the enumerability read may invoke proxy traps.
 */
export function enumerableKeys(value: object,): (string | symbol)[] {
  const keys: (string | symbol)[] = [];
  for (const key of Reflect.ownKeys(value,)) {
    if ((typeof key === 'string') || ((typeof key === 'symbol') && Object.prototype.propertyIsEnumerable.call(value, key,)))
      keys.push(key,);
    else if (typeof key === 'string')
      keys.push(key,);
  }
  return keys;
}

//endregion One-line value render

//region Side summary for kind mismatches

/**
 Describes one side of a kind mismatch.
 Scalars render whole since they are small by nature;
 containers name their kind and size so a large container never floods a line
 that already answers how the kinds differ.

 @param value - mismatched side

 @returns Side description

 @mutates value - Kind and size reads may invoke getters or proxy traps.

 @example
 ```ts
 describeSide([1, 2,],); // 'Array of 2 items'
 describeSide(3,);       // '3'
 ```
 */
export function describeSide(value: unknown,): string {
  const kind = valueKind(value,);
  if ((kind === 'Array') || (kind === 'Arguments'))
    return `${kind} of ${(value as ArrayLike<unknown>,).length} items`;
  if ((kind === 'ArrayBuffer') || (kind === 'DataView') || kind.endsWith('Array',))
    return `${kind} of ${(value as ArrayLike<unknown>,).length} items`;
  if ((kind === 'Map') || (kind === 'Set'))
    return `${kind} of ${(value as { size: number; },).size} entries`;
  if (kind === 'Object')
    return `Object with ${enumerableKeys(value as object,).length} keys`;
  if (kind === 'string')
    return `String of ${(value as string,).length} characters`;
  return renderValue(value,);
}

//endregion Side summary for kind mismatches
