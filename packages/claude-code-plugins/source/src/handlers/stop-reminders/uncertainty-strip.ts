/**
 * Strip functions that remove non-prose regions from assistant message
 * text before the uncertainty engine scans it. Delegates the actual
 * span-removal work to {@link stripBetweenDelims} and
 * {@link stripLinesStartingWith} from the shared text-scan module so this
 * file stays regex-free.
 *
 * @module
 */

import {
  stripBetweenDelims,
  stripLinesStartingWith,
} from '@monochromatic-dev/agent-harnesses-shared-text-scan/ts';

/**
 * Strips fenced code blocks (triple-backtick) so uncertainty scans don't
 * match words inside code. Mirrors the legacy regex pass that replaced
 * triple-backtick fenced blocks with empty strings.
 *
 * @param text - raw message text that may contain fenced code blocks
 *
 * @returns text with all fenced code blocks removed
 *
 * @example
 * ```ts
 * stripCodeBlocks('text ```js\nmaybe();\n``` more text')
 * // => 'text  more text'
 * ```
 */
function stripCodeBlocks(text: string,): string {
  return stripBetweenDelims({
    text,
    openDelim: '```',
    closeDelim: '```',
  },);
}

/**
 * Strips inline code spans (single-backtick) so uncertainty scans don't
 * match words inside code. Mirrors the legacy regex pass that replaced
 * backtick-bounded spans with empty strings.
 *
 * @param text - text that may contain inline code spans
 *
 * @returns text with all inline code spans removed
 *
 * @example
 * ```ts
 * stripInlineCode('use `maybe` function')
 * // => 'use  function'
 * ```
 */
function stripInlineCode(text: string,): string {
  return stripBetweenDelims({
    text,
    openDelim: '`',
    closeDelim: '`',
  },);
}

/**
 * Strips markdown blockquote lines so uncertainty scans don't match words
 * Claude is quoting from source material. Mirrors the legacy regex pass
 * that removed every line beginning with the blockquote marker.
 *
 * @param text - text that may contain markdown blockquotes
 *
 * @returns text with blockquote lines removed
 *
 * @example
 * ```ts
 * stripBlockquotes('normal line\n> probably a quote\nanother line')
 * // => 'normal line\nanother line'
 * ```
 */
function stripBlockquotes(text: string,): string {
  return stripLinesStartingWith({
    text,
    prefix: '>',
  },);
}

/**
 * Strips inline quoted strings (double and single quotes) so uncertainty
 * scans don't match words Claude is quoting verbatim. Mirrors the legacy
 * regex pipeline that stripped one quote shape after the other; here it
 * chains {@link stripBetweenDelims} with `disallowedInside: '\n'` to keep
 * the strip bounded to a single line.
 *
 * @param text - text that may contain inline quoted strings
 *
 * @returns text with inline quoted strings removed
 *
 * @example
 * ```ts
 * stripQuotedStrings('the word "maybe" appears here')
 * // => 'the word  appears here'
 * ```
 */
function stripQuotedStrings(text: string,): string {
  return stripBetweenDelims({
    text: stripBetweenDelims({
      text,
      openDelim: '"',
      closeDelim: '"',
      disallowedInside: '\n',
    },),
    openDelim: "'",
    closeDelim: "'",
    disallowedInside: '\n',
  },);
}

/**
 * Prepares message text for uncertainty scanning by removing regions
 * where uncertain language is expected or acceptable (code blocks, inline
 * code, blockquotes, quoted strings).
 *
 * Stripping order matters: fenced code blocks first (largest spans),
 * then inline code, then blockquotes, then quoted strings.
 *
 * @param text - raw assistant message text
 *
 * @returns cleaned text ready for pattern matching
 *
 * @example
 * ```ts
 * const prose = stripNonProseRegions('Look at ```js\nmaybe()\n``` and "perhaps"');
 * ```
 */
function stripNonProseRegions(text: string,): string {
  return stripQuotedStrings(
    stripBlockquotes(
      stripInlineCode(stripCodeBlocks(text,),),
    ),
  );
}

export {
  stripBlockquotes,
  stripCodeBlocks,
  stripInlineCode,
  stripNonProseRegions,
  stripQuotedStrings,
};
