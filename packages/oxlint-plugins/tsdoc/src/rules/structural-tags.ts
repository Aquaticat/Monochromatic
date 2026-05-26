/**
 * Structural TSDoc rule for tag spacing.
 *
 * Enforces blank lines before block tags in TSDoc comments.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  Fixer,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { ABSENT, } from '../sentinel.ts';

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
 * Extracts the leading `@word` token from `s`, including the `@`.
 *
 * Linear scan: walks word characters starting at index 1 (just past `@`)
 * and stops at the first non-word char. Mirrors `/^(@\w+)/`.
 *
 * @param s - line content (with the leading `*` already stripped and trimmed)
 *
 * @returns captured tag (e.g. `'@param'`) or {@link ABSENT} when `s` does not begin with `@word`
 *
 * @example
 * ```ts
 * extractLeadingTag('@param foo'); // '@param'
 * extractLeadingTag('plain text'); // ABSENT
 * ```
 */
export function extractLeadingTag(s: string,): string | typeof ABSENT {
  if (!s.startsWith('@',))
    return ABSENT;
  /**
   * Advances through the run of word characters following the `@`.
   *
   * @param idx - cursor into `s`
   *
   * @returns exclusive end of the tag-name run
   */
  function scan(idx: number,): number {
    /** Cursor advanced over the word-character run; returned as the run's exclusive end. */
    let cursor = idx;
    while ((cursor < s
      .length) && isWordChar(s.charAt(cursor,),))
      cursor += 1;
    return cursor;
  }
  /** Exclusive end of the tag-name run; cursor starts at 1 to skip the leading at-sign. */
  const end = scan(1,);
  if (end === 1)
    return ABSENT;
  return s.slice(
    0,
    end,
  );
}

/**
 * Enforces consistent spacing between TSDoc tags.
 *
 * Requires a blank comment line before block tags (configurable).
 */
export const tagLines: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description: 'Enforce consistent spacing between TSDoc tags.',
      recommended: true,
    },
    messages: {
      noBlankBefore: 'Expected a blank line before "{{tag}}".',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createTsdocVisitor({
      context,
      handler: function tagLinesHandler(
        _node,
        comment,
      ): void {
        /** Raw lines of the comment body, including opener `/**` and closer `*\/`. */
        const lines = getCommentLines(comment,);
        /** Minimum line count for a comment that can contain tag spacing issues. */
        const minContentLines = 3;
        if (lines.length
          < minContentLines)
          return;

        /**
         * Indentation for blank comment lines: spaces + `*`.
         * Matches the opener's `*` column (column of `/*` + 1).
         */
        const blankLineIndent = ' '.repeat(comment.loc
          .start
          .column
          + 1,);
        /** Pre-built ` * ` blank-line text inserted by the autofixer when spacing is missing. */
        const blankCommentLine = `${blankLineIndent}*`;

        // Check each content line (skip opener and closer)
        /** Comment body without opener and closer; scanned for tag-spacing violations. */
        const contentLines = lines.slice(
          1,
          -1,
        );
        contentLines.forEach(function checkTagLine(
          line,
          index,
        ): void {
          if (index === 0)
            return;
          /** Current line stripped of indent and the leading `*`, ready for tag matching. */
          const trimmed = stripCommentLineMarker(line.trimStart(),)
            .trimStart();
          if (!trimmed.startsWith('@',))
            return;
          // Check if previous line is blank
          /** Previous content line; required to determine whether the tag is preceded by a blank. */
          const prevLine = contentLines[index - 1];
          if (prevLine === undefined)
            return;
          /** Previous line stripped of indent and `*`; empty string means the tag is preceded by blank. */
          const prevTrimmed = stripCommentLineMarker(prevLine.trimStart(),)
            .trimStart();
          if (prevTrimmed.length
            > 0) {
            /**
             * Tag matched on the line; absent only if the line somehow lost its leading `@`.
             */
            const matched = extractLeadingTag(trimmed,);
            /**
             * Resolved tag string for the error message, with `\@unknown` for the impossible-absent case.
             */
            const tag = matched === ABSENT ? '@unknown' : matched;

            /**
             * Line number of the tag line in the source file (1-based).
             * `index` is 0-based within contentLines; +1 for the opener line, +1 for 1-based.
             */
            const tagLineNumber = comment.loc
              .start
              .line
              + index
              + 1;

            context.report({
              loc: {
                start: {
                  line: tagLineNumber,
                  column: 0,
                },
              },
              messageId: 'noBlankBefore',
              data: { tag, },
              fix(fixer: Fixer,) {
                /**
                 * Insert a blank comment line (`\n *`) just before the tag line.
                 * Use `getIndexFromLoc` to find the byte offset of the tag line start,
                 * then insert the blank line text ending with a newline.
                 */
                const insertOffset = context.sourceCode
                  .getIndexFromLoc({
                  line: tagLineNumber,
                  column: 0,
                },);
                return fixer.insertTextBeforeRange(
                  [
                    insertOffset,
                    insertOffset,
                  ],
                  `${blankCommentLine}\n`,
                );
              },
            },);
          }
        },);
      },
    },);
  },
};

export { emptyTags, } from './empty-tags.ts';

export { escapeInlineTags, } from './tag-escaping.ts';
