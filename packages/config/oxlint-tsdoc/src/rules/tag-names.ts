/**
 * TSDoc tag name validation rule.
 *
 * Extracted from `tag-validation.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import { StandardTags, } from '@microsoft/tsdoc';

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { JSDOC_TO_TSDOC_MAP, } from './jsdoc-map.ts';
import { createTsdocVisitor, } from './tsdoc-visitors.ts';

/**
 * Valid TSDoc tag names from the TSDoc standard, plus custom tags
 * supported by this plugin (yields).
 *
 * Built dynamically from microsoft/tsdoc StandardTags so the set stays
 * current with spec updates.
 */
const VALID_TSDOC_TAGS: ReadonlySet<string> = new Set([
  ...StandardTags.allDefinitions.map(function getTagName(def,): string {
    return def.tagName;
  },),
  '@yields',
],);

/** Regex matching a fenced code block delimiter inside a TSDoc comment. */
const CODE_FENCE_PATTERN = /^\s*```/;

/** Regex matching backtick-wrapped inline code segments. */
const INLINE_CODE_PATTERN = /`[^`]*`/g;

/** Regex matching backslash-escaped at signs. */
const ESCAPED_AT_PATTERN = /\\@/g;

/**
 * Strips inline code and backslash-escaped at signs from a line so that
 * tag scanning does not produce false positives on package names or
 * escaped tag references.
 *
 * @param line - raw TSDoc comment line
 *
 * @returns line with inline code and escaped at signs removed
 */
function stripInlineCodeAndEscapes(line: string,): string {
  return line
    .replace(
      INLINE_CODE_PATTERN,
      '',
    )
    .replace(
      ESCAPED_AT_PATTERN,
      '',
    );
}

/**
 * Validates that all tags in a TSDoc comment are recognized TSDoc standard tags.
 *
 * Reports JSDoc-only tags and any other unrecognized tags.
 *
 * Skips tag scanning inside fenced code blocks and backtick-wrapped inline
 * code to avoid false positives on package names or escaped tag references.
 */
export const checkTagNames: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Validate TSDoc tag names against the TSDoc standard.',
      recommended: true,
    },
    messages: {
      unknown: String
        .raw`Unknown TSDoc tag "{{tag}}". If this is not a tag, escape the @ as \@.`,
      jsdocOnly: '"{{tag}}" is a JSDoc tag, not valid in TSDoc. {{suggestion}}',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createTsdocVisitor(
      context,
      function checkTagNamesHandler(_node, comment,): void {
        const lines = comment.value.split('\n',);
        let insideCodeFence = false;

        lines.forEach(function checkLine(line, index,): void {
          // Track fenced code block boundaries to skip tag scanning inside them
          if (CODE_FENCE_PATTERN.test(line,)) {
            insideCodeFence = !insideCodeFence;
            return;
          }
          if (insideCodeFence)
            return;

          // Strip inline code and escaped @ to avoid false positives on
          // package names like `@microsoft/tsdoc` or escaped tag references
          const stripped = stripInlineCodeAndEscapes(line,);
          const tagMatches = stripped.matchAll(/@(\w+)/g,);
          for (const match of tagMatches) {
            const tag = `@${match[1]}`;
            const suggestion = JSDOC_TO_TSDOC_MAP.get(tag,);
            if (suggestion !== undefined) {
              context.report({
                loc: {
                  start: { line: comment.loc.start.line + index, column: 0, },
                },
                messageId: 'jsdocOnly',
                data: { tag, suggestion, },
              },);
            }
            else if (!VALID_TSDOC_TAGS.has(tag,)) {
              context.report({
                loc: {
                  start: { line: comment.loc.start.line + index, column: 0, },
                },
                messageId: 'unknown',
                data: { tag, },
              },);
            }
          }
        },);
      },
    );
  },
};
