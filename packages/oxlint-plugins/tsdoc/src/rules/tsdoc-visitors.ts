/**
 * Shared TSDoc visitor factories for oxlint rule implementations.
 *
 * Provides reusable visitor constructors so each rule file does not duplicate
 * node-type enumeration, ignored-file preambles, or comment location arithmetic.
 *
 * @module
 */

import type {
  Comment,
  Context,
  LineColumn,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ReadonlyDeep, } from 'type-fest';

import type { ReadonlyRecord, } from '../ast-access.ts';
import {
  findTsdocComment,
  NO_TSDOC,
  parseTsdocForNode,
  shouldIgnoreFile,
  type TsdocParseResult,
} from '../tsdoc-utils.ts';

export {
  getCommentLines,
  stripCommentLineMarker,
} from '../comment-text.ts';

/**
 * Function that skips an ignored file before a visitor starts.
 */
export type IgnoredFileBeforeHook = () => false | undefined;

/**
 * Parameters for {@link ignoredFileBeforeHook}.
 */
export type IgnoredFileBeforeHookParams = {
  /**
   * Oxlint rule context carrying filename.
   */
  readonly context: Context;
};

/**
 * Parameters for {@link commentLineReportLoc}.
 */
export type CommentLineReportLocParams = {
  /**
   * TSDoc comment whose start line anchors the diagnostic.
   */
  readonly comment: ReadonlyDeep<Comment>;
  /**
   * Zero-based line offset from the comment start line.
   */
  readonly lineOffset: number;
  /**
   * Report column, defaulting to the start of the line.
   */
  readonly column?: number;
};

/**
 * Parameters for documentable-node visitor construction.
 */
type CreateDocumentableVisitorParams = {
  /**
   * Oxlint rule context.
   */
  readonly context: Context;
  /**
   * Invoked for each documentable node type.
   */
  readonly check: (node: Span) => void;
};

/**
 * Returns a `before` hook that skips files excluded from TSDoc validation.
 *
 * @param params - rule context carrying current filename
 *
 * @returns visitor before hook
 *
 * @example
 * ```ts
 * return { before: ignoredFileBeforeHook({ context }) };
 * ```
 */
export function ignoredFileBeforeHook({
  context,
}: IgnoredFileBeforeHookParams,): IgnoredFileBeforeHook {
  return function beforeIgnoredFile(): false | undefined {
    if (shouldIgnoreFile(context.filename,))
      return false;
    return undefined;
  };
}

/**
 * Builds a fresh report location from a comment's span.
 *
 * `context.report` needs a mutable `Ranged` / location, but rule handlers
 * receive deeply-readonly comments; copying the numeric positions into a
 * new object crosses that readonly boundary without an assertion.
 *
 * @param comment - TSDoc comment whose span locates the diagnostic
 *
 * @returns location object accepted by `context.report({ loc })`
 *
 * @example
 * ```ts
 * context.report({ loc: commentReportLoc(comment), messageId: 'x' });
 * ```
 */
export function commentReportLoc(comment: ReadonlyDeep<Comment>,): {
  start: LineColumn;
  end: LineColumn;
} {
  return {
    start: {
      line: comment.loc
        .start
        .line,
      column: comment.loc
        .start
        .column,
    },
    end: {
      line: comment.loc
        .end
        .line,
      column: comment.loc
        .end
        .column,
    },
  };
}

/**
 * Builds a report location anchored to one line inside a comment.
 *
 * @param params - comment, relative line offset, and optional column
 *
 * @returns location object with a copied mutable start position
 *
 * @example
 * ```ts
 * context.report({ loc: commentLineReportLoc({ comment, lineOffset: index }) });
 * ```
 */
export function commentLineReportLoc({
  comment,
  lineOffset,
  column = 0,
}: CommentLineReportLocParams,): { start: LineColumn; } {
  return {
    start: {
      line: comment.loc
        .start
        .line
        + lineOffset,
      column,
    },
  };
}

/**
 * Creates a visitor over every documentable node type.
 *
 * @param params - rule context and per-node callback
 *
 * @returns visitor with ignored-file preamble and node handlers
 *
 * @example
 * ```ts
 * createDocumentableVisitor({ context, check });
 * ```
 */
function createDocumentableVisitor({
  context,
  check,
}: CreateDocumentableVisitorParams,): VisitorWithHooks {
  return {
    before: ignoredFileBeforeHook({ context, },),
    FunctionDeclaration: check,
    FunctionExpression: check,
    ArrowFunctionExpression: check,
    ClassDeclaration: check,
    MethodDefinition: check,
    TSInterfaceDeclaration: check,
    TSTypeAliasDeclaration: check,
    TSEnumDeclaration: check,
    VariableDeclaration: check,
    PropertyDefinition: check,
    TSEnumMember: check,
    Property(node,): void {
      if ((node.kind
        === 'get') || (node.kind
          === 'set'))
        check(node,);
    },
  } as VisitorWithHooks;
}

/**
 * Parameters for {@link createTsdocVisitor}.
 */
export type CreateTsdocVisitorParams = {
  /**
   * Oxlint rule context.
   */
  readonly context: Context;
  /**
   * Invoked for each (node, comment) pair.
   */
  readonly handler: (
    node: Span,
    comment: ReadonlyDeep<Comment>,
  ) => void;
};

/**
 * Creates a visitor that iterates over all documentable node types and calls
 * the provided handler when a TSDoc comment is found.
 *
 * @param params - rule context and comment handler
 *
 * @returns visitor with hooks
 *
 * @example
 * ```ts
 * return createTsdocVisitor({ context, handler });
 * ```
 */
export function createTsdocVisitor({
  context,
  handler,
}: CreateTsdocVisitorParams,): VisitorWithHooks {
  /**
   * Checks node and fires handler when TSDoc exists.
   *
   * @param node - AST node to check
   */
  function check(node: Span,): void {
    /**
     * Located TSDoc comment for the node; only when present does the handler fire.
     */
    const comment = findTsdocComment({
      node,
      context,
    },);
    if (comment !== NO_TSDOC) {
      handler(
        node,
        comment,
      );
    }
  }

  return createDocumentableVisitor({
    context,
    check,
  },);
}

/**
 * Parameters for {@link createParsedTsdocVisitor}.
 */
export type CreateParsedTsdocVisitorParams = {
  /**
   * Oxlint rule context.
   */
  readonly context: Context;
  /**
   * Invoked with node and parsed TSDoc for each documentable node.
   */
  readonly handler: (
    node: Span,
    result: ReadonlyDeep<TsdocParseResult>,
  ) => void;
};

/**
 * Creates a visitor over every documentable node and supplies parsed TSDoc.
 *
 * @param params - rule context and parsed-comment handler
 *
 * @returns visitor with hooks
 *
 * @example
 * ```ts
 * return createParsedTsdocVisitor({ context, handler });
 * ```
 */
export function createParsedTsdocVisitor({
  context,
  handler,
}: CreateParsedTsdocVisitorParams,): VisitorWithHooks {
  /**
   * Checks node and fires handler when parsed TSDoc exists.
   *
   * @param node - AST node to check
   */
  function check(node: Span,): void {
    /**
     * Parsed TSDoc bundle for the node; absent means no TSDoc and the handler is skipped.
     */
    const result = parseTsdocForNode({
      node,
      context,
    },);
    if (result === NO_TSDOC)
      return;
    handler(
      node,
      result,
    );
  }

  return createDocumentableVisitor({
    context,
    check,
  },);
}

/**
 * Parameters for {@link createFunctionTsdocVisitor}.
 */
export type CreateFunctionTsdocVisitorParams = {
  /**
   * Oxlint rule context.
   */
  readonly context: Context;
  /**
   * Whether arrow functions should be visited.
   */
  readonly includeArrowFunctions?: boolean;
  /**
   * Invoked with node and parsed TSDoc for each function-like node.
   */
  readonly handler: (
    node: Span & ReadonlyRecord,
    result: ReadonlyDeep<TsdocParseResult>,
  ) => void;
};

/**
 * Creates a visitor for function-like nodes that have TSDoc comments.
 *
 * Covers FunctionDeclaration, FunctionExpression, ArrowFunctionExpression,
 * and MethodDefinition by default. Callers whose rule cannot apply to arrow
 * functions can pass `includeArrowFunctions: false`.
 *
 * @param params - rule context, arrow-function toggle, and parsed-comment handler
 *
 * @returns visitor with hooks
 *
 * @example
 * ```ts
 * return createFunctionTsdocVisitor({ context, handler });
 * ```
 */
export function createFunctionTsdocVisitor({
  context,
  includeArrowFunctions = true,
  handler,
}: CreateFunctionTsdocVisitorParams,): VisitorWithHooks {
  /**
   * Checks a function-like node for TSDoc and invokes handler.
   *
   * @param node - AST node to check
   */
  function check(node: Span,): void {
    /**
     * Parsed TSDoc bundle for the node; absent means no TSDoc and the handler is skipped.
     */
    const result = parseTsdocForNode({
      node,
      context,
    },);
    if (result === NO_TSDOC)
      return;
    /**
     * Narrowed view that exposes the host AST's untyped extra properties to the handler.
     */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const typedNode = node as Span & Record<string, unknown>;
    handler(
      typedNode,
      result,
    );
  }

  /**
   * Visitor object built before the unsafe cast that satisfies the host's index-signature type.
   */
  const visitor = {
    before: ignoredFileBeforeHook({ context, },),
    FunctionDeclaration: check,
    FunctionExpression: check,
    ...includeArrowFunctions
      ? { ArrowFunctionExpression: check, }
      : {},
    MethodDefinition: check,
  } as VisitorWithHooks;
  return visitor;
}
