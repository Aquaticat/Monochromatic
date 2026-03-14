/**
 * TSDoc type annotation and parse error validation rules.
 *
 * `validTypes` reports TSDoc parser errors; `noTypes` disallows
 * JSDoc-style `{Type}` annotations in TypeScript TSDoc comments.
 *
 * @module
 */

import type {
  Comment,
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  findTsdocComment,
  parseTsdocForNode,
  shouldIgnoreFile,
} from '../tsdoc-utils.ts';

/** Regex matching a TSDoc block comment line prefix ` * `. */
const COMMENT_LINE_PREFIX = /^ *\*/;

/**
 * Creates a visitor for all documentable nodes, calling handler with TSDoc comment.
 *
 * @param context - oxlint rule context
 *
 * @param handler - invoked for each (node, comment) pair where TSDoc exists
 *
 * @returns visitor with hooks
 */
function createTsdocVisitor(
  context: Context,
  handler: (node: Span, comment: Comment) => void,
): VisitorWithHooks {
  /**
   * Checks node for TSDoc and fires handler.
   *
   * @param node - AST node to check
   */
  function check(node: Span): void {
    const comment = findTsdocComment(node, context);
    if (comment !== undefined) {
      handler(node, comment);
    }
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
  return {
    before() {
      if (shouldIgnoreFile(context.filename)) {
        return false;
      }
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
    Property(node): void {
      if (node.kind === 'get' || node.kind === 'set') {
        check(node);
      }
    },
  } as VisitorWithHooks;
}

/**
 * Reports TSDoc parse errors from the microsoft/tsdoc parser.
 *
 * Catches syntax errors, malformed inline tags, broken link references,
 * and other structural issues the parser detects.
 */
export const validTypes: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report TSDoc syntax errors detected by the TSDoc parser.',
      recommended: true,
    },
    messages: {
      parseError: 'TSDoc: {{message}}',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    /**
     * Checks node for TSDoc parse errors.
     *
     * @param node - AST node to check
     */
    function check(node: Span): void {
      const result = parseTsdocForNode(node, context);
      if (result === undefined) {
        return;
      }
      result.messages.forEach(function reportMessage(message): void {
        context.report({
          node: result.comment,
          messageId: 'parseError',
          data: { message: `${message.messageId}: ${message.unformattedText}` },
        });
      });
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      before() {
        if (shouldIgnoreFile(context.filename)) {
          return false;
        }
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
      Property(node): void {
        if (node.kind === 'get' || node.kind === 'set') {
          check(node);
        }
      },
    } as VisitorWithHooks;
  },
};

/**
 * Disallows type annotations in TSDoc tags.
 *
 * In TypeScript projects, types are expressed via type annotations, not JSDoc-style
 * `{Type}` syntax. Reports param/returns with `{Type}` syntax.
 */
export const noTypes: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow JSDoc-style type annotations in TSDoc comments.',
      recommended: true,
    },
    messages: {
      noType: 'Type annotations in TSDoc are not allowed in TypeScript. Remove the "{{{type}}}" type.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    /** Regex detecting JSDoc-style type annotations like `{Type}` after a tag. */
    const typePattern = /@\w+\s+\{([^}]+)\}/g;

    return createTsdocVisitor(context, function noTypesHandler(_node, comment): void {
      const lines = comment.value.split('\n');
      lines.forEach(function checkLine(line, index): void {
        const trimmed = line.trimStart().replace(COMMENT_LINE_PREFIX, '').trimStart();
        // Reset regex state
        typePattern.lastIndex = 0;
        let match = typePattern.exec(trimmed);
        while (match !== null) {
          context.report({
            loc: {
              start: { line: comment.loc.start.line + index, column: 0 },
            },
            messageId: 'noType',
            data: { type: match[1] ?? 'unknown' },
          });
          match = typePattern.exec(trimmed);
        }
      });
    });
  },
};
