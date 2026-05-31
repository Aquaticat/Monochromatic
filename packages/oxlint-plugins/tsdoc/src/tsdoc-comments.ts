/**
 * TSDoc comment discovery and parsing utilities.
 *
 * Extracted from `tsdoc-utils.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import {
  type DocComment,
  type ParserContext,
  type ParserMessage,
  TSDocConfiguration,
  TSDocParser,
} from '@microsoft/tsdoc';

import type {
  Comment,
  Context,
  Span,
} from '@oxlint/plugins';
import type { ReadonlyDeep, } from 'type-fest';

/**
 * Absence marker meaning "node has no TSDoc comment"; never a real comment
 * or parse result.
 *
 * Shared by {@link findTsdocComment} and {@link parseTsdocForNode} because the
 * parse-absence is derived directly from the find-absence (the parser only
 * runs once a comment exists); both narrow with `=== NO_TSDOC`. Optionality
 * discipline bans `T | undefined` returns, so these functions return
 * `T | typeof NO_TSDOC` instead.
 *
 * @example
 * ```ts
 * const found = findTsdocComment({ node, context, });
 * if (found === NO_TSDOC)
 *   return;
 * ```
 */
export const NO_TSDOC: unique symbol = Symbol('tsdoc/no-tsdoc',);

/**
 * Result of extracting and parsing a TSDoc comment for a node.
 *
 * @example
 * ```ts
 * const result = parseTsdocForNode(node, context);
 * if (result !== NO_TSDOC) {
 *   console.log(result.docComment.summarySection);
 * }
 * ```
 */
export type TsdocParseResult = {
  /** Raw block comment AST node from oxlint. */
  readonly comment: Comment;
  /** Parsed TSDoc context containing docComment, messages, and tokens. */
  readonly parserContext: ParserContext;
  /** Convenience alias for parserContext.docComment. */
  readonly docComment: DocComment;
  /** Convenience alias for parserContext.log.messages. */
  readonly messages: readonly ParserMessage[];
};

/** Shared TSDoc parser configuration with all standard tags. */
const tsdocConfiguration: TSDocConfiguration = new TSDocConfiguration();

/** Shared TSDoc parser instance reused across all rule invocations. */
const tsdocParser: TSDocParser = new TSDocParser(tsdocConfiguration,);

/**
 * Checks whether a block comment is a TSDoc comment (starts with `*`).
 *
 * @param comment - AST comment node
 *
 * @returns true for `/** ... *\/` style comments
 */
function isTsdocBlock(comment: ReadonlyDeep<Comment>,): boolean {
  return (comment.type === 'Block')
    && comment.value
    .startsWith('*',);
}

/**
 * Node types where `getCommentsBefore` may fail to find TSDoc because
 * the comment is attached to a parent scope (export declaration).
 *
 * FunctionExpression and ArrowFunctionExpression are intentionally
 * excluded because their comments belong to the enclosing
 * VariableDeclaration or MethodDefinition which owns the TSDoc.
 */
export const FALLBACK_ELIGIBLE_TYPES: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'VariableDeclaration',
  'ClassDeclaration',
  'MethodDefinition',
  'TSAbstractMethodDefinition',
  'PropertyDefinition',
  'TSEnumDeclaration',
  'TSEnumMember',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
],);

/**
 * Parameters for {@link findTsdocComment} and {@link parseTsdocForNode}.
 */
export type TsdocLookupParams = {
  /** AST node to find TSDoc for. */
  readonly node: Span;
  /** Oxlint rule context providing sourceCode. */
  readonly context: Context;
};

/**
 * Finds the TSDoc block comment associated with a node.
 *
 * Uses `getCommentsBefore` first (cheapest lookup), then falls back to
 * scanning `getAllComments()` for the closest preceding TSDoc comment
 * whose end position is on the line immediately before the node start.
 * This fallback handles `export` declarations where `getCommentsBefore`
 * returns nothing because the comment is attached to a parent
 * ExportNamedDeclaration scope boundary.
 *
 * The fallback only applies to declaration-level node types, not to
 * FunctionExpression or ArrowFunctionExpression, because their TSDoc
 * is owned by the enclosing VariableDeclaration or MethodDefinition.
 *
 * @returns block comment starting with `*`, or {@link NO_TSDOC} when none precedes the node
 *
 * @example
 * ```ts
 * const comment = findTsdocComment({ node, context });
 * ```
 */
export function findTsdocComment({
  node,
  context,
}: TsdocLookupParams,): Comment | typeof NO_TSDOC {
  // Fast path: getCommentsBefore works for most declarations
  /** Leading comments returned by the standard API; scanned back-to-front for nearest TSDoc. */
  const comments = context.sourceCode
    .getCommentsBefore(node,);
  for (let i = comments.length
    - 1; i >= 0; i--) {
    /** Single comment candidate at index `i`; checked for the TSDoc block marker. */
    const c = comments[i];
    if ((c !== undefined) && isTsdocBlock(c,))
      return c;
  }

  // Only fall back for declaration-level nodes, not expressions inside them
  /** Node type string; gates whether the slow whole-file fallback is allowed. */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const nodeType = (node as unknown as Record<string, unknown>).type;
  if (((typeof nodeType)
    !== 'string') || (!FALLBACK_ELIGIBLE_TYPES.has(nodeType,)))
    return NO_TSDOC;

  // Fallback: scan all comments for the closest TSDoc ending on the line
  // immediately before this node. Handles exported declarations where
  // getCommentsBefore returns nothing because the comment is before the
  // `export` keyword rather than the inner declaration.
  /** Starting line of the declaration; comments must end exactly one line above. */
  const nodeStartLine = node.loc
    .start
    .line;
  /** Full comment table for the file; needed because `getCommentsBefore` misses cross-scope ones. */
  const allComments = context.sourceCode
    .getAllComments();

  /** Closest TSDoc comment found so far, tracked as the loop scans the whole comment table. */
  let best: Comment | typeof NO_TSDOC = NO_TSDOC;
  for (const candidate of allComments) {
    if (!isTsdocBlock(candidate,))
      continue;
    /** End line of the candidate comment; must immediately precede `nodeStartLine`. */
    const candidateEndLine = candidate.loc
      .end
      .line;
    if (candidateEndLine >= nodeStartLine)
      continue;
    if ((nodeStartLine - candidateEndLine) > 1)
      continue;
    if ((best === NO_TSDOC) || (candidate.loc
      .end
      .line
      > best
      .loc
      .end
      .line))
      best = candidate;
  }

  return best;
}

/**
 * Extracts and parses the TSDoc comment for a given AST node.
 *
 * @returns parsed result, or {@link NO_TSDOC} when no TSDoc comment precedes the node
 *
 * @example
 * ```ts
 * const result = parseTsdocForNode({ node, context });
 * if (result === NO_TSDOC) return;
 * for (const message of result.messages) {
 *   context.report({ node, message: message.toString() });
 * }
 * ```
 */
export function parseTsdocForNode({
  node,
  context,
}: TsdocLookupParams,): TsdocParseResult | typeof NO_TSDOC {
  /** Located TSDoc comment for the node; absent means nothing to parse. */
  const comment = findTsdocComment({
    node,
    context,
  },);
  if (comment === NO_TSDOC)
    return NO_TSDOC;

  // Reconstruct full comment text as the parser expects `/** ... */`
  /** Reconstructed `/* ... *\/` form because `comment.value` strips the delimiters. */
  const commentText = `/*${comment.value}*/`;
  /** Parser run state; holds the doc tree plus log messages forwarded to the rule. */
  const parserContext = tsdocParser.parseString(commentText,);

  return {
    comment,
    parserContext,
    docComment: parserContext.docComment,
    messages: parserContext.log
      .messages,
  };
}
