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

/**
 * Result of extracting and parsing a TSDoc comment for a node.
 *
 * @example
 * ```ts
 * const result = parseTsdocForNode(node, context);
 * if (result !== undefined) {
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
function isTsdocBlock(comment: Comment,): boolean {
  return comment.type === 'Block' && comment.value.startsWith('*',);
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
  node: Span;
  /** Oxlint rule context providing sourceCode. */
  context: Context;
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
 * @returns block comment starting with `*`, or undefined when absent
 *
 * @example
 * ```ts
 * const comment = findTsdocComment({ node, context });
 * ```
 */
export function findTsdocComment({
  node,
  context,
}: TsdocLookupParams,): Comment | undefined {
  // Fast path: getCommentsBefore works for most declarations
  const comments = context.sourceCode.getCommentsBefore(node,);
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c !== undefined && isTsdocBlock(c,))
      return c;
  }

  // Only fall back for declaration-level nodes, not expressions inside them
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const nodeType = (node as unknown as Record<string, unknown>).type as
    | string
    | undefined;
  if (nodeType === undefined || !FALLBACK_ELIGIBLE_TYPES.has(nodeType,))
    return undefined;

  // Fallback: scan all comments for the closest TSDoc ending on the line
  // immediately before this node. Handles exported declarations where
  // getCommentsBefore returns nothing because the comment is before the
  // `export` keyword rather than the inner declaration.
  const nodeStartLine = node.loc.start.line;
  const allComments = context.sourceCode.getAllComments();

  let best: Comment | undefined = undefined;
  for (const candidate of allComments) {
    if (!isTsdocBlock(candidate,))
      continue;
    const candidateEndLine = candidate.loc.end.line;
    if (candidateEndLine >= nodeStartLine)
      continue;
    if (nodeStartLine - candidateEndLine > 1)
      continue;
    if (best === undefined || candidate.loc.end.line > best.loc.end.line)
      best = candidate;
  }

  return best;
}

/**
 * Extracts and parses the TSDoc comment for a given AST node.
 *
 * @returns parsed result, or undefined when no TSDoc comment precedes the node
 *
 * @example
 * ```ts
 * const result = parseTsdocForNode({ node, context });
 * if (result === undefined) return;
 * for (const message of result.messages) {
 *   context.report({ node, message: message.toString() });
 * }
 * ```
 */
export function parseTsdocForNode({
  node,
  context,
}: TsdocLookupParams,): TsdocParseResult | undefined {
  const comment = findTsdocComment({
    node,
    context,
  },);
  if (comment === undefined)
    return undefined;

  // Reconstruct full comment text as the parser expects `/** ... */`
  const commentText = `/*${comment.value}*/`;
  const parserContext = tsdocParser.parseString(commentText,);

  return {
    comment,
    parserContext,
    docComment: parserContext.docComment,
    messages: parserContext.log.messages,
  };
}
