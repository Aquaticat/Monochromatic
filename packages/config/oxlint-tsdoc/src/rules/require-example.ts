/**
 * TSDoc require-example rule for exported functions.
 *
 * Reports when an exported function's TSDoc comment lacks an `\@example` tag.
 * Functions with `\@inheritDoc` or `\@internal` are exempt since their
 * documentation is inherited or intentionally hidden.
 *
 * Handles both direct exports (`export function foo()`) and
 * specifier-list exports (`export { foo }`).
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
  type TsdocParseResult,
} from '../tsdoc-utils.ts';

import { extractNodeName, } from './node-extraction.ts';

/**
 * TSDoc standard tag name for `\@example`.
 */
const EXAMPLE_TAG_NAME = '@example';

/**
 * TSDoc standard tag name for `\@internal`.
 */
const INTERNAL_TAG_NAME = '@internal';

/**
 * Checks whether a node is directly exported via inline `export` keyword.
 *
 * Detects `export function`, `export const`, and `export default`
 * by inspecting the parent node type.
 *
 * @param node - AST node to check
 *
 * @returns true when the node's parent is an export declaration
 */
function isDirectlyExported(node: Span,): boolean {
  /** Narrowed view of `node` that exposes the untyped `parent` property added by the host. */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const typed = node as Span & Record<string, unknown>;
  /** Parent node, used to detect whether the function sits under an `export` declaration. */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
  const parent = typed.parent as Record<string, unknown> | undefined;
  if (parent === undefined)
    return false;
  return (parent.type
    === 'ExportNamedDeclaration')
    || (parent.type
      === 'ExportDefaultDeclaration');
}

/**
 * Checks whether a TSDoc comment contains an `\@example` block tag.
 *
 * `\@example` is stored in `docComment.customBlocks` by the
 * `\@microsoft/tsdoc` parser rather than as a dedicated property.
 *
 * @param result - parsed TSDoc result
 *
 * @returns true when at least one `\@example` block exists
 */
function hasExampleTag(result: TsdocParseResult,): boolean {
  return result.docComment
    .customBlocks
    .some(
    function isExample(block,): boolean {
      return block.blockTag.tagName === EXAMPLE_TAG_NAME;
    },
  );
}

/**
 * Checks whether a TSDoc comment is exempt from requiring `\@example`.
 *
 * Exempt when the comment uses `\@inheritDoc` (documentation comes from
 * the referenced symbol) or `\@internal` (not part of public API docs).
 *
 * @param result - parsed TSDoc result
 *
 * @returns true when the comment should be skipped
 */
function isExempt(result: TsdocParseResult,): boolean {
  if (result.docComment
    .inheritDocTag
    !== undefined)
    return true;
  return result.docComment
    .modifierTagSet
    .hasTagName(INTERNAL_TAG_NAME,);
}

/**
 * Requires `\@example` tags on exported functions.
 *
 * Targets both directly exported functions (`export function foo()`)
 * and functions exported via specifier lists (`export { foo }`).
 * Class methods, non-exported functions, type aliases, and constants
 * are not checked.
 *
 * @example
 * ```ts
 * // Bad; exported function without \@example
 * /\** Adds two numbers. *\/
 * export function add(a: number, b: number): number { return a + b; }
 *
 * // Good
 * /\**
 *  * Adds two numbers.
 *  *
 *  * \@example
 *  * ```ts
 *  * add(1, 2); // => 3
 *  * ```
 *  *\/
 * export function add(a: number, b: number): number { return a + b; }
 * ```
 */
export const requireExample: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require @example tag on exported functions.',
      recommended: true,
    },
    messages: {
      missing: 'Exported function is missing an @example tag in its TSDoc comment.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Deferred checks for functions that may be exported via specifier lists.
     * Maps declaration name to the AST node and its TSDoc comment.
     */
    const functionNodes = new Map<string, {
      node: Span;
      comment: Comment;
    }>();

    /** Names exported via `export { name }` specifier lists. */
    const specifierExportedNames = new Set<string>();

    /**
     * Reports a missing `\@example` tag for a given node and its TSDoc comment.
     */
    function reportMissingExample({
      node,
      comment,
    }: {
      /** Function-like AST node. */
      node: Span;
      /** TSDoc comment AST node for error location. */
      comment: Comment;
    },): void {
      /** Parsed TSDoc result; undefined when the comment cannot be parsed at all. */
      const result = parseTsdocForNode({
        node,
        context,
      },);
      if (result === undefined)
        return;
      if (isExempt(result,))
        return;
      if (!hasExampleTag(result,)) {
        context.report({
          node: comment,
          messageId: 'missing',
        },);
      }
    }

    /**
     * Checks a function-like node: reports immediately for direct exports,
     * or defers to after-pass for specifier-list exports.
     *
     * @param node - AST node to check
     */
    function checkFunction(node: Span,): void {
      /** Attached TSDoc comment, when present; absent means nothing to validate. */
      const comment = findTsdocComment({
        node,
        context,
      },);
      if (comment === undefined)
        return;

      if (isDirectlyExported(node,)) {
        reportMissingExample({
          node,
          comment,
        },);
        return;
      }

      // Defer: might be exported via `export { name }` seen later
      /** Identifier of the function, used to match later `export { name }` specifiers. */
      const name = extractNodeName(node,);
      if (name !== 'anonymous') {
        functionNodes.set(
          name,
          {
            node,
            comment,
          },
        );
      }
    }

    /**
     * Checks a VariableDeclaration whose init is a function expression
     * or arrow function. Only the variable name is registered since the
     * TSDoc comment is attached to the VariableDeclaration, not the inner
     * function expression.
     *
     * @param node - VariableDeclaration AST node
     */
    function checkVariable(node: Span,): void {
      /** Narrowed view of the VariableDeclaration so untyped `declarations` is reachable. */
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const typed = node as Span & Record<string, unknown>;
      /** Declarator list; for `const a = ..., b = ...` only the first is inspected. */
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const declarations = typed.declarations as Record<string, unknown>[] | undefined;
      if ((declarations === undefined) || (declarations.length
        === 0))
        return;

      /** First declarator; destructured here so its `init` can be inspected below. */
      const [decl,] = declarations;
      if (decl === undefined)
        return;

      // Only check variables whose init is a function expression or arrow.
      // AST uses null (not undefined) for missing initializers (e.g. for-of bindings).
      /** Initializer of the first declarator; `null` for empty bindings, undefined absent. */
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const init = decl.init as Record<string, unknown> | null | undefined;
      if ((init === undefined) || (init === null))
        return;
      if ((init.type
        !== 'FunctionExpression')
        && (init.type
          !== 'ArrowFunctionExpression'))
      {
        return;
      }

      /** Attached TSDoc comment for the variable; absent means nothing to validate. */
      const comment = findTsdocComment({
        node,
        context,
      },);
      if (comment === undefined)
        return;

      if (isDirectlyExported(node,)) {
        reportMissingExample({
          node,
          comment,
        },);
        return;
      }

      // Defer for specifier-list exports
      /** Declared variable name, used to match later `export { name }` specifiers. */
      const name = extractNodeName(node,);
      if (name !== 'anonymous') {
        functionNodes.set(
          name,
          {
            node,
            comment,
          },
        );
      }
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      before() {
        if (shouldIgnoreFile(context.filename,))
          return false;
        // createOnce persists this visitor across all files in the lint run.
        // Without clearing, function names from file A leak into file B's
        // specifier-export check, causing false positives that vary with
        // thread ordering.
        functionNodes.clear();
        specifierExportedNames.clear();
        return undefined;
      },
      FunctionDeclaration: checkFunction,
      VariableDeclaration: checkVariable,
      ExportNamedDeclaration(node: Span,): void {
        /** Narrowed view of the ExportNamedDeclaration so untyped `specifiers` is reachable. */
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const typed = node as Span & Record<string, unknown>;
        /** Specifier list; populated only for `export { a, b }` form, absent for inline exports. */
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const specifiers = typed.specifiers as Record<string, unknown>[] | undefined;
        if (specifiers === undefined)
          return;

        for (const spec of specifiers) {
          /** Local-name node of the specifier (`a` in `export { a as b }`). */
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
          const local = spec.local as Record<string, unknown> | undefined;
          if ((local !== undefined) && ((typeof local.name) === 'string'))
            specifierExportedNames.add(local.name,);
        }
      },
      after(): void {
        // Check deferred function nodes against specifier-exported names
        for (const [name, entry,] of functionNodes) {
          if (specifierExportedNames.has(name,)) {
            reportMissingExample({
              node: entry.node,
              comment: entry.comment,
            },);
          }
        }
      },
    } as VisitorWithHooks;
  },
};
