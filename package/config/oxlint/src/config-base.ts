/**
 * Shared oxlint configuration without `jsPlugins`.
 *
 * Holds every field of the Monochromatic oxlint config except the plugin list:
 * the development entry (`index.ts`) and the built Node entry (`index.node.ts`)
 * each spread this base and attach their own `jsPlugins` (source-resolved vs
 * co-located sidecar URLs). Keeping `jsPlugins` out of the base means the bundled
 * `dist/final/node/index.mjs` carries no `import.meta.resolve` plugin resolution.
 */

import type { OxlintConfig, } from 'oxlint';

import { overrides, } from './overrides.ts';
import { correctnessRules, } from './rule/correctness.ts';
import { restrictionRules, } from './rule/restriction.ts';
import { styleRules, } from './rule/style.ts';
import { tsdocRules, } from './rule/tsdoc.ts';

/**
 * Shared oxlint configuration shared by every entry, minus `jsPlugins`.
 */
export const base: OxlintConfig = {
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

  ignorePatterns: [
    '**/dist',
    // Committed Claude Code plugin bundles (tsdown output moved out of dist;
    // see doc/decision/gitignore-negations.md).
    '**/bundle',
    '**/node_modules',
    '**/logs',
    '**/coverage',
    '**/bak',
    '**/*.js',
    '**/*.cjs',
    '**/deprecated.*',
    '**/deprecated/**',
    // Paused and deprecated package trees are out of the lint/format scope; one
    // file in package-paused also has a two-rule autofix oscillation that
    // stalls `task-oxlint --fix` (see doc/troubleshooting/oxlint-multi-fix-convergence.md).
    '**/package-paused/**',
    '**/package-deprecated/**',
    '**/fixture/**',
    '**/fixtures/**',
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
};
