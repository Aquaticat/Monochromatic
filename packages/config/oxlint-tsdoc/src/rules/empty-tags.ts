/**
 * TSDoc empty modifier tag validation rule.
 *
 * Extracted from `structural-tags.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  createTsdocVisitor,
  getCommentLines,
  stripCommentLineMarker,
} from './tsdoc-visitors.ts';

/**
 * Returns true when `c` is an ASCII word character (alphanumeric or `_`).
 *
 * @param c - candidate character
 *
 * @returns true when the character qualifies as `\w` in regex semantics
 */
function isWordChar(c: string,): boolean {
  return ((c >= '0') && (c <= '9'))
    || ((c >= 'a') && (c <= 'z'))
    || ((c >= 'A') && (c <= 'Z'))
    || (c === '_');
}

/**
 * Returns true when `c` is ASCII horizontal or vertical whitespace
 * (`\s` regex semantics).
 *
 * @param c - candidate character
 *
 * @returns true when the character is whitespace
 */
function isWhitespaceChar(c: string,): boolean {
  return (c === ' ')
    || (c === '\t')
    || (c === '\n')
    || (c === '\r')
    || (c === '\f')
    || (c === '\v');
}

/**
 * Parsed shape of a tagged TSDoc line; `null` when the line is not
 * `@tag <text>` form.
 */
type TaggedLine = {
  /** Captured tag including the leading at-sign. */
  tag: string;
  /** Content following the whitespace gap. */
  rest: string;
};

/**
 * Parses a TSDoc line of the form `@tag <whitespace> <rest>`.
 *
 * Linear scan over the leading `@word` run, the whitespace gap, and the
 * remainder; no backtracking. Mirrors `/^(@\w+)\s+(.+)/`.
 *
 * @param s - line content (with the leading `*` already stripped)
 *
 * @returns parsed tag + rest, or `null` when the shape does not match
 *
 * @example
 * ```ts
 * parseTaggedLine('@param foo'); // { tag: '@param', rest: 'foo' }
 * parseTaggedLine('@param'); // null
 * ```
 */
export function parseTaggedLine(s: string,): TaggedLine | null {
  if (!s.startsWith('@',))
    return null;
  /**
   * Advances through the run of word characters following the `@`.
   *
   * @param idx - cursor into `s`
   *
   * @returns exclusive end of the tag-name run
   */
  function scanTag(idx: number,): number {
    /** Cursor advanced over the word-character run; returned as the run's exclusive end. */
    let cursor = idx;
    while ((cursor < s.length) && isWordChar(s.charAt(cursor,),))
      cursor += 1;
    return cursor;
  }
  /** Exclusive end of the tag-name run; cursor starts at 1 to skip the leading at-sign. */
  const tagEnd = scanTag(1,);
  if (tagEnd === 1)
    return null;
  /**
   * Advances through the run of whitespace characters following the tag.
   *
   * @param idx - cursor into `s`
   *
   * @returns first non-whitespace position
   */
  function scanWhitespace(idx: number,): number {
    /** Cursor advanced over the whitespace run; returned as first non-whitespace position. */
    let cursor = idx;
    while ((cursor < s.length) && isWhitespaceChar(s.charAt(cursor,),))
      cursor += 1;
    return cursor;
  }
  /** First index past the inter-token whitespace; rest starts here. */
  const restStart = scanWhitespace(tagEnd,);
  if (restStart === tagEnd)
    return null;
  /** Remaining content; must be non-empty to match `(.+)`. */
  const rest = s.slice(restStart,);
  if (rest.length === 0)
    return null;
  return {
    tag: s.slice(
      0,
      tagEnd,
    ),
    rest,
  };
}

/**
 * Enforces that TSDoc tags which should not have content are empty.
 *
 * Modifier tags like `\@public`, `\@readonly`, `\@override`, `\@sealed`,
 * `\@virtual`, `\@alpha`, `\@beta`, `\@internal`, `\@experimental`,
 * `\@eventProperty`, and `\@packageDocumentation` must not have content.
 */
export const emptyTags: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce that TSDoc modifier tags have no content.',
      recommended: true,
    },
    messages: {
      nonEmpty: 'TSDoc modifier tag "{{tag}}" must not have content.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /** Tags that must be standalone (no content after them). */
    const modifierTags = new Set([
      '@public',
      '@readonly',
      '@override',
      '@sealed',
      '@virtual',
      '@alpha',
      '@beta',
      '@internal',
      '@experimental',
      '@eventProperty',
      '@packageDocumentation',
    ],);

    return createTsdocVisitor({
      context,
      handler: function emptyTagsHandler(
        _node,
        comment,
      ): void {
        /** Comment body split into lines; each is inspected independently for modifier-tag misuse. */
        const lines = getCommentLines(comment,);
        lines.forEach(function checkLine(
          line,
          index,
        ): void {
          /**
           * Line stripped of indent and `*` so the leading `\@tag` (if any) is at column 0.
           */
          const trimmed = stripCommentLineMarker(line.trimStart(),).trimStart();
          /**
           * Parsed `\@tag <text>` shape; null when the line carries no tag with trailing text.
           */
          const tagMatch = parseTaggedLine(trimmed,);
          if (tagMatch === null)
            return;
          /** Captured tag name and remainder; both populate the diagnostic and gate the report. */
          const {
            tag,
            rest,
          } = tagMatch;
          if (modifierTags.has(tag,) && (rest.trim().length > 0)) {
            context.report({
              loc: {
                start: {
                  line: comment.loc.start.line + index,
                  column: 0,
                },
              },
              messageId: 'nonEmpty',
              data: { tag, },
            },);
          }
        },);
      },
    },);
  },
};
