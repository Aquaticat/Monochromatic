/**
 * Shared oxlint configuration for Monochromatic repositories.
 *
 * Composes rule modules (tsdoc, correctness, restriction, style) and
 * file-pattern overrides into a single typed `OxlintConfig` object.
 * The root `oxlint.config.ts` imports and re-exports this config.
 *
 * @example
 * ```typescript
 * // oxlint.config.ts (monorepo root)
 * import { defineConfig } from 'oxlint';
 * import base from '\@monochromatic-dev/config-oxlint';
 *
 * export default defineConfig({ ...base });
 * ```
 */

import {
  defineConfig,
  type OxlintConfig,
} from 'oxlint';

import { overrides, } from './overrides.ts';
import { correctnessRules, } from './rules/correctness.ts';
import { restrictionRules, } from './rules/restriction.ts';
import { styleRules, } from './rules/style.ts';
import { tsdocRules, } from './rules/tsdoc.ts';

/**
 * Shared oxlint configuration.
 */
const config: OxlintConfig = defineConfig({
  categories: {
    correctness: 'error',
    suspicious: 'warn',
    pedantic: 'warn',
    style: 'warn',
  },

  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: 'warn',
    typeAware: true,
    typeCheck: true,
  },

  plugins: [
    'unicorn',
    'typescript',
    'oxc',
    'import',
    'promise',
    'node',
  ],

  env: {
    browser: true,
    node: true,
    es2024: true,
  },

  settings: {},

  // Root-only options like `typeAware` cannot live in any config file because
  // oxlint treats configs found via upward directory walk as nested (not root).
  // Pass `--type-aware` via the CLI instead (see mise task template `lint:oxlint`).

  // Language server still doesn't support js plugins.
  // Waiting for upstream: https://github.com/oxc-project/oxc/issues/14402 https://github.com/oxc-project/oxc/issues/14826
  //
  // oxlint's Rust resolver doesn't understand pnpm workspace package names,
  // so we resolve them to absolute paths via import.meta.resolve() at config
  // evaluation time (Node.js handles workspace resolution).
  jsPlugins: [
    // TSDoc validation rules adapted from eslint-plugin-jsdoc recommended config.
    new URL(import.meta.resolve('@monochromatic-dev/config-oxlint-tsdoc',),).pathname,

    // Banned syntax patterns that oxlint's built-in rules can't express.
    new URL(
      import.meta.resolve('@monochromatic-dev/config-oxlint-no-restricted-syntax',),
    )
      .pathname,

    // TypeScript layout enforcement for per-line constructs, semicolons, and expression structure.
    new URL(import.meta.resolve('@monochromatic-dev/config-oxlint-stylistic',),).pathname,
  ],

  ignorePatterns: [
    '**/dist',
    '**/node_modules',
    '**/logs',
    '**/coverage',
    '**/bak',
    '**/*.js',
    '**/*.cjs',
    '**/deprecated.*',
    '**/deprecated/**',
    '**/fixture/**',
    '**/invalid/**',
    '**/test-fixture/**',
    '**/perf-test-data/**',
    '**/teto-generated/**',
    '**/sudoku-puzzles*',
    '**/perf-expected-output*',
    '**/*.astro',
    '**/i18n/i18n-types.ts',
    '**/i18n/i18n-util.ts',
    '**/i18n/i18n-util.sync.ts',
    '**/i18n/i18n-util.async.ts',
    '**/*.generated.ts',
  ],

  rules: {
    ...tsdocRules,
    ...correctnessRules,
    ...restrictionRules,
    ...styleRules,
  },

  overrides,
},);

export default config;
