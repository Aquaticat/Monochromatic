import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

import type * as Jsonc from '../../../../t/index.ts';
import { mergeComments, } from './customParsers.startsWithComment.mergeComments.ts';

function findBlockEndPosition({ value, }: {value: string},): number {
  // If it's on the first line, we've hit the jackpot.
  //       How do we know if it's on the first line?
  //       /\/\*[^\n]{0,}\*\//
  //
  //       If not, continue grinding.
  //       Use the regexp /\n[^\n]{0,}\*\//g
  //       Then check if the match contains '//'
  //       If so, discard the match.

  const trimmed = value.trim();

  // Check for first-line optimization jackpot case: /*...*\/ all on one line
  // This handles the unique case where the entire block comment is on the first line
  // Must be lazy else will match 1, /* c *\/ 2, /* d *\/
  const FIRST_LINE_BLOCK_COMMENT_REGEX = /\/\*[^\n]*?\*\//;
  const firstLineMatch = FIRST_LINE_BLOCK_COMMENT_REGEX.exec(trimmed,);
  if (firstLineMatch) {
    // Found a complete block comment on the first line - return immediately
    // Doesn't handle `/* a {"b": "*\/" } *\/ {"c": "d"}`
    // Because in all languages, *\/ upon first found after starting a block comment, auto becomes end marker of block comment.
    return firstLineMatch.index + firstLineMatch[0].length - '*/'.length;
  }

  // If not on first line, use line-based approach
  // This regex specifically finds *\/ that appear after newlines
  const NEWLINE_STAR_SLASH_REGEX = /\n[^\n]*\*\//g;
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
  throw new Error(`incomplete block comment is not  jsonc, {
        comment: {
          type: 'block',
          commentValue: ${trimmed.slice('/*'.length,)},
        },
      }`,);
};

/**
 * Finds all comments before something and returns both allComments and something.
 */
export function startsWithComment<const Value extends StringJsonc | FragmentStringJsonc,>(
  { value, context, }: { value: Value; context?: Jsonc.ValueBase; },
): { remainingContent: Value; } & Jsonc.ValueBase {
  // Eliminate leading and trailing whitespace, including space and newline characters.
  const trimmed = value.trim();

  // trimmed.split('//') would not be faster because it needs to scan the whole string.

  if (trimmed.startsWith('//',)) {
    // Find the end of the line comment (newline character)
    const newlinePosition = trimmed.indexOf('\n', '//'.length,);
    if (newlinePosition === -1) {
      // No newline found - line comment extends to end of input (valid at end of file)
      const commentPart: Jsonc.Comment = { type: 'inline', commentValue: trimmed
        .slice('//'.length,), };
      const mergedComments = mergeComments({ value: context?.comment,
        value2: commentPart, },);
      // Return empty remaining content since comment consumed everything
      return { remainingContent: '' as Value, comment: mergedComments, };
    }

    // JSON or JSONC doesn't allow newlines in quoted strings. Special handling skipped.

    // Extract the comment and the rest of the content after newline
    // No trimming needed because we wanna support both `// This is` and `//region`.
    const commentPart: Jsonc.Comment = { type: 'inline', commentValue: trimmed
      .slice('//'.length, newlinePosition,), };
    const mergedComments = mergeComments({ value: context?.comment,
      value2: commentPart, },);

    const remainingContent = trimmed
      .slice(newlinePosition + '\n'.length,)
      .trim() as Value;

    // Recursively parse the remaining content
    return startsWithComment({ value: remainingContent, context: {
      comment: mergedComments,
    }, },);
  }

  if (trimmed.startsWith('/*',)) {
    const blockEndPosition = findBlockEndPosition({ value: trimmed, },);

    // Extract the comment and the rest of the content after the closing star slash
    const commentPart: Jsonc.Comment = {
      type: 'block',
      commentValue: trimmed.slice('/*'.length, blockEndPosition,),
    };
    const mergedComments = mergeComments({ value: context?.comment,
      value2: commentPart, },);

    // Get content after the block comment, skipping the star slash delimiter
    const remainingContent = trimmed
      .slice(blockEndPosition + '*/'.length,)
      .trim() as Value;

    // Recursively parse the remaining content
    return startsWithComment({ value: remainingContent, context: {
      comment: mergedComments,
    }, },);
  }

  return { remainingContent: trimmed as Value, ...context, };
}
