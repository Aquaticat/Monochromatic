/**
 * TSDoc tag name validation rule.
 *
 * Extracted from `tag-validation.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts/foreign-borrowed.ts';
import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  collectTags,
  isFenceLine,
  stripInlineCodeAndEscapes,
} from '../comment-text.ts';
import { JSDOC_TO_TSDOC_MAP, } from './jsdoc-map.ts';
import {
  commentLineReportLoc,
  createTsdocVisitor,
} from './tsdoc-visitors.ts';

export {
  collectTags,
  stripInlineCodeSpans,
} from '../comment-text.ts';

/**
 * Standard TSDoc tag names taken from `@microsoft/tsdoc@0.16.0`
 * `StandardTags.allDefinitions`, hardcoded so the plugin carries no runtime
 * dependency on the library. Update alongside a TSDoc spec change.
 */
const STANDARD_TSDOC_TAGS: readonly string[] = [
  '@alpha',
  '@beta',
  '@decorator',
  '@defaultValue',
  '@deprecated',
  '@eventProperty',
  '@example',
  '@experimental',
  '@inheritDoc',
  '@internal',
  '@label',
  '@link',
  '@override',
  '@packageDocumentation',
  '@param',
  '@privateRemarks',
  '@public',
  '@readonly',
  '@remarks',
  '@returns',
  '@sealed',
  '@see',
  '@throws',
  '@typeParam',
  '@virtual',
  '@jsx',
  '@jsxRuntime',
  '@jsxFrag',
  '@jsxImportSource',
];

/**
 * Valid TSDoc tag names: standard set plus project `@mutates` and compatibility `@yields`.
 */
const VALID_TSDOC_TAGS: ReadonlySet<string> = new Set([
  ...STANDARD_TSDOC_TAGS,
  '@mutates',
  '@yields',
],);

/**
 * Validates that all tags in a TSDoc comment are recognized TSDoc standard tags.
 *
 * Reports JSDoc-only tags (per {@link JSDOC_TO_TSDOC_MAP}) and any other
 * unrecognized tags.
 *
 * Skips tag scanning inside fenced code blocks (via {@link isFenceLine}) and
 * backtick-wrapped inline code (via {@link stripInlineCodeAndEscapes}) to
 * avoid false positives on package names or escaped tag references.
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
  /**
   * Handles effectful plugin callback.
   *
   * @param context - Foreign callback value carrying diagnostic capability.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return createTsdocVisitor({
      context,
      handler: function checkTagNamesHandler(
        _node,
        comment,
      ): void {
        /**
         * Raw comment body split into per-line slices; iterated to find tag occurrences.
         */
        const lines = comment.value
          .split('\n',);
        /**
         * Mutable code-fence state, kept in a `const` object so AGENTS.md's
         * function-root `let` ban is satisfied while the forEach callback
         * still toggles the flag across iterations.
         */
        const fenceState = { inside: false, };

        lines.forEach(function checkLine(
          line,
          index,
        ): void {
          // Track fenced code block boundaries to skip tag scanning inside them
          if (isFenceLine(line,)) {
            fenceState.inside = !fenceState.inside;
            return;
          }
          if (fenceState.inside)
            return;

          // Strip inline code and escaped @ to avoid false positives on
          // package names like `@microsoft/tsdoc` or escaped tag references
          /**
           * Line with inline code spans and escaped `\@` sequences removed before scanning.
           */
          const stripped = stripInlineCodeAndEscapes(line,);
          /**
           * Ordered list of `\@word` tag captures in the stripped line.
           */
          const tagWords = collectTags(stripped,);
          for (const word of tagWords) {
            /**
             * Recovered tag string with the leading `\@` for lookup and message data.
             */
            const tag = `@${word}`;
            /**
             * TSDoc-equivalent suggestion when the tag is JSDoc-only; undefined for unknowns.
             */
            const suggestion = JSDOC_TO_TSDOC_MAP.get(tag,);
            if (suggestion !== undefined) {
              context.report({
                loc: commentLineReportLoc({
                  comment,
                  lineOffset: index,
                },),
                messageId: 'jsdocOnly',
                data: {
                  tag,
                  suggestion,
                },
              },);
            }
            else if (!VALID_TSDOC_TAGS.has(tag,)) {
              context.report({
                loc: commentLineReportLoc({
                  comment,
                  lineOffset: index,
                },),
                messageId: 'unknown',
                data: { tag, },
              },);
            }
          }
        },);
      },
    },);
  },
};
