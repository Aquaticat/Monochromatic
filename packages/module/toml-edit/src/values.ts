/**
 * JS-to-TOML value coercion.
 *
 * Produces canonical TOML text for an arbitrary JS value. Optionally
 * preserves style and raw spelling from an existing AST node when the new
 * numeric / string value equals the parse-time value.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import { TomlTypeError, } from './errors.ts';
import { encodeKey, } from './keys.ts';
import type {
  CanonicalOptions,
  TomlWrappedInput,
} from './types.ts';
export { encodeKey, } from './keys.ts';

/**
 * Encode a JS value as TOML text suitable for assignment after `=`.
 *
 * When `existing` is provided and the new value matches its parsed value,
 * `style` / `multiline` / raw `number` / `datetime` spelling are preserved.
 *
 * @returns Computed string.
 *
 * @throws TomlTypeError for `null`, `undefined`, symbols, functions, or
 *         circular structures.
 *
 * @example
 * ```ts
 * jsValueToTomlText({ input: 42, options, },);              // '42'
 * jsValueToTomlText({ input: 'hi', options, },);            // '"hi"'
 * jsValueToTomlText({ input: { a: 1, }, options, },);       // '{ a = 1, }'
 * ```
 */
export function jsValueToTomlText(
  {
    input,
    options,
    existing,
  }: {
    input: unknown;
    options: CanonicalOptions;
    existing?: AST.TOMLContentNode | undefined;
  },
): string {
  return encodeValue({
    input,
    options,
    existing,
    depth: 0,
  },);
}

/**
 * Encode an arbitrary JS value as TOML text, recursively.
 *
 * @returns Computed string.
 */
function encodeValue(
  {
    input,
    options,
    existing,
    depth,
  }: {
    input: unknown;
    options: CanonicalOptions;
    existing: AST.TOMLContentNode | undefined;
    depth: number;
  },
): string {
  if ((input === null) || (input === undefined)) {
    throw new TomlTypeError(
      `Cannot encode ${String(input,)} as TOML; use tomlDelete to remove a key`,
    );
  }

  if (isWrappedInput(input,))
    return encodeWrapped({ wrapped: input, },);

  if ((typeof input) === 'string') {
    return encodeString({
      value: input,
      existing,
    },);
  }

  if ((typeof input) === 'boolean')
    return input ? 'true' : 'false';

  if ((typeof input) === 'bigint')
    return input.toString();

  if ((typeof input) === 'number') {
    return encodeNumber({
      value: input,
      existing,
    },);
  }

  if (input instanceof Date)
    return input.toISOString();

  if (Array.isArray(input,)) {
    return encodeArray({
      input,
      options,
      depth,
      existing,
    },);
  }

  if (isPlainObject(input,)) {
    return encodeInlineTable({
      input,
      options,
      depth,
    },);
  }

  throw new TomlTypeError(`Cannot encode ${typeof input} as TOML`,);
}

/**
 * Encode a tagged wrapper input (`tomlInteger`, `tomlFloat`, date kinds).
 *
 * @returns Computed string.
 */
function encodeWrapped(
  { wrapped, }: { wrapped: TomlWrappedInput; },
): string {
  if (wrapped.tomlKind
    === 'integer') {
    return (typeof wrapped.value) === 'bigint'
      ? wrapped.value
        .toString()
      : String(wrapped.value,);
  }
  if (wrapped.tomlKind
    === 'float') {
    /** Numeric form so finiteness and NaN can be checked. */
    const n = Number(wrapped.value,);
    if (!Number.isFinite(n,)) {
      if (Number.isNaN(n,))
        return 'nan';
      return n > 0 ? 'inf' : '-inf';
    }
    /** String form so the float-marker check can scan once. */
    const s = String(n,);
    return s.includes('.',)
      || s
      .includes('e',)
      || s
      .includes('E',) ? s : `${s}.0`;
  }
  return String(wrapped.value,);
}

/**
 * Encode a JS string, preserving existing quote style if equal-valued.
 *
 * @returns Computed string.
 */
function encodeString(
  {
    value,
    existing,
  }: {
    value: string;
    existing: AST.TOMLContentNode | undefined;
  },
): string {
  if (
    (existing !== undefined)
    && (existing.type === 'TOMLValue')
      && (existing.kind === 'string')
      && (existing.value === value)
  ) {
    return encodeStringWithStyle({
      value,
      style: existing.style,
      multiline: existing.multiline,
    },);
  }
  /** Multi-line content selects triple-quoted output to avoid splitting. */
  const hasNewline = value.includes('\n',);
  if (hasNewline) {
    return encodeStringWithStyle({
      value,
      style: 'basic',
      multiline: true,
    },);
  }
  return encodeStringWithStyle({
    value,
    style: 'basic',
    multiline: false,
  },);
}

/**
 * Encode a string with explicit `style` and `multiline` choices.
 *
 * @returns Computed string.
 */
function encodeStringWithStyle(
  {
    value,
    style,
    multiline,
  }: {
    value: string;
    style: 'basic' | 'literal';
    multiline: boolean;
  },
): string {
  if (style === 'literal') {
    if (multiline)
      return `'''\n${value}'''`;
    return `'${value}'`;
  }
  /** Backslash and control-char escapes shared by single- and multi-line basic strings. */
  const escaped = value
    .replaceAll(
      '\\',
      String.raw`\\`,
    )
    .replaceAll(
      '"',
      String.raw`\"`,
    )
    .replaceAll(
      '\t',
      String.raw`\t`,
    )
    .replaceAll(
      '\b',
      String.raw`\b`,
    )
    .replaceAll(
      '\f',
      String.raw`\f`,
    );
  if (multiline) {
    /** Newlines stay literal so the multi-line string preserves layout. */
    const escapedKeepNewlines = escaped.replaceAll(
      '\r',
      String.raw`\r`,
    );
    return `"""\n${escapedKeepNewlines}"""`;
  }
  return `"${
    escaped
      .replaceAll(
        '\n',
        String.raw`\n`,
      )
      .replaceAll(
        '\r',
        String.raw`\r`,
      )
  }"`;
}

/**
 * Encode a JS number, preserving existing raw spelling when value is unchanged.
 *
 * @returns Computed string.
 */
function encodeNumber(
  {
    value,
    existing,
  }: {
    value: number;
    existing: AST.TOMLContentNode | undefined;
  },
): string {
  if (
    (existing !== undefined)
    && (existing.type === 'TOMLValue')
      && ((existing.kind === 'integer') || (existing.kind === 'float'))
      && (existing.value === value)
  ) {
    return existing.number;
  }
  if (!Number.isFinite(value,)) {
    if (Number.isNaN(value,))
      return 'nan';
    return value > 0 ? 'inf' : '-inf';
  }
  if (Number.isInteger(value,)
    && Number
    .isSafeInteger(value,))
    return String(value,);
  return String(value,);
}

/**
 * Encode a JS array, recursing on elements; inline or multiline per options.
 *
 * @returns Computed string.
 */
function encodeArray(
  {
    input,
    options,
    depth,
    existing,
  }: {
    input: readonly unknown[];
    options: CanonicalOptions;
    depth: number;
    existing: AST.TOMLContentNode | undefined;
  },
): string {
  /** Existing per-element AST so encoder can reuse spelling when value matches. */
  const elementExistings = (existing !== undefined) && (existing.type
    === 'TOMLArray')
    ? existing.elements
    : null;
  /** Encoded element strings so the result can be both inline-tested and multi-line-emitted. */
  const encoded = input.map(function each(
    el,
    i,
  ) {
    return encodeValue({
      input: el,
      options,
      existing: elementExistings === null ? undefined : elementExistings[i],
      depth: depth + 1,
    },);
  },);
  /** Speculative inline form so the column budget check can decide the layout. */
  const inlineCandidate = `[ ${encoded.join(', ',)}${encoded.length
    === 0 ? '' : ', '}]`;
  if (
    (encoded.length
      <= options
      .arrayInlineThreshold)
    && (inlineCandidate.length
      <= options
      .arrayInlineMaxColumns)
  ) {
    return inlineCandidate;
  }
  /** Indent for each element when the array goes multi-line. */
  const indent = ' '.repeat(options.indent
    * (depth + 1),);
  /** Closing bracket sits at the parent's indent level for legibility. */
  const closingIndent = ' '.repeat(options.indent
    * depth,);
  return `[\n${
    encoded
      .map(function withIndent(e,) {
        return `${indent}${e},`;
      },)
      .join('\n',)
  }\n${closingIndent}]`;
}

/**
 * Encode a JS plain object as a TOML inline table `{ k = v, ... }`.
 *
 * @returns Computed string.
 */
function encodeInlineTable(
  {
    input,
    options,
    depth,
  }: {
    input: Record<string, unknown>;
    options: CanonicalOptions;
    depth: number;
  },
): string {
  /** Entries so iteration is keyed and ordering is deterministic. */
  const entries = Object.entries(input,);
  /** Each entry becomes its own `k = v` fragment so the joiner can comma-separate. */
  const parts = entries.map(function each([k, v,],) {
    return `${encodeKey({ key: k, },)} = ${
      encodeValue({
        input: v,
        options,
        existing: undefined,
        depth: depth + 1,
      },)
    }`;
  },);
  return `{ ${parts.join(', ',)}${parts.length
    === 0 ? '' : ', '}}`;
}

/**
 * Type guard for tagged wrapper inputs produced by `wrappers.ts`.
 *
 * @param value - Arbitrary JS value to test.
 *
 * @returns True when `value` is an object carrying a string `tomlKind` discriminant.
 */
function isWrappedInput(value: unknown,): value is TomlWrappedInput {
  return (
    ((typeof value) === 'object')
    && (value !== null)
      && ('tomlKind' in value)
      && ((typeof (value as { tomlKind: unknown; }).tomlKind) === 'string')
  );
}

/**
 * Type guard for plain object literals (proto is `Object.prototype` or `null`).
 *
 * @param value - Arbitrary JS value to test.
 *
 * @returns True when `value` is a plain object literal (excludes `Date`, class
 *          instances, `Map`, `Set`, etc.).
 *
 * @example
 * ```ts
 * isPlainObject({ a: 1, },);    // true
 * isPlainObject(new Date(),);   // false
 * isPlainObject([1, 2, 3,],);   // false (Array.prototype)
 * ```
 */
export function isPlainObject(value: unknown,): value is Record<string, unknown> {
  if (((typeof value) !== 'object') || (value === null))
    return false;
  /** Prototype lookup so class instances and built-ins are rejected. */
  const proto: unknown = Object.getPrototypeOf(value,);
  return (proto === Object
    .prototype) || (proto === null);
}
