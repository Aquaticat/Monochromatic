import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Checks whether a function body matches the helper-function shape:
 * ends with `return <identifier>` where the identifier is a binding
 * declared at function-body root.
 *
 * Conservative by design: any function returning a non-identifier
 * expression (e.g. `return a + b`, `return Math.max(x, 0)`) fails the
 * check and remains subject to the rule. False negatives are accepted
 * in exchange for keeping real scope-leak cases reportable.
 *
 * @param body - The function's BlockStatement body.
 *
 * @returns `true` when the function shape matches the helper pattern.
 */
function isHelperShape(body: ESTree.FunctionBody,): boolean {
  const stmts = body.body;
  /** Minimum statement count for a meaningful helper (declaration + return). */
  const minStmts = 2;
  if (stmts.length < minStmts)
    return false;
  const last = stmts.at(-1,);
  if (last === undefined || last.type !== 'ReturnStatement')
    return false;
  const arg = last.argument;
  if (arg === null || arg.type !== 'Identifier')
    return false;
  const returnedName = arg.name;
  for (const stmt of stmts) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id.type === 'Identifier' && decl.id.name === returnedName)
          return true;
      }
    }
    else if (
      stmt.type === 'FunctionDeclaration'
      && stmt.id !== null
      && stmt.id.name === returnedName
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Bans `let` declarations at the immediate root scope of a function body.
 *
 * A `let` declared as a direct statement of a function body survives every
 * subsequent statement of that function. The mutation possibility broadcasts
 * to readers far from the actual mutation site. Push the mutation into a
 * tighter scope (loop body, explicit `{}` block, switch case, IIFE) or
 * refactor so the binding can become `const`.
 *
 * The rule visits `FunctionDeclaration` and `FunctionExpression` and reports
 * each direct-child `VariableDeclaration` with `kind === 'let'` in the
 * function body's `BlockStatement.body`. Two allowlist heuristics suppress
 * the report:
 *
 * 1. **IIFE callee**. When the function expression is the immediate callee
 *    of a `CallExpression` (`(function name () { ... })()` or
 *    `(() => { ... })()`), the body IS the IIFE scope and nothing leaks
 *    past the call.
 *
 * 2. **Helper-function shape**. When the function body ends with
 *    `return <identifier>` and that identifier resolves to a function-body
 *    -root binding (`let`, `const`, or `function`), the function exists
 *    to encapsulate a build-via-mutation computation. The function is
 *    itself the tight scope.
 *
 * Function-body `let` inside `ForStatement.init`, loop bodies, explicit
 * `{}` blocks, and switch cases is not reported: the inner BlockStatement
 * already provides the tight scope.
 *
 * @example
 * ```ts
 * // Bad -- let at function-body root, return is an expression
 * function fires(items: readonly number[],): number {
 *   let total = 0;
 *   for (const x of items) total += x;
 *   return total * 2;
 * }
 *
 * // Good -- helper shape: ends with `return total`
 * function helper(items: readonly number[],): number {
 *   let total = 0;
 *   for (const x of items) total += x;
 *   return total;
 * }
 *
 * // Good -- named-function IIFE callee
 * function wrap(items: readonly number[],): number {
 *   const total = (function sum (): number {
 *     let acc = 0;
 *     for (const x of items) acc += x;
 *     return acc;
 *   })();
 *   return total * 2;
 * }
 *
 * // Good -- refactored to const via reduce
 * function reduced(items: readonly number[],): number {
 *   const total = items.reduce(function add (a: number, x: number,): number { return a + x; }, 0,);
 *   return total * 2;
 * }
 * ```
 */
export const noFunctionRootLet: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow `let` at function-body root scope. IIFE bodies and helper-function shape (ends with `return <root-binding>`) are allowlisted.',
      recommended: true,
    },
    messages: {
      forbidden:
        '`let` at function-body root leaks scope to every subsequent statement. '
        + 'Refactor to `const` (ternary, Array.reduce), wrap the mutation in a named-function IIFE '
        + '`(function name () { let x; /* ... */ return x; })()`, or extract a helper function '
        + 'ending in `return <local-binding>`. If genuinely unavoidable, add '
        + '`oxlint-disable-next-line no-restricted-syntax/no-function-root-let` with a justification.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Inspects a function node for `let` declarations at body-root scope.
     *
     * Returns early when the function is an IIFE callee or matches the
     * helper-function shape; otherwise reports every root-level `let`.
     *
     * @param node - Function declaration or expression AST node.
     */
    function checkFunction(node: ESTree.Function,): void {
      const {
        parent,
        body,
      } = node;
      if (
        parent.type === 'CallExpression'
        && parent.callee === node
      ) {
        return;
      }
      if (body === null)
        return;
      if (isHelperShape(body,))
        return;
      for (const stmt of body.body) {
        if (stmt.type !== 'VariableDeclaration')
          continue;
        if (stmt.kind !== 'let')
          continue;
        if (stmt.declare === true)
          continue;
        context.report({
          node: stmt,
          messageId: 'forbidden',
        },);
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
    };
  },
};
