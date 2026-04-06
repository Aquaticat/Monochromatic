/**
 * Dispatch indirection for the mutually recursive JSONC parser.
 *
 * The value dispatcher, array core, and record core form a mutual recursion cycle.
 * This module breaks the cycle by holding a late-bound reference to `parseValueFromStart`
 * that array/record cores call through. The reference is set once at module initialization
 * by the parseValue module, before any parsing occurs.
 */

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';

/** Signature of the value dispatcher function. */
type ParseValueFn = (
  args: {
    value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase;
  },
) => {
  parsed: Jsonc.Value;
  remaining: FragmentStringJsonc;
};

/** Late-bound reference, set once before any parsing call. */
// Intentional let: configured once during module initialization by the parseValue module
// oxlint-disable-next-line prefer-const
// oxlint-disable-next-line eslint/init-declarations -- configured once during module initialization
let ref: ParseValueFn;

/**
 * Register the `parseValueFromStart` implementation.
 * Called once at module load by `customParsers.parseValue.ts`.
 *
 * @param fn - value dispatcher function
 *
 * @example
 * ```ts
 * registerParseValue(parseValueFromStart);
 * ```
 */
export function registerParseValue(fn: ParseValueFn,): void {
  ref = fn;
}

/**
 * Dispatch a parse-value call through the late-bound reference.
 * Used by array and record core parsers to avoid circular imports.
 *
 * @param args - value fragment and optional context
 *
 * @returns parsed value node and remaining fragment
 *
 * @example
 * ```ts
 * const { parsed, remaining } = callParseValue({ value: '42, 3]' as FragmentStringJsonc });
 * // parsed.value === 42
 * // remaining === ', 3]'
 * ```
 */
export function callParseValue(
  args: {
    value: FragmentStringJsonc | StringJsonc;
    context?: Jsonc.ValueBase;
  },
): {
  parsed: Jsonc.Value;
  remaining: FragmentStringJsonc;
} {
  return ref(args,);
}
