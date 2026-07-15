/**
 * Best-effort structural diagnostics for the `valid-types` rule.
 *
 * Replaces the verbatim `@microsoft/tsdoc` parser-error feed with a small,
 * conservative set of line-local structural checks: a `@param`/`@typeParam`
 * tag missing its hyphen separator, an unclosed inline tag, and an empty
 * inline tag. Checks stay scoped so they do not double-report problems other
 * rules already cover (`check-tag-names`, `no-types`).
 *
 * @module
 */

import type { Comment, } from '@oxlint/plugins';
import type { ReadonlyDeep, } from 'type-fest';

import {
  leadingTag,
  normalizeLines,
  stripInlineCodeAndEscapes,
  tokenEnd,
  wordRunEnd,
} from './comment-text.ts';
import type { TsdocMessage, } from './tsdoc-doc-model.ts';

/**
 * Marker for a `@param`/`@typeParam` block whose description is not preceded
 * by a hyphen separator.
 */
const PARAM_MISSING_HYPHEN: TsdocMessage = {
  messageId: 'tsdoc-param-tag-missing-hyphen',
  unformattedText: 'The @param block should be followed by a parameter name and then a hyphen',
};

/**
 * Marker for an inline tag that is never closed with `}`.
 */
const INLINE_TAG_MISSING_RIGHT_BRACE: TsdocMessage = {
  messageId: 'tsdoc-inline-tag-missing-right-brace',
  unformattedText: 'Expecting a "}" to close the inline tag',
};

/**
 * Marker for an inline link tag with no declaration reference.
 */
const LINK_TAG_EMPTY: TsdocMessage = {
  messageId: 'tsdoc-link-tag-empty',
  unformattedText: 'The {@link} tag content is missing a declaration reference',
};

/**
 * Reports a `@param`/`@typeParam` line whose description lacks the hyphen
 * separator. A name-only tag (no description) is left to
 * `require-param-description`, not flagged here.
 *
 * @param stripped - normalized line with inline code and escapes removed
 *
 * @returns zero or one {@link PARAM_MISSING_HYPHEN} message
 */
function missingHyphenMessages(stripped: string,): readonly TsdocMessage[] {
  /**
   * Leading tag of the line; only param-style tags carry a hyphen separator.
   */
  const tag = leadingTag(stripped,);
  if ((tag !== '@param') && (tag !== '@typeParam'))
    return [];
  /**
   * Text after the tag, with the parameter name still attached.
   */
  const remainder = stripped.slice(tag.length,)
    .trimStart();
  /**
   * Exclusive end of the parameter-name token.
   */
  const nameEnd = tokenEnd({
    text: remainder,
    start: 0,
  },);
  /**
   * Text after the name, where the hyphen separator is expected.
   */
  const afterName = remainder.slice(nameEnd,)
    .trimStart();
  if (afterName.length === 0)
    return [];
  if (afterName.startsWith('-',))
    return [];
  return [PARAM_MISSING_HYPHEN,];
}

/**
 * Reports inline-tag brace problems on a line: an unclosed `{@...`
 * ({@link INLINE_TAG_MISSING_RIGHT_BRACE}) or an empty `{@tag}` with no
 * target ({@link LINK_TAG_EMPTY}). Scoped to `{@...}` inline tags so
 * JSDoc-style curly type annotations stay the domain of `no-types`.
 *
 * @param stripped - normalized line with inline code and escapes removed
 *
 * @returns inline-tag diagnostics found on the line
 */
function inlineTagMessages(stripped: string,): readonly TsdocMessage[] {
  /**
   * Inline-tag diagnostics accumulated as the line is scanned left to right.
   */
  const out: TsdocMessage[] = [];
  for (let from = 0; from < stripped
    .length;) {
    /**
     * Start of the next inline tag (`{@`); -1 ends the scan.
     */
    const open = stripped.indexOf(
      '{@',
      from,
    );
    if (open === (-1))
      break;
    /**
     * Position of the closing brace; -1 means the inline tag is unclosed.
     */
    const close = stripped.indexOf(
      '}',
      open + 2,
    );
    if (close === (-1)) {
      out.push(INLINE_TAG_MISSING_RIGHT_BRACE,);
      break;
    }
    /**
     * Text between `{@` and `}`: the tag word and its optional target.
     */
    const inner = stripped.slice(
      open + 2,
      close,
    );
    /**
     * Reference text after the tag word; empty means the link has no target.
     */
    const target = inner.slice(wordRunEnd({
      text: inner,
      start: 0,
    },),)
      .trim();
    if (target.length === 0)
      out.push(LINK_TAG_EMPTY,);
    from = close + 1;
  }
  return out;
}

/**
 * Scans a TSDoc comment for best-effort structural problems, combining
 * {@link missingHyphenMessages} and {@link inlineTagMessages} per line.
 *
 * @param comment - block comment AST node to scan
 *
 * @returns structural diagnostics consumed by the `valid-types` rule
 *
 * @example
 * ```ts
 * const messages = collectStructuralMessages({ comment });
 * for (const message of messages) {
 *   context.report({ messageId: 'parseError', data: { message: message.unformattedText } });
 * }
 * ```
 */
export function collectStructuralMessages({
  comment,
}: {
  /**
   * Block comment whose body is scanned.
   */
  readonly comment: ReadonlyDeep<Comment>;
},): readonly TsdocMessage[] {
  return normalizeLines({ comment, },)
    .flatMap(function lineMessages(line,): readonly TsdocMessage[] {
      if (line.inFence)
        return [];
      /**
       * Line with inline code and escaped at signs removed before scanning.
       */
      const stripped = stripInlineCodeAndEscapes(line.text,);
      return [
        ...missingHyphenMessages(stripped,),
        ...inlineTagMessages(stripped,),
      ];
    },);
}
