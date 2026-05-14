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

import {
  COMMENT_LINE_PREFIX,
  createTsdocVisitor,
  getCommentLines,
} from './tsdoc-visitors.ts';

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
        if (lines.length < minContentLines)
          return;

        /**
         * Indentation for blank comment lines: spaces + `*`.
         * Matches the opener's `*` column (column of `/*` + 1).
         */
        const blankLineIndent = ' '.repeat(comment.loc.start.column + 1,);
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
          const trimmed = line
            .trimStart()
            .replace(
              COMMENT_LINE_PREFIX,
              '',
            )
            .trimStart();
          if (!trimmed.startsWith('@',))
            return;
          // Check if previous line is blank
          /** Previous content line; required to determine whether the tag is preceded by a blank. */
          const prevLine = contentLines[index - 1];
          if (prevLine === undefined)
            return;
          /** Previous line stripped of indent and `*`; empty string means the tag is preceded by blank. */
          const prevTrimmed = prevLine
            .trimStart()
            .replace(
              COMMENT_LINE_PREFIX,
              '',
            )
            .trimStart();
          if (prevTrimmed.length > 0) {
            /**
             * Match for the leading `\@tag` on the current line; null when not a tag line.
             */
            const tagMatch = (/^(@\w+)/).exec(trimmed,);
            /**
             * Resolved tag string for the error message, with `\@unknown` fallback for the impossible-null case.
             */
            const tag = (tagMatch !== null) ? (tagMatch[1] ?? '@unknown') : '@unknown';

            /**
             * Line number of the tag line in the source file (1-based).
             * `index` is 0-based within contentLines; +1 for the opener line, +1 for 1-based.
             */
            const tagLineNumber = comment.loc.start.line + index + 1;

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
                const insertOffset = context.sourceCode.getIndexFromLoc({
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
