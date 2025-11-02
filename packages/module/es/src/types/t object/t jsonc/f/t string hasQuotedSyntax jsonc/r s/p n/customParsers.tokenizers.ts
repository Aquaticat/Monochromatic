import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';

//region Value tokenizers -- Pure helpers for literals and numbers with explicit contracts
/**
 * Sentinel indicating no JSON literal was matched at the current start position.
 *
 * @remarks
 * Narrow by category first using `typeof out === 'symbol'` before identity comparison to avoid incorrect
 * narrowing with symbol unions. See {@link parseLiteralToken}.
 *
 * @example
 * ```ts
 * const out = parseLiteralToken({ value: 'x' as FragmentStringJsonc });
 * if (typeof out !== 'symbol') {
 *   // literal branch
 * } else if (out === NO_LITERAL) {
 *   // non-match sentinel
 * } else {
 *   throw new Error('unexpected symbol sentinel');
 * }
 * ```
 */
export const NO_LITERAL: symbol = Symbol('jsonc:parseLiteralToken:no-match',);
/**
 * Parse JSON literal at the current position.
 * Supports: `null`, `true`, `false`.
 *
 * @remarks
 * Returns {@link NO_LITERAL} when no literal matched; handle using category-first symbol narrowing.
 *
 * @param value - Input fragment to parse from the start
 * @returns Parsed literal token with remaining fragment, or {@link NO_LITERAL} when no literal matched
 * @example
 * ```ts
 * parseLiteralToken({ value: 'null,1' as FragmentStringJsonc })
 * // → { consumed: 'null', parsed: { value: null }, remaining: ',1' }
 * ```
 */
export function parseLiteralToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
):
  | { consumed: FragmentStringJsonc; parsed: Jsonc.Boolean | Jsonc.Null;
    remaining: FragmentStringJsonc; }
  | typeof NO_LITERAL
{
  if (value.startsWith('null',)) {
    return { consumed: 'null' as FragmentStringJsonc, parsed: { value: null, },
      remaining: value.slice(4,) as FragmentStringJsonc, };
  }
  if (value.startsWith('true',)) {
    return { consumed: 'true' as FragmentStringJsonc, parsed: { value: true, },
      remaining: value.slice(4,) as FragmentStringJsonc, };
  }
  if (value.startsWith('false',)) {
    return { consumed: 'false' as FragmentStringJsonc, parsed: { value: false, },
      remaining: value.slice(5,) as FragmentStringJsonc, };
  }
  return NO_LITERAL;
}

/**
 * Parse a JSON number token from the start using a single-pass regex and JSON numeric semantics.
 * The regex matches the JSON number grammar and returns the longest valid numeric prefix.
 *
 * @param value - Input fragment starting at a potential number token
 * @returns Consumed span, parsed number node, and remaining fragment after the number
 * @throws Error - When the start does not match a valid JSON number grammar
 * @example
 * ```ts
 * parseNumberToken({ value: '-12.3e+4, x' as FragmentStringJsonc })
 * // → { consumed: '-12.3e+4', parsed: { value: -123000 }, remaining: ', x' }
 * ```
 */
export function parseNumberToken(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
): { consumed: FragmentStringJsonc; parsed: Jsonc.Number;
  remaining: FragmentStringJsonc; }
{
  /**
   * JSON number grammar (no leading +, leading 0 rules, optional fraction and exponent).
   * Matches the longest valid numeric prefix at position 0.
   */
  const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[Ee][+-]?\d+)?/;
  /** Regex match result for numeric token anchored at start. */
  const match = NUMBER_RE.exec(value,);
  if (!match || match.index !== 0)
    throw new Error('malformed jsonc, non-number after number marker',);
  /** Span consumed for the number token (kept as fragment for immutability). */
  const consumed = match[0] as FragmentStringJsonc;
  /** Exact numeric semantics via JSON.parse; avoids manual float/exp handling. */
  const parsedValue = JSON.parse(consumed,) as number;
  return { consumed, parsed: { value: parsedValue, },
    remaining: value.slice(consumed.length,) as FragmentStringJsonc, };
}
//endregion Value tokenizers
