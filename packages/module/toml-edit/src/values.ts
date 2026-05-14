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
import type {
  CanonicalOptions,
  TomlWrappedInput,
} from './types.ts';

/**
 * Encode a JS value as TOML text suitable for assignment after `=`.
 *
 * When `existing` is provided and the new value matches its parsed value,
 * `style` / `multiline` / raw `number` / `datetime` spelling are preserved.
 *
 * @throws TomlTypeError for `null`, `undefined`, symbols, functions, or
 *         circular structures.
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
  return encodeValue({ input, options, existing, depth: 0, },);
}

/** Encode an arbitrary JS value as TOML text, recursively. */
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
  if (input === null || input === undefined)
    throw new TomlTypeError(
      `Cannot encode ${String(input,)} as TOML; use tomlDelete to remove a key`,
    );

  if (isWrappedInput(input,))
    return encodeWrapped({ wrapped: input, },);

  if (typeof input === 'string')
    return encodeString({ value: input, existing, },);

  if (typeof input === 'boolean')
    return input ? 'true' : 'false';

  if (typeof input === 'bigint')
    return input.toString();

  if (typeof input === 'number')
    return encodeNumber({ value: input, existing, },);

  if (input instanceof Date)
    return input.toISOString();

  if (Array.isArray(input,))
    return encodeArray({ input, options, depth, existing, },);

  if (isPlainObject(input,))
    return encodeInlineTable({ input, options, depth, },);

  throw new TomlTypeError(`Cannot encode ${typeof input} as TOML`,);
}

/** Encode a tagged wrapper input (`tomlInteger`, `tomlFloat`, date kinds). */
function encodeWrapped(
  { wrapped, }: { wrapped: TomlWrappedInput; },
): string {
  if (wrapped.tomlKind === 'integer')
    return typeof wrapped.value === 'bigint'
      ? wrapped.value.toString()
      : String(wrapped.value,);
  if (wrapped.tomlKind === 'float') {
    const n = Number(wrapped.value,);
    if (!Number.isFinite(n,)) {
      if (Number.isNaN(n,)) return 'nan';
      return n > 0 ? 'inf' : '-inf';
    }
    const s = String(n,);
    return s.includes('.') || s.includes('e') || s.includes('E') ? s : `${s}.0`;
  }
  return String(wrapped.value,);
}

/** Encode a JS string, preserving existing quote style if equal-valued. */
function encodeString(
  { value, existing, }: { value: string; existing: AST.TOMLContentNode | undefined; },
): string {
  if (
    existing !== undefined
    && existing.type === 'TOMLValue'
    && existing.kind === 'string'
    && existing.value === value
  )
    return encodeStringWithStyle({
      value,
      style: existing.style,
      multiline: existing.multiline,
    },);
  const hasNewline = value.includes('\n',);
  if (hasNewline)
    return encodeStringWithStyle({ value, style: 'basic', multiline: true, },);
  return encodeStringWithStyle({ value, style: 'basic', multiline: false, },);
}

/** Encode a string with explicit `style` and `multiline` choices. */
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
    if (multiline) return `'''\n${value}'''`;
    return `'${value}'`;
  }
  const escaped = value
    .replaceAll('\\', '\\\\',)
    .replaceAll('"', '\\"',)
    .replaceAll('\t', '\\t',)
    .replaceAll('\b', '\\b',)
    .replaceAll('\f', '\\f',);
  if (multiline) {
    const escapedKeepNewlines = escaped.replaceAll('\r', '\\r',);
    return `"""\n${escapedKeepNewlines}"""`;
  }
  return `"${escaped.replaceAll('\n', '\\n',).replaceAll('\r', '\\r',)}"`;
}

/** Encode a JS number, preserving existing raw spelling when value is unchanged. */
function encodeNumber(
  { value, existing, }: { value: number; existing: AST.TOMLContentNode | undefined; },
): string {
  if (
    existing !== undefined
    && existing.type === 'TOMLValue'
    && (existing.kind === 'integer' || existing.kind === 'float')
    && existing.value === value
  )
    return existing.number;
  if (!Number.isFinite(value,)) {
    if (Number.isNaN(value,)) return 'nan';
    return value > 0 ? 'inf' : '-inf';
  }
  if (Number.isInteger(value,) && Number.isSafeInteger(value,))
    return String(value,);
  return String(value,);
}

/** Encode a JS array, recursing on elements; inline or multiline per options. */
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
  const elementExistings = existing !== undefined && existing.type === 'TOMLArray'
    ? existing.elements
    : null;
  const encoded = input.map(function each(el, i,) {
    return encodeValue({
      input: el,
      options,
      existing: elementExistings === null ? undefined : elementExistings[i],
      depth: depth + 1,
    },);
  },);
  const inlineCandidate = `[ ${encoded.join(', ',)}${encoded.length === 0 ? '' : ', '}]`;
  if (
    encoded.length <= options.arrayInlineThreshold
    && inlineCandidate.length <= options.arrayInlineMaxColumns
  )
    return inlineCandidate;
  const indent = ' '.repeat(options.indent * (depth + 1),);
  const closingIndent = ' '.repeat(options.indent * depth,);
  return `[\n${encoded.map(function withIndent(e,) {
    return `${indent}${e},`;
  },).join('\n',)}\n${closingIndent}]`;
}

/** Encode a JS plain object as a TOML inline table `{ k = v, ... }`. */
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
  const entries = Object.entries(input,);
  const parts = entries.map(function each([k, v,],) {
    return `${encodeKey({ key: k, },)} = ${
      encodeValue({ input: v, options, existing: undefined, depth: depth + 1, },)
    }`;
  },);
  return `{ ${parts.join(', ',)}${parts.length === 0 ? '' : ', '}}`;
}

/**
 * Encode a key string. Bare when matches `[A-Za-z0-9_-]+`, basic-quoted
 * otherwise.
 */
export function encodeKey({ key, }: { key: string; },): string {
  if (/^[A-Za-z0-9_-]+$/.test(key,) && key.length > 0)
    return key;
  return `"${key.replaceAll('\\', '\\\\',).replaceAll('"', '\\"',)}"`;
}

/** Type guard for tagged wrapper inputs produced by `wrappers.ts`. */
function isWrappedInput(value: unknown,): value is TomlWrappedInput {
  return (
    typeof value === 'object'
    && value !== null
    && 'tomlKind' in value
    && typeof (value as { tomlKind: unknown; }).tomlKind === 'string'
  );
}

/** Type guard for plain object literals (proto is `Object.prototype` or `null`). */
export function isPlainObject(value: unknown,): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value,);
  return proto === Object.prototype || proto === null;
}
