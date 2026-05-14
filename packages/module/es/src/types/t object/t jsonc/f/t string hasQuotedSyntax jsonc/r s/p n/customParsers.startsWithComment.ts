// oxlint-disable typescript/no-unsafe-type-assertion -- JSONC parser casts string slices to branded fragment types

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

import type * as Jsonc from '../../../../t/index.ts';
import { mergeComments, } from './customParsers.startsWithComment.mergeComments.ts';

/**
 * Locates the position of the closing `*\/` delimiter for a block comment that starts at position 0.
 *
 * @param value - string beginning with `/*` to scan for the block comment end
 *
 * @returns character index of the `*` in the closing `*\/` delimiter
 *
 * @throws When no valid block comment end is found (incomplete block comment)
 */
function findBlockEndPosition({ value, }: { value: string; },): number {
  // If it's on the first line, we've hit the jackpot.
  //       How do we know if it's on the first line?
  //       /\/\*[^\n]{0,}\*\//
  //
  //       If not, continue grinding.
  //       Use the regexp /\n[^\n]{0,}\*\//g
  //       Then check if the match contains '//'
  //       If so, discard the match.

  /** Input with surrounding whitespace stripped; both lookup branches scan against this normalized form. */
  const trimmed = value.trim();

  // Check for first-line optimization jackpot case: /*...*\/ all on one line
  // This handles the unique case where the entire block comment is on the first line
  // Must be lazy else will match 1, /* c *\/ 2, /* d *\/
  /** Matches a `/* ... *\/` comment confined to a single line; lazy so it stops at the first closing delimiter. */
  const FIRST_LINE_BLOCK_COMMENT_REGEX = /\/\*[^\n]*?\*\//;
  /** Single-line block comment match against {@link trimmed}, or null when the comment spans multiple lines. */
  const firstLineMatch = FIRST_LINE_BLOCK_COMMENT_REGEX.exec(trimmed,);
  if (firstLineMatch) {
    // Found a complete block comment on the first line - return immediately
    // Doesn't handle `/* a {"b": "*\/" } *\/ {"c": "d"}`
    // Because in all languages, *\/ upon first found after starting a block comment, auto becomes end marker of block comment.
    return firstLineMatch.index + firstLineMatch[0].length - '*/'.length;
  }

  // If not on first line, use line-based approach
  // This regex specifically finds *\/ that appear after newlines
  /** Locates a `*\/` sequence anchored to a non-first line; used to skip closes that fall inside `//` line comments. */
  const NEWLINE_STAR_SLASH_REGEX = /\n[^\n]*\*\//g;
  /** Iterator over every newline-anchored `*\/` candidate; the loop discards those preceded by `//`. */
  const newlineStarSlashMatches = trimmed.matchAll(NEWLINE_STAR_SLASH_REGEX,);

  // Process each starSlash match and check for line comment interference
  for (const newlineStarSlashMatch of newlineStarSlashMatches) {
    // Check if this starSlash is commented out by a line comment on the same line
    if (newlineStarSlashMatch.includes('//',)) {
      // Discard this match, continue to next starSlash
      continue;
    }

    // No need to manually ensure starSlash isn't in quotes.
    // Why? Because if the first starSlash is in quotes when we've already found a slashStar at start, it's invalid JSONC.
    // And we assume valid JSONC.

    // Valid starSlash found - return its position
    return newlineStarSlashMatch.index
      + newlineStarSlashMatch[0].length
      - '*/'.length;
  }

  // No valid block comment end found
  throw new Error(`incomplete block comment is not jsonc, {
        comment: {
          type: 'block',
          commentValue: ${trimmed.slice('/*'.length,)},
        },
      }`,);
}

/**
 * Finds all comments before something and returns both allComments and something.
 *
 * @returns remaining content after comments and accumulated comment value
 *
 * @example
 * ```ts
 * const result = startsWithComment({ value: '// note\n42' as FragmentStringJsonc });
 * // result.remainingContent === '42'
 * // result.comment === { type: 'inline', commentValue: ' note' }
 * ```
 */
export function startsWithComment<const Value extends StringJsonc | FragmentStringJsonc,>(
  {
    value,
    context,
  }: {
    value: Value;
    context?: Jsonc.ValueBase;
  },
): { remainingContent: Value; } & Jsonc.ValueBase {
  // Eliminate leading and trailing whitespace, including space and newline characters.
  /** Input with surrounding whitespace stripped; every branch below pattern-matches against this normalized form. */
  const trimmed = value.trim();

  // trimmed.split('//') would not be faster because it needs to scan the whole string.

  if (trimmed.startsWith('//',)) {
    // Find the end of the line comment (newline character)
    /** Index of the newline that terminates the inline comment, or `-1` when the comment extends to EOF. */
    const newlinePosition = trimmed.indexOf(
      '\n',
      '//'.length,
    );
    if (newlinePosition === -1) {
      // No newline found - line comment extends to end of input (valid at end of file)
      /** Inline comment node captured up to EOF; emitted because the comment consumed every remaining character. */
      const commentPart: Jsonc.Comment = {
        type: 'inline',
        commentValue: trimmed
          .slice('//'.length,),
      };
      /** Combined inbound and freshly parsed comment; preserves any comment already on `context`. */
      const mergedComments = mergeComments({
        value: context?.comment,
        value2: commentPart,
      },);
      // Return empty remaining content since comment consumed everything
      return {
        remainingContent: '' as Value,
        comment: mergedComments,
      };
    }

    // JSON or JSONC doesn't allow newlines in quoted strings. Special handling skipped.

    // Extract the comment and the rest of the content after newline
    // No trimming needed because we wanna support both `// This is` and `//region`.
    /** Inline comment node spanning from `//` to the terminating newline; raw text preserved so `//region` markers survive. */
    const commentPart: Jsonc.Comment = {
      type: 'inline',
      commentValue: trimmed
        .slice(
          '//'.length,
          newlinePosition,
        ),
    };
    /** Combined inbound and freshly parsed comment; chained into the recursive call's context. */
    const mergedComments = mergeComments({
      value: context?.comment,
      value2: commentPart,
    },);

    /** Input remaining after the inline comment; fed back through the parser to consume further comments. */
    const remainingContent = trimmed
      .slice(newlinePosition + '\n'.length,)
      .trim() as Value;

    // Recursively parse the remaining content
    return startsWithComment({
      value: remainingContent,
      context: {
        comment: mergedComments,
      },
    },);
  }

  if (trimmed.startsWith('/*',)) {
    /** Index of the `*` that closes the block comment; computed by {@link findBlockEndPosition}. */
    const blockEndPosition = findBlockEndPosition({ value: trimmed, },);

    // Extract the comment and the rest of the content after the closing star slash
    /** Block comment node spanning from `/*` to {@link blockEndPosition}; raw body preserved for downstream consumers. */
    const commentPart: Jsonc.Comment = {
      type: 'block',
      commentValue: trimmed.slice(
        '/*'.length,
        blockEndPosition,
      ),
    };
    /** Combined inbound and freshly parsed comment; chained into the recursive call's context. */
    const mergedComments = mergeComments({
      value: context?.comment,
      value2: commentPart,
    },);

    // Get content after the block comment, skipping the star slash delimiter
    /** Input remaining after the block comment; fed back through the parser to consume further comments. */
    const remainingContent = trimmed
      .slice(blockEndPosition + '*/'.length,)
      .trim() as Value;

    // Recursively parse the remaining content
    return startsWithComment({
      value: remainingContent,
      context: {
        comment: mergedComments,
      },
    },);
  }

  return {
    remainingContent: trimmed as Value,
    ...context,
  };
}
