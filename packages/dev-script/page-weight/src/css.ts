/**
 * CSS asset reference extraction.
 *
 * Scans CSS source for `url(...)` references using the CSS Syntax Level 3
 * tokenizer from `@csstools/css-tokenizer`. The tokenizer is used directly
 * (rather than a full AST parser) because the only structure we need is
 * the flat list of URLs the stylesheet references.
 */
import {
  type CSSToken,
  isTokenAtKeyword,
  isTokenFunction,
  isTokenString,
  isTokenURL,
  isTokenWhiteSpaceOrComment,
  type TokenAtKeyword,
  type TokenFunction,
  tokenize,
  type TokenString,
  type TokenURL,
} from '@csstools/css-tokenizer';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import { startsWithUriScheme, } from './url-detect.ts';

/**
 * Tuple index of the "extra data" field in a CSS token.
 *
 * The tokenizer uses a tuple shape `[type, raw, start, end, data]`; index `4`
 * is the structured payload (e.g. `{ value: string }` for URL/String/Function
 * tokens). Exposing it as a named constant avoids repeated magic-number use.
 */
const TOKEN_DATA_INDEX = 4;

/**
 * Reads the structured `value` payload from a URL / String / Function /
 * AtKeyword token.
 *
 * @param token - tokenizer output tuple
 *
 * @returns the token's unescaped string payload
 */
function tokenValue(
  token: TokenURL | TokenString | TokenFunction | TokenAtKeyword,
): string {
  return token[TOKEN_DATA_INDEX]
    .value;
}

/**
 * Adds a URL reference to the output set if it is local (not external).
 *
 * External forms filtered:
 * - absolute URLs with scheme (`http:`, `https:`, `ftp:`, `data:`, ...)
 * - protocol-relative (`//cdn.example.com/...`)
 * - fragment-only (`#id`)
 * - empty string
 *
 * @param target - set receiving accepted references
 *
 * @param raw - URL string as it appeared in CSS
 */
function addIfLocal(
  {
    target,
    raw,
  }: {
    target: Set<string>;
    raw: string;
  },
): void {
  /** URL with surrounding whitespace removed; raw CSS values often carry stray padding. */
  const trimmed = raw.trim();
  if ((trimmed === '') || trimmed
    .startsWith('#',))
    return;
  if (trimmed.startsWith('//',)
    || startsWithUriScheme(trimmed,))
    return;
  target.add(trimmed,);
}

/**
 * Returns the next token that is not whitespace or a comment, or `null` if none.
 *
 * @param tokens - full token array from the tokenizer
 *
 * @param startIndex - index to begin scanning from (inclusive)
 *
 * @returns next semantic token, or `null` past the end
 */
function nextSemanticToken(
  {
    tokens,
    startIndex,
  }: {
    tokens: readonly CSSToken[];
    startIndex: number;
  },
): CSSToken | null {
  for (let index = startIndex; index < tokens
    .length; index += 1) {
    /** Current token under inspection; skipped if it carries no semantic content. */
    const token = nonNullishOrThrow(tokens[index],);
    if (!isTokenWhiteSpaceOrComment(token,))
      return token;
  }
  return null;
}

/**
 * Extracts every `url(...)` reference from a CSS source string.
 *
 * Handles both forms the tokenizer recognises:
 * - `url(path)` / `url("path")` / `url('path')`: tokenised as a single `Url` token
 * - `url("path")` with whitespace or escapes; tokenised as `Function(url)` followed
 *   by a `String` token and then a `CloseParen`
 *
 * `@import` URLs emit a bare `String` token preceded by `@import`; those are
 * also captured so imported stylesheets get walked.
 *
 * External references (`http://`, `https://`, `//`, `data:`) and fragment-only
 * references (`#anchor`) are filtered out since they don't contribute to
 * local transfer weight.
 *
 * @param source - raw CSS text
 *
 * @returns unique asset reference strings as they appeared in the source
 *
 * @example
 * ```ts
 * extractCssUrls(`@font-face { src: url('../inter.woff2'); }`);
 * // ['../inter.woff2']
 * ```
 */
export function extractCssUrls(source: string,): string[] {
  /** Full token stream produced by the CSS tokenizer; walked once below. */
  const tokens: CSSToken[] = tokenize({ css: source, },);
  /** Output set; deduplicates references seen multiple times across the stylesheet. */
  const refs = new Set<string>();

  for (let index = 0; index < tokens
    .length; index += 1) {
    /** Current token in the linear scan; dispatch below depends on its kind. */
    const token = nonNullishOrThrow(tokens[index],);
    if (isTokenURL(token,)) {
      addIfLocal({
        target: refs,
        raw: tokenValue(token,),
      },);
      continue;
    }
    if (isTokenFunction(token,)) {
      if (tokenValue(token,)
        .toLowerCase()
        !== 'url')
        continue;
      /** First semantic token after `url(`; expected to be the quoted URL string. */
      const next = nextSemanticToken({
        tokens,
        startIndex: index + 1,
      },);
      if ((next !== null) && isTokenString(next,)) {
        addIfLocal({
          target: refs,
          raw: tokenValue(next,),
        },);
      }
      continue;
    }
    if (isTokenAtKeyword(token,)) {
      if (tokenValue(token,)
        .toLowerCase()
        !== 'import')
        continue;
      /**
       * First semantic token after `@import`; expected to be the imported stylesheet URL.
       */
      const next = nextSemanticToken({
        tokens,
        startIndex: index + 1,
      },);
      if ((next !== null) && isTokenString(next,)) {
        addIfLocal({
          target: refs,
          raw: tokenValue(next,),
        },);
      }
    }
  }

  return [...refs,];
}
