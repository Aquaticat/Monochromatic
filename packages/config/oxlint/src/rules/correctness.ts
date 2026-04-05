/**
 * Correctness, typescript, and performance rule configuration.
 *
 * Groups rules that prevent bugs, enforce correct TypeScript usage,
 * suppress leaked jest rules, and flag performance anti-patterns.
 *
 * @example
 * ```typescript
 * import { correctnessRules } from './rules/correctness.ts';
 * ```
 */

import type { DummyRuleMap, } from 'oxlint';

/** Correctness, typescript, and performance rules. */
export const correctnessRules: DummyRuleMap = {
  //region jest -- Suppress leaked jest rules from vitest plugin internals.
  // oxlint re-uses jest rule implementations for vitest and leaks them globally.
  // See https://github.com/oxc-project/oxc/issues/18518
  'jest/expect-expect': 'off',
  'jest/no-conditional-expect': 'off',
  'jest/no-disabled-tests': 'off',
  'jest/no-export': 'off',
  'jest/no-focused-tests': 'off',
  'jest/no-standalone-expect': 'off',
  'jest/require-hook': 'off',
  'jest/require-to-throw-message': 'off',
  'jest/valid-describe-callback': 'off',
  'jest/valid-expect': 'off',
  'jest/valid-title': 'off',
  //endregion jest

  // False positives on generic functions with nullable params (e.g. notNullishOrThrow).
  // See TROUBLESHOOTING.tsgolint-no-unnecessary-type-assertion.md
  'typescript/no-unnecessary-type-assertion': 'off',

  // Nursery rule: not enabled by category, must be listed explicitly.
  // Matches ESLint's @typescript-eslint/no-unnecessary-condition config.
  'typescript/no-unnecessary-condition': [
    'error',
    { allowConstantLoopConditions: 'only-allowed-literals', },
  ],

  //region correctness

  // import/default, import/named, import/namespace aren't enabled because TypeScript already checks for those.
  'import/default': 'off',
  'import/named': 'off',
  'import/namespace': 'off',
  'import/group-exports': 'off',
  'import/no-nodejs-modules': 'off',

  // Anonymous default exports work great!
  'import/no-anonymous-default-export': 'off',
  'typescript/triple-slash-reference': 'off',

  // Named functions are mandatory.
  // UPSTREAM: oxc doesn't support `allowDestructuring` parameter for this rule. Temporarily turned off.
  'typescript/no-this-alias': 'off',

  'unicorn/require-module-specifiers': 'off',

  //endregion correctness

  //region perf

  'eslint/no-await-in-loop': 'warn',
  'oxc/no-accumulating-spread': 'warn',
  'unicorn/prefer-set-has': 'warn',

  //endregion perf
};
