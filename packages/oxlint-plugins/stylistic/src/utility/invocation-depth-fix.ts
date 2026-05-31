import type {
  Context,
  Fixer,
  Token,
} from '@oxlint/plugins';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { baseIndentAt, } from './indent.ts';
import {
  operandOrThrow,
  type SpineNode,
} from './invocation-spine.ts';

/**
 * Reports whether a token is an opening parenthesis.
 *
 * Used as the `getTokenAfter` filter that locates a call's argument-list bracket
 * past the callee, type arguments, or `import` keyword. A named callback whose
 * single parameter is dictated by oxlint's token-filter API; typed structurally
 * so it stays readonly and accepts the token-or-comment the filter receives.
 *
 * @param token - candidate token or comment from the token stream
 *
 * @returns whether the token's text is `(`
 */
function isOpenParenToken(token: { readonly value: string; },): boolean {
  return token.value
    === '(';
}

/**
 * Parameters for {@link findOpenParen}.
 */
type FindOpenParenParams = {
  /**
   * Rule context; its `sourceCode` supplies the token lookups.
   */
  readonly context: Context;
  /**
   * Counted invocation whose argument-list opening bracket is wanted.
   */
  readonly owner: SpineNode;
};

/**
 * Locates the opening parenthesis of a counted invocation's argument list.
 *
 * For a dynamic import the search anchors on the `import` keyword token; for a
 * call or `new` it anchors past the type arguments (`a<T>(x)`) or the callee, so
 * a grouping parenthesis around the operand (`a((b))`) is never mistaken for the
 * call's own bracket.
 *
 * @returns opening-parenthesis token of the argument list
 *
 * @throws when no opening parenthesis follows the anchor, which is unreachable
 *   for an invocation with a single operand
 */
function findOpenParen({
  context,
  owner,
}: FindOpenParenParams,): Token {
  if (owner.type
    === 'ImportExpression') {
    /**
     * `import` keyword token; the call bracket is the first `(` after it.
     */
    const importKeyword = nonNullishOrThrow(context.sourceCode
      .getFirstToken(owner,),);
    return nonNullishOrThrow(context.sourceCode
      .getTokenAfter(
      importKeyword,
      { filter: isOpenParenToken, },
    ),);
  }
  /**
   * Anchor past type arguments when present, else past the callee.
   */
  const anchor = owner.typeArguments ?? nonNullishOrThrow(owner.callee,);
  return nonNullishOrThrow(context.sourceCode
    .getTokenAfter(
    anchor,
    { filter: isOpenParenToken, },
  ),);
}

/**
 * Minimal readonly token shape the grouping scan reads.
 */
type ScannedToken = {
  /**
   * Token text, classified against `)`.
   */
  readonly value: string;
  /**
   * Byte offset just past the token.
   */
  readonly end: number;
};

/**
 * Grouping-paren scan accumulator: whether still in the contiguous close-paren
 * prefix, and the effective operand end seen so far.
 */
type GroupingScan = {
  /**
   * Whether the scan is still inside the leading run of grouping close parens.
   */
  readonly open: boolean;
  /**
   * Byte offset just past the last grouping close paren, or the operand end.
   */
  readonly end: number;
};

/**
 * Parameters for {@link commaInsertionOffset}.
 */
type CommaOffsetParams = {
  /**
   * Rule context; its `sourceCode` supplies the between-token lookup.
   */
  readonly context: Context;
  /**
   * Counted invocation being split.
   */
  readonly owner: SpineNode;
  /**
   * Raw single operand of `owner`.
   */
  readonly operand: SpineNode;
};

/**
 * Returns the byte offset where the trailing comma is inserted.
 *
 * The offset sits just past the operand and any grouping parentheses that wrap
 * it, before an existing trailing comma or comment. The tokens strictly between
 * the operand and the call's closing bracket are the grouping close parens
 * (always a leading run, since they hug the operand) followed by an optional
 * trailing comma; comments are excluded by the token lookup, so a comment never
 * shifts the offset. A `reduce` over that run keeps the scan free of root-level
 * mutable state.
 *
 * @returns offset for the inserted comma
 */
function commaInsertionOffset({
  context,
  owner,
  operand,
}: CommaOffsetParams,): number {
  /**
   * Call's closing bracket token; bounds the between-token lookup.
   */
  const closeToken = nonNullishOrThrow(context.sourceCode
    .getLastToken(owner,),);
  /**
   * Grouping close parens then an optional trailing comma, comments excluded.
   */
  const between = context.sourceCode
    .getTokensBetween(
    operand,
    closeToken,
  );
  /**
   * Scan over the leading grouping-close-paren run; its `end` is the offset.
   */
  const scan = between.reduce(
    function extendGrouping(
      accumulator: GroupingScan,
      token: ScannedToken,
    ): GroupingScan {
      if (accumulator.open && (token.value
        === ')')) {
        return {
          open: true,
          end: token.end,
        };
      }
      return {
        open: false,
        end: accumulator.end,
      };
    },
    {
      open: true,
      end: operand.end,
    },
  );
  return scan.end;
}

/**
 * Parameters for {@link buildSplitFix}.
 */
export type BuildSplitFixParams = {
  /**
   * Rule context for source-text and token access.
   */
  readonly context: Context;
  /**
   * Fixer instance from the lint report callback.
   */
  readonly fixer: Fixer;
  /**
   * Counted invocation to split; guaranteed to carry a single operand.
   */
  readonly owner: SpineNode;
};

/**
 * Splits an invocation's single operand onto its own line.
 *
 * Replaces the argument-list bracket pair with a three-line form: the operand
 * indented two spaces past the head line, a trailing comma, and the closing
 * bracket dedented to the head-line indent. The operand text is sliced verbatim
 * between the located brackets, so grouping parentheses and inner formatting
 * survive; trailing line and block comments ride after the comma. Deep spines
 * converge over repeated `oxlint --fix` passes because each report splits one
 * level.
 *
 * @returns fixer replacement spanning the argument-list brackets
 *
 * @example
 * ```ts
 * // a(b(c())) becomes:
 * // a(
 * //   b(c()),
 * // )
 * buildSplitFix({ context, fixer, owner, });
 * ```
 */
export function buildSplitFix({
  context,
  fixer,
  owner,
}: BuildSplitFixParams,): ReturnType<Fixer['replaceTextRange']> {
  /**
   * Full file source text for verbatim operand slicing.
   */
  const sourceText = context.sourceCode
    .getText();
  /**
   * Raw single operand; present because the rule only reports splittable owners.
   */
  const operand = operandOrThrow(owner,);
  /**
   * Argument-list opening bracket.
   */
  const openParen = findOpenParen({
    context,
    owner,
  },);
  /**
   * Offset for the trailing comma, past operand and grouping parens.
   */
  const commaOffset = commaInsertionOffset({
    context,
    owner,
    operand,
  },);
  /**
   * Operand text including grouping parens, leading whitespace trimmed.
   */
  const headText = sourceText
    .slice(
      openParen.end,
      commaOffset,
    )
    .trim();
  /**
   * Trailing comments after the operand; the comma is placed before them.
   */
  const trailingComments = context.sourceCode
    .getCommentsInside(owner,)
    .filter(function isTrailing(comment,): boolean {
      return comment.start
        >= commaOffset;
    },);
  /**
   * Rendered trailing comment text, or empty when none follow the operand.
   */
  const commentSuffix = (trailingComments.length
      === 0)
    ? ''
    : ` ${
      trailingComments
        .map(function commentText(comment,): string {
          return sourceText.slice(
            comment.start,
            comment.end,
          );
        },)
        .join(' ',)
    }`;
  /**
   * Head-line indentation; the closing bracket returns to it.
   */
  const baseIndent = baseIndentAt({
    sourceText,
    offset: owner.start,
  },);
  /**
   * Operand-line indentation: head-line indent plus two spaces.
   */
  const childIndent = `${baseIndent}  `;
  /**
   * Multi-line argument list replacing the inline bracket pair.
   */
  const replacement =
    `(\n${childIndent}${headText},${commentSuffix}\n${baseIndent})`;
  return fixer.replaceTextRange(
    [
      openParen.start,
      owner.end,
    ],
    replacement,
  );
}
