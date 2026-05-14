import type {
  Context,
  CreateOnceRule,
  ESTree,
  Scope,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Prefers `describe({ name: myFn.name, ... })` over
 * `describe({ name: 'myFn', ... })` whenever `myFn` is an in-scope binding.
 *
 * The function-reference form keeps suite names synchronised with renames:
 * `Function.prototype.name` updates automatically when the underlying
 * declaration is renamed, while a string literal silently drifts.
 *
 * Reports the `describe({ name: '<string>' })` form only when `<string>`
 * matches an identifier currently bound in the file (an import, a
 * top-level declaration, or any enclosing scope). String literals that
 * do not match any binding are left alone; they cover legitimate cases
 * such as CLI names, class names quoted as strings, and multi-word
 * descriptive headings.
 *
 * Empty-string names (`name: ''`) are exempted: the harness uses them
 * for invisible top-level suites where the filename already identifies
 * the test target.
 *
 * Harness self-tests in `packages/module/test/src/{describe,it}.unit.test.ts`
 * are circular by design (the function under test IS the local binding);
 * they opt out via inline
 * `oxlint-disable-next-line no-restricted-syntax/prefer-describe-function-ref-name`.
 *
 * @example
 * ```ts
 * // Bad; string literal mirrors an in-scope import
 * import { coerceArg } from './coerce-arg.ts';
 * await describe({ name: 'coerceArg', children: [\/* ... *\/] });
 *
 * // Good; function reference auto-syncs on rename
 * import { coerceArg } from './coerce-arg.ts';
 * await describe({ name: coerceArg.name, children: [\/* ... *\/] });
 *
 * // Good; no binding named 'fixtures' in scope
 * await describe({ name: 'fixtures', children: [\/* ... *\/] });
 *
 * // Good; empty name (harness convention for invisible top-level suite)
 * await describe({ name: '', children: [\/* ... *\/] });
 * ```
 */
export const preferDescribeFunctionRefName: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer `describe({ name: fn.name })` over `describe({ name: \'fn\' })` when `fn` is an in-scope binding.',
      recommended: true,
    },
    messages: {
      forbidden:
        '`describe` name `\'{{name}}\'` matches the in-scope binding `{{name}}`. '
        + 'Replace with `{{name}}.name` so renames stay in sync. '
        + 'See .claude/skills/testing-practices/SKILL.md for the convention. '
        + 'If the function under test IS the local binding (harness self-test), '
        + 'add `oxlint-disable-next-line no-restricted-syntax/prefer-describe-function-ref-name` '
        + 'with a justification.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Inspects a `describe(...)` call expression and reports when its
     * `name` property is a string literal that matches an in-scope
     * binding.
     *
     * @param node - The `CallExpression` AST node.
     */
    function checkCall(node: ESTree.CallExpression,): void {
      if (node.callee.type !== 'Identifier' || node.callee.name !== 'describe')
        return;
      /** First argument of the call, or `undefined` when none was passed. */
      const [firstArg,] = node.arguments;
      if (firstArg === undefined || firstArg.type !== 'ObjectExpression')
        return;
      for (const prop of firstArg.properties) {
        if (prop.type !== 'Property')
          continue;
        if (prop.computed)
          continue;
        if (prop.shorthand)
          continue;
        if (prop.key.type !== 'Identifier' || prop.key.name !== 'name')
          continue;
        if (prop.value.type !== 'Literal' || typeof prop.value.value !== 'string')
          continue;
        /** String value of the `name` property. */
        const stringValue = prop.value.value;
        if (stringValue === '')
          return;
        for (
          let scope: Scope | null = context.sourceCode.getScope(node,);
          scope !== null;
          scope = scope.upper
        ) {
          if (scope.set.has(stringValue,)) {
            context.report({
              node: prop.value,
              messageId: 'forbidden',
              data: { name: stringValue, },
            },);
            return;
          }
        }
        return;
      }
    }

    return {
      CallExpression: checkCall,
    };
  },
};
