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

/** Triple-backtick delimiter that opens or closes a fenced code block. */
const FENCE_DELIMITER = '```';

/** Single-backtick delimiter that wraps inline-code segments. */
const INLINE_CODE_DELIMITER = '`';

/** Backslash-escape sequence that should be stripped before tag scanning. */
const ESCAPED_AT = String.raw`\@`;

/**
 * Returns true when `c` is an ASCII word character (alphanumeric or `_`).
 *
 * @param c - candidate character
 *
 * @returns whether the character qualifies as `\w` in regex semantics
 */
function isWordChar(c: string,): boolean {
  return ((c >= '0') && (c <= '9'))
    || ((c >= 'a') && (c <= 'z'))
    || ((c >= 'A') && (c <= 'Z'))
    || (c === '_');
}

/**
 * Returns true when `line` is a fenced-code-block delimiter (allows leading
 * whitespace before the triple backticks).
 *
 * @param line - raw TSDoc comment line
 *
 * @returns whether the line opens or closes a fenced code block
 */
function isFenceLine(line: string,): boolean {
  return line.trimStart().startsWith(FENCE_DELIMITER,);
}

/**
 * Removes inline-code spans bounded by single backticks. Linear scan: each
 * opening backtick is paired with the next backtick via `indexOf`; the
 * span between them (inclusive of both delimiters) is dropped before the
 * cursor resumes past the closing delimiter.
 *
 * @param s - line content
 *
 * @returns `s` with every backtick-delimited span removed
 */
function stripInlineCodeSpans(s: string,): string {
  /**
   * Recursive accumulator that copies non-code segments and skips bodies.
   *
   * @param from - cursor index for the next `indexOf` call
   *
   * @param acc - text collected so far
   *
   * @returns final stripped string
   */
  function scan({
    from,
    acc,
  }: {
    from: number;
    acc: string;
  },): string {
    /** Position of the next opening backtick; -1 means the rest is plain text. */
    const open = s.indexOf(
      INLINE_CODE_DELIMITER,
      from,
    );
    if (open === (-1))
      return acc + s.slice(from,);
    /** Position of the closing backtick; -1 means the line ends inside inline code. */
    const close = s.indexOf(
      INLINE_CODE_DELIMITER,
      open + 1,
    );
    if (close === (-1))
      return acc + s.slice(from,);
    return scan({
      from: close + 1,
      acc: acc + s.slice(
        from,
        open,
      ),
    },);
  }
  return scan({
    from: 0,
    acc: '',
  },);
}

/**
 * Strips inline code spans and backslash-escaped at signs from a line so
 * tag scanning does not produce false positives on package names or
 * escaped tag references.
 *
 * @param line - raw TSDoc comment line
 *
 * @returns line with inline code and escaped at signs removed
 */
function stripInlineCodeAndEscapes(line: string,): string {
  return stripInlineCodeSpans(line,).replaceAll(
    ESCAPED_AT,
    '',
  );
}

/**
 * Iterates every literal `@word` occurrence in `stripped`, yielding the
 * captured word (without the leading `@`).
 *
 * Linear scan: each `@` is located via `indexOf`, the trailing word run is
 * collected by advancing the cursor while characters remain `\w`, and the
 * cursor jumps past the run before the next `indexOf` so each character is
 * inspected at most twice.
 *
 * @param stripped - line content with inline code/escapes already removed
 *
 * @returns ordered tag-name list (each without `@`)
 */
function collectTags(stripped: string,): readonly string[] {
  /**
   * Recursive scan accumulating every tag word.
   *
   * @param from - cursor index for the next `indexOf` call
   *
   * @param acc - tag words collected so far
   *
   * @returns final list of tag words
   */
  function scan({
    from,
    acc,
  }: {
    from: number;
    acc: readonly string[];
  },): readonly string[] {
    /** Position of the next at-sign; -1 ends the scan. */
    const atIdx = stripped.indexOf(
      '@',
      from,
    );
    if (atIdx === (-1))
      return acc;
    /**
     * Walks the run of word characters following the `@`.
     *
     * @param idx - cursor into `stripped`
     *
     * @returns exclusive end of the tag-name run
     */
    function scanTag(idx: number,): number {
      if (idx >= stripped.length)
        return idx;
      if (!isWordChar(stripped.charAt(idx,),))
        return idx;
      return scanTag(idx + 1,);
    }
    /** Exclusive end of the word run; equals `atIdx + 1` when no word follows. */
    const end = scanTag(atIdx + 1,);
    if (end === (atIdx + 1)) {
      return scan({
        from: atIdx + 1,
        acc,
      },);
    }
    return scan({
      from: end,
      acc: [
        ...acc,
        stripped.slice(
          atIdx + 1,
          end,
        ),
      ],
    },);
  }
  return scan({
    from: 0,
    acc: [],
  },);
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
    return createTsdocVisitor({
      context,
      handler: function checkTagNamesHandler(
        _node,
        comment,
      ): void {
        /** Raw comment body split into per-line slices; iterated to find tag occurrences. */
        const lines = comment.value.split('\n',);
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
            /** TSDoc-equivalent suggestion when the tag is JSDoc-only; undefined for unknowns. */
            const suggestion = JSDOC_TO_TSDOC_MAP.get(tag,);
            if (suggestion !== undefined) {
              context.report({
                loc: {
                  start: {
                    line: comment.loc.start.line + index,
                    column: 0,
                  },
                },
                messageId: 'jsdocOnly',
                data: {
                  tag,
                  suggestion,
                },
              },);
            }
            else if (!VALID_TSDOC_TAGS.has(tag,)) {
              context.report({
                loc: {
                  start: {
                    line: comment.loc.start.line + index,
                    column: 0,
                  },
                },
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
