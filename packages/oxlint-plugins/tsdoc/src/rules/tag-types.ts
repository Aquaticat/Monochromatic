/**
 * TSDoc structural validation rule.
 *
 * `validTypes` reports structural problems found by the in-house comment
 * scanner (missing `@param` hyphen, unclosed or empty inline tags).
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  NO_TSDOC,
  parseTsdocForNode,
  shouldIgnoreFile,
} from '../tsdoc-utils.ts';

/**
 * Reports structural TSDoc problems from the in-house comment scanner.
 *
 * Catches a `\@param` tag missing its hyphen separator and malformed inline
 * tags (unclosed `{\@link`, empty `{\@link}`).
 */
export const validTypes: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report structural TSDoc problems found by the comment scanner.',
      recommended: true,
    },
    messages: {
      parseError: 'TSDoc: {{message}}',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Checks node for TSDoc parse errors.
     *
     * @param node - AST node to check
     */
    function check(node: Span,): void {
      /**
       * Parsed TSDoc result; only the `messages` field is consumed to surface structural problems.
       */
      const result = parseTsdocForNode({
        node,
        context,
      },);
      if (result === NO_TSDOC)
        return;
      result.messages
        .forEach(function reportMessage(message,): void {
        context.report({
          node: result.comment,
          messageId: 'parseError',
          data: { message: `${message.messageId}: ${message.unformattedText}`, },
        },);
      },);
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
  },
};

export { noTypes, } from './type-annotations.ts';
