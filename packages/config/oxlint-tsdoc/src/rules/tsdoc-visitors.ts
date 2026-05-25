/**
 * Shared TSDoc visitor factories for oxlint rule implementations.
 *
 * Provides reusable visitor constructors so each rule file
 * does not duplicate the node-type enumeration boilerplate.
 *
 * @module
 */

import type {
  Comment,
  Context,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  findTsdocComment,
  parseTsdocForNode,
  shouldIgnoreFile,
  type TsdocParseResult,
} from '../tsdoc-utils.ts';

/**
 * Strips the leading `*` marker from a TSDoc block-comment line whose
 * indentation has already been removed by `String.prototype.trimStart`.
 *
 * Returns the input verbatim when the line does not begin with `*`,
 * matching the prior leading-asterisk strip on a trimmed line (the
 * indentation spaces are already gone so the only meaningful match is
 * a single asterisk at index 0).
 *
 * @param s - line text after `trimStart`
 *
 * @returns line text with the leading `*` removed if present
 *
 * @example
 * ```ts
 * stripCommentLineMarker('* @param x foo'); // '@param x foo'
 * stripCommentLineMarker('@param x foo'); // '@param x foo'
 * ```
 */
export function stripCommentLineMarker(s: string,): string {
  return s.startsWith('*',) ? s.slice(1,) : s;
}

/**
 * Splits a block comment value into its constituent lines.
 *
 * @param comment - block comment AST node
 *
 * @returns array of lines (without the opening `/*` and closing `*\/`)
 *
 * @example
 * ```ts
 * const lines = getCommentLines(commentNode);
 * ```
 */
export function getCommentLines(comment: Comment,): readonly string[] {
  return comment.value
    .split('\n',);
}

/**
 * Parameters for {@link createTsdocVisitor}.
 */
export type CreateTsdocVisitorParams = {
  /** Oxlint rule context. */
  context: Context;
  /** Invoked for each (node, comment) pair. */
  handler: (
    node: Span,
    comment: Comment,
  ) => void;
};

/**
 * Creates a visitor that iterates over all documentable node types
 * and calls the provided handler when a TSDoc comment is found.
 *
 * @returns visitor with hooks
 *
 * @example
 * ```ts
 * return createTsdocVisitor({
 *   context,
 *   handler: function handleDoc(node, comment) {
 *     // process TSDoc comment
 *   },
 * });
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
    /** Located TSDoc comment for the node; only when present does the handler fire. */
    const comment = findTsdocComment({
      node,
      context,
    },);
    if (comment !== undefined) {
      handler(
        node,
        comment,
      );
    }
  }

  return {
    before() {
      if (shouldIgnoreFile(context.filename,))
        return false;
      return undefined;
    },
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
 * Parameters for {@link createFunctionTsdocVisitor}.
 */
export type CreateFunctionTsdocVisitorParams = {
  /** Oxlint rule context. */
  context: Context;
  /** Invoked with node and parsed TSDoc for each function-like node. */
  handler: (
    node: Span & Record<string, unknown>,
    result: TsdocParseResult,
  ) => void;
};

/**
 * Creates a visitor for function-like nodes that have TSDoc comments.
 *
 * Covers FunctionDeclaration, FunctionExpression, ArrowFunctionExpression,
 * and MethodDefinition. Parses the TSDoc comment before invoking the handler.
 *
 * @returns visitor with hooks
 *
 * @example
 * ```ts
 * return createFunctionTsdocVisitor({
 *   context,
 *   handler: function handleFn(node, result) {
 *     // check function TSDoc
 *   },
 * });
 * ```
 */
export function createFunctionTsdocVisitor({
  context,
  handler,
}: CreateFunctionTsdocVisitorParams,): VisitorWithHooks {
  /**
   * Checks a function-like node for TSDoc and invokes handler.
   *
   * @param node - AST node to check
   */
  function check(node: Span,): void {
    /** Parsed TSDoc bundle for the node; absent means no TSDoc and the handler is skipped. */
    const result = parseTsdocForNode({
      node,
      context,
    },);
    if (result === undefined)
      return;
    /** Narrowed view that exposes the host AST's untyped extra properties to the handler. */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
    const typedNode = node as Span & Record<string, unknown>;
    handler(
      typedNode,
      result,
    );
  }

  /** Visitor object built up before the unsafe cast that satisfies the host's index-signature type. */
  const visitor = {
    before() {
      if (shouldIgnoreFile(context.filename,))
        return false;
      return undefined;
    },
    FunctionDeclaration: check,
    FunctionExpression: check,
    ArrowFunctionExpression: check,
    MethodDefinition: check,
  } as VisitorWithHooks;
  return visitor;
}
