/**
 * Restriction rule configuration.
 *
 * Rules that ban specific language features, enforce coding conventions,
 * and prevent patterns that conflict with the project's style decisions.
 *
 * @example
 * ```typescript
 * import { restrictionRules } from './rules/restriction.ts';
 * ```
 */

import type { DummyRuleMap, } from 'oxlint';

/** Restriction rules. */
export const restrictionRules: DummyRuleMap = {
  'eslint/no-iterator': 'error',

  // Tagged template expressions (css``, html``, etc.) aren't unused expressions.
  'eslint/no-unused-expressions': [
    'error',
    { allowTaggedTemplates: true, },
  ],

  // `void` as expression is allowed as a statement for fire-and-forget calls.
  // The explicit "off" overrides the "error" that would come from the eslint category.
  'eslint/no-void': 'off',
  'import/no-commonjs': 'error',
  'import/unambiguous': 'error',
  'promise/spec-only': 'error',
  'typescript/explicit-function-return-type': 'error',
  'unicorn/no-document-cookie': 'error',

  // Switch statements are banned; default-case is moot.
  'eslint/default-case': 'off',

  // Use if/else chains or Record<K, V> lookups instead of switch.
  'no-restricted-syntax/no-switch': 'error',

  // Use Object.entries/Object.keys/Object.values instead of for...in.
  'no-restricted-syntax/no-for-in': 'error',

  // Use using/await using for cleanup instead of try...finally.
  'no-restricted-syntax/no-try-finally': 'error',

  // Use union types with `as const` instead of enum declarations.
  'no-restricted-syntax/no-enum': 'error',

  // Use named function declarations or named function expressions, never arrow functions.
  // Callbacks still need a name: items.map(function getValue(item) { return item.value; }).
  'no-restricted-syntax/no-arrow-function': 'error',

  // All .catch() calls are banned. Use try/catch with async/await.
  'no-restricted-syntax/no-promise-catch': 'error',

  // All .finally() calls are banned. Use using/await using for cleanup.
  'no-restricted-syntax/no-promise-finally': 'error',

  // Use Object.hasOwn(obj, key) instead of obj.hasOwnProperty(key).
  'no-restricted-syntax/no-hasownproperty': 'error',

  // Rest parameters (...args) are banned. Accept an explicit array parameter instead.
  // Spread syntax in call expressions and array literals is not affected.
  'no-restricted-syntax/no-rest-params': 'error',

  // Use .trimStart()/.trimEnd() instead of deprecated .trimLeft()/.trimRight().
  'no-restricted-syntax/no-trim-left-right': 'error',

  // `const fn = function() {}` is banned. Use a function declaration instead.
  // Function expressions as callbacks (not assigned to variables) are not affected.
  'no-restricted-syntax/no-variable-function-expression': 'error',

  // Function declarations with 2+ params must use a single destructured object parameter.
  // function createUser({ name, age }: { name: string; age: number }): User {}
  // Function expressions (callbacks) are exempt since their signatures are often dictated by external APIs.
  'no-restricted-syntax/require-destructured-params': 'error',

  // querySelector(), querySelectorAll(), and closest() must specify a generic type parameter.
  // e.g. document.querySelector<HTMLInputElement>('.my-input') instead of document.querySelector('.my-input').
  'no-restricted-syntax/require-queryselector-generic': 'error',

  //region no-disable -- prevent inline oxlint-disable for rules with no legitimate exceptions
  'no-restricted-syntax/no-disable-require-tsdoc': 'error',
  'no-restricted-syntax/no-disable-no-switch': 'error',
  'no-restricted-syntax/no-disable-no-for-in': 'error',
  'no-restricted-syntax/no-disable-no-enum': 'error',
  'no-restricted-syntax/no-disable-no-hasownproperty': 'error',
  'no-restricted-syntax/no-disable-no-trim-left-right': 'error',
  'no-restricted-syntax/no-disable-no-promise-catch': 'error',
  'no-restricted-syntax/no-disable-no-promise-finally': 'error',
  'no-restricted-syntax/no-disable-no-variable-function-expression': 'error',
  'no-restricted-syntax/no-disable-require-destructured-params': 'error',
  'no-restricted-syntax/no-disable-no-rest-params': 'error',
  'no-restricted-syntax/no-disable-no-arrow-function': 'error',
  'no-restricted-syntax/no-disable-no-try-finally': 'error',
  'no-restricted-syntax/no-disable-no-non-null-assertion': 'error',
  'no-restricted-syntax/no-disable-no-useless-return': 'error',
  'no-restricted-syntax/no-disable-require-returns': 'error',
  'no-restricted-syntax/no-disable-prefer-regexp-exec': 'error',
  //endregion no-disable

  // Never process.exit() -- throw errors instead.
  'unicorn/no-process-exit': 'error',

  // Ban non-null assertion (!) -- use notNullishOrThrow instead.
  'typescript/no-non-null-assertion': 'error',

  // Enforce import type for type-only imports.
  'typescript/consistent-type-imports': 'error',

  // Prefer const over let when variable is never reassigned.
  'eslint/prefer-const': 'warn',

  // Ban explicit any -- use unknown instead. When any is genuinely needed, use oxlint-disable.
  'typescript/no-explicit-any': 'warn',

  // No eval() or Function() constructor: arbitrary code execution.
  'eslint/no-eval': 'error',

  // No setTimeout/setInterval with string arguments: implied eval.
  'typescript/no-implied-eval': 'error',

  // No new Boolean/String/Number wrapper objects: use primitives.
  'eslint/no-new-wrappers': 'error',

  // No alert/confirm/prompt: use promise-based UI alternatives.
  'eslint/no-alert': 'error',

  // No debugger statements in committed code.
  'eslint/no-debugger': 'error',

  // No comma operator: obscures evaluation order.
  'eslint/no-sequences': 'error',

  // No arguments.caller/arguments.callee: deprecated and non-optimizable.
  'eslint/no-caller': 'error',

  // No labels that shadow variable names: confusing.
  'eslint/no-label-var': 'error',

  // No instanceof Array: use Array.isArray() which works across realms.
  'unicorn/no-instanceof-array': 'error',
  'eslint/no-empty': 'error',
  'eslint/no-empty-function': 'error',
  'eslint/no-eq-null': 'error',
  'eslint/no-proto': 'error',
  'eslint/no-regex-spaces': 'error',
  'eslint/max-statements': 'off',

  'eslint/no-var': 'error',
  'eslint/unicode-bom': 'error',
  'import/no-amd': 'error',
  'import/no-cycle': 'error',
  'import/no-webpack-loader-syntax': 'error',
  'oxc/bad-bitwise-operator': 'error',
  'oxc/no-const-enum': 'error',
  'typescript/no-dynamic-delete': 'error',
  'typescript/no-empty-object-type': 'error',
  'typescript/no-import-type-side-effects': 'error',
  'typescript/no-namespace': 'error',
  'typescript/no-non-null-asserted-nullish-coalescing': 'error',
  'typescript/no-var-requires': 'error',
  'typescript/prefer-literal-enum-member': 'error',
  'unicorn/no-abusive-eslint-disable': 'error',
  'unicorn/no-length-as-slice-end': 'error',
  'unicorn/no-magic-array-flat-depth': 'error',
  'unicorn/prefer-modern-math-apis': 'error',
  'unicorn/prefer-node-protocol': 'error',

  // TODO: Need observation for this one.
  //       The intention is to ban the original global number variables
  //       because they have different behavior with new number properties,
  //       and then replace the global number variables with aliases of new number properties.
  'unicorn/prefer-number-properties': 'error',

  // Linters reporting unused vars aren't wanted.
  // The editor will report them.
  // Those vars are often left as code for syntax highlighting or testing purposes,
  // or they're part of work-in-progress.
  // The bundler will remove them in the final bundle.
  'eslint/no-unused-vars': 'off',

  // TODO comments are tracked via issues, not lint.
  'eslint/no-warning-comments': 'off',
};
