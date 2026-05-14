/**
 * TSDoc parse error validation rule.
 *
 * `validTypes` reports TSDoc parser errors detected by the microsoft/tsdoc parser.
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
  parseTsdocForNode,
  shouldIgnoreFile,
} from '../tsdoc-utils.ts';

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
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Checks node for TSDoc parse errors.
     *
     * @param node - AST node to check
     */
    function check(node: Span,): void {
      /** Parsed TSDoc result; only the `messages` field is consumed to surface parser errors. */
      const result = parseTsdocForNode({
        node,
        context,
      },);
      if (result === undefined)
        return;
      result.messages.forEach(function reportMessage(message,): void {
        context.report({
          node: result.comment,
          messageId: 'parseError',
          data: { message: `${message.messageId}: ${message.unformattedText}`, },
        },);
      },);
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
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
        if (node.kind === 'get' || node.kind === 'set')
          check(node,);
      },
    } as VisitorWithHooks;
  },
};

export { noTypes, } from './type-annotations.ts';
