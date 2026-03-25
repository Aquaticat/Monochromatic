/**
 * TSDoc parameter name matching and presence rules.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  extractDestructuredParamNames,
  extractDocParamNames,
  extractParamNames,
} from '../tsdoc-utils.ts';

import { createFunctionTsdocVisitor, } from './tsdoc-visitors.ts';

/**
 * Validates that `\@param` tag names match the function's actual parameter names.
 *
 * Reports mismatches, incorrect order, and `\@param` tags for nonexistent parameters.
 * Allows `\@param` tags that match property names from destructured parameters
 * (ObjectPattern/ArrayPattern), since documenting destructured properties by
 * name is a common TSDoc convention.
 *
 * @example
 * ```ts
 * // Bad -- parameter name doesn't match
 * /\** \@param x - description *\/
 * function foo(name: string): void {}
 *
 * // Good
 * /\** \@param name - description *\/
 * function foo(name: string): void {}
 *
 * // Good -- destructured property names are allowed
 * /\** \@param value - item to process *\/
 * function foo({ value }: Options): void {}
 * ```
 */
export const checkParamNames: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate that @param names match function parameter names.',
      recommended: true,
    },
    messages: {
      mismatch:
        '@param "{{docName}}" does not match parameter "{{paramName}}". For destructured parameters, document each destructured parameter.',
      extra:
        '@param "{{docName}}" does not match any function parameter. For destructured parameters, document each destructured parameter.',
      order:
        '@param tags are not in the same order as the function parameters. For destructured parameters, document each destructured parameter.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor(
      context,
      function checkParamNamesHandler(node, result,): void {
        const paramNames = extractParamNames(node,);
        const docParamNames = extractDocParamNames(result.docComment,);
        const destructuredNames = extractDestructuredParamNames(node,);

        // Check each documented param exists in the function signature
        docParamNames.forEach(function checkDocParam(docName, index,): void {
          // Allow @param tags that match destructured property names
          if (destructuredNames.has(docName,))
            return;

          const correspondingParam = paramNames[index];
          if (correspondingParam === undefined) {
            // Extra @param with no matching parameter
            if (!paramNames.includes(docName,)) {
              context.report({
                node: result.comment,
                messageId: 'extra',
                data: { docName, },
              },);
            }
            else {
              context.report({
                node: result.comment,
                messageId: 'order',
              },);
            }
          }
          else if (docName !== correspondingParam) {
            context.report({
              node: result.comment,
              messageId: 'mismatch',
              data: { docName, paramName: correspondingParam, },
            },);
          }
        },);
      },
    );
  },
};

/**
 * Requires `\@param` tags for all function parameters.
 *
 * @example
 * ```ts
 * // Bad -- missing \@param for `count`
 * /\** \@param name - user name *\/
 * function greet(name: string, count: number): void {}
 *
 * // Good
 * /\**
 *  * \@param name - user name
 *  * \@param count - greeting count
 *  *\/
 * function greet(name: string, count: number): void {}
 * ```
 */
export const requireParam: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require @param tags for all function parameters.',
      recommended: true,
    },
    messages: {
      missing: 'Missing @param tag for "{{paramName}}".',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor(
      context,
      function requireParamHandler(node, result,): void {
        const paramNames = extractParamNames(node,);
        const docParamNames = new Set(extractDocParamNames(result.docComment,),);

        paramNames.forEach(function checkParam(paramName,): void {
          if (!docParamNames.has(paramName,)) {
            context.report({
              node: result.comment,
              messageId: 'missing',
              data: { paramName, },
            },);
          }
        },);
      },
    );
  },
};

export {
  requireParamDescription,
  requireParamName,
} from './param-validation.ts';
