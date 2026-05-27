import type {
  Context,
  CreateOnceRule,
  Node,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  checkTrailingComma,
  lastEnumMember,
  lastFieldNode,
  lastImportExpressionItem,
  lastNamedImportSpecifier,
} from '../utility/comma-dangle.ts';

/**
 * Requires trailing commas at every supported comma-delimited list tail.
 *
 * This mirrors `@stylistic/comma-dangle` in its plain `"always"` behavior
 * without exposing configuration. Empty lists are ignored, and final rest
 * elements are ignored because JavaScript grammar rejects a comma after them.
 *
 * @example
 * ```ts
 * // Bad
 * const value = [one];
 * function read(value: string): void {}
 *
 * // Good
 * const value = [one,];
 * function read(value: string,): void {}
 * ```
 */
export const commaDangle: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'code',
    schema: [],
    docs: {
      description: 'Require trailing commas in supported comma-delimited lists.',
      recommended: true,
    },
    messages: {
      missingComma: 'Missing trailing comma.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Checks array element lists and array-pattern element lists.
     *
     * @param node - array-like container node
     */
    function checkElements(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'elements',
        },),
        useContainerPenultimateToken: true,
      },);
    }

    /**
     * Checks object property lists and object-pattern property lists.
     *
     * @param node - object-like container node
     */
    function checkProperties(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'properties',
        },),
        useContainerPenultimateToken: true,
      },);
    }

    /**
     * Checks call or constructor arguments.
     *
     * @param node - call-like node
     */
    function checkArguments(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'arguments',
        },),
        useContainerPenultimateToken: true,
      },);
    }

    /**
     * Checks function-like parameter lists.
     *
     * @param node - function-like node
     */
    function checkParams(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'params',
        },),
      },);
    }

    /**
     * Checks import specifiers and import attributes.
     *
     * @param node - import declaration node
     */
    function checkImportDeclaration(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastNamedImportSpecifier(node,),
      },);
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'attributes',
        },),
      },);
    }

    /**
     * Checks export specifiers and import attributes.
     *
     * @param node - export named declaration node
     */
    function checkExportNamedDeclaration(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'specifiers',
        },),
      },);
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'attributes',
        },),
      },);
    }

    /**
     * Checks export-all import attributes.
     *
     * @param node - export all declaration node
     */
    function checkExportAllDeclaration(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'attributes',
        },),
      },);
    }

    /**
     * Checks dynamic import arguments.
     *
     * @param node - dynamic import expression node
     */
    function checkImportExpression(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastImportExpressionItem(node,),
        useContainerPenultimateToken: true,
      },);
    }

    /**
     * Checks enum body members.
     *
     * @param node - enum declaration node
     */
    function checkEnumDeclaration(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastEnumMember(node,),
      },);
    }

    /**
     * Checks type parameter declarations.
     *
     * @param node - type parameter declaration node
     */
    function checkTypeParameters(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'params',
        },),
      },);
    }

    /**
     * Checks tuple element types.
     *
     * @param node - tuple type node
     */
    function checkTupleElements(node: Node,): void {
      checkTrailingComma({
        context,
        container: node,
        lastItem: lastFieldNode({
          node,
          fieldName: 'elementTypes',
        },),
      },);
    }

    return {
      ArrayExpression: checkElements,
      ObjectExpression: checkProperties,
      ArrayPattern: checkElements,
      ObjectPattern: checkProperties,
      ImportDeclaration: checkImportDeclaration,
      ExportNamedDeclaration: checkExportNamedDeclaration,
      ExportAllDeclaration: checkExportAllDeclaration,
      FunctionDeclaration: checkParams,
      FunctionExpression: checkParams,
      ArrowFunctionExpression: checkParams,
      CallExpression: checkArguments,
      NewExpression: checkArguments,
      ImportExpression: checkImportExpression,
      TSEnumDeclaration: checkEnumDeclaration,
      TSTypeParameterDeclaration: checkTypeParameters,
      TSTupleType: checkTupleElements,
      TSDeclareFunction: checkParams,
      TSEmptyBodyFunctionExpression: checkParams,
      TSFunctionType: checkParams,
      TSMethodSignature: checkParams,
      TSCallSignatureDeclaration: checkParams,
      TSConstructSignatureDeclaration: checkParams,
      TSConstructorType: checkParams,
    };
  },
};
