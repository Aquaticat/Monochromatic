import eslint from '@eslint/js';
// import oxlintrc from '@monochromatic-dev/config-oxlint/index.jsonc';
import vitest from '@vitest/eslint-plugin';

// Excluded from bundle because it causes the bundle size to be large.
import tsdoc from 'eslint-plugin-tsdoc';

import nodePlugin from 'eslint-plugin-n';
import {
  eslintRules,
  importRules,
  // jsdocRules,
  jsxA11yRules,
  nodeRules,
  promiseRules,
  reactRules,
  typescriptRules,
  unicornRules,
  vitestRules,
} from 'eslint-plugin-oxlint/rules-by-scope';

// import { searchForWorkspaceRoot } from 'vite';

// eslint-plugin-astro has too many moving parts.

// Excluded from bundle because it causes the bundle size to be large.
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

import tseslint from 'typescript-eslint';
import type { ConfigArray } from 'typescript-eslint';
import { searchForWorkspaceRoot } from 'vite';
import astroPlugin from './astro-plugin.ts';

// .astro must be included here for TypeScript ESLint's projectService to work properly
// See: https://typescript-eslint.io/troubleshooting/typed-linting/performance#changes-to-extrafileextensions-with-projectservice
const extraFileExtensions = ['vue', 'astro', 'mdx'];

const myConfigArray: ConfigArray = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/bak/**',
      '**/temp/**',
      '**/node_modules/**',
      // Astro's auto-generated internal files
      '**/.astro/**',
      // Not linting js files.
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      '**/*.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  nodePlugin.configs['flat/recommended'],
  eslintPluginUnicorn.configs.all,
  {
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
        projectService: true,
        tsconfigRootDir: searchForWorkspaceRoot(process.cwd()),
        jsx: true,
        emcaVersion: 'latest',
        extraFileExtensions,
        lib: ['esnext', 'dom', 'webworker'],
        sourceType: 'module',
      },
    },

    plugins: {
      tsdoc,
    },

    'settings': {
      node: {
        version: '>=24.0.0',
      },
    },

    rules: {
      // Redundant with TypeScript
      'unicorn/no-unused-properties': ['off'],

      // Redundant with TypeScript
      'n/no-missing-import': ['off'],

      'n/hashbang': ['error', {
        executableMap: {
          '.js': 'bun',
          '.ts': 'bun',
        },
      }],

      '@typescript-eslint/no-unnecessary-condition': ['error', {
        allowConstantLoopConditions: 'only-allowed-literals',
      }],
      '@typescript-eslint/no-confusing-void-expression': ['error', {
        ignoreVoidReturningFunctions: true,
        ignoreVoidOperator: true,
      }],
      // I don't mind extra void.
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', {
        // Always use JSON.stringify
      }],

      /* Has too many false positives. For example:
      ```ts
       export async function atArrayLikeAsync<
        const T_arrayLike extends MaybeAsyncIterable<any>,
        const T_element extends T_arrayLike extends MaybeAsyncIterable<infer T_element>
          ? T_element
          : never,
        const T_index extends number,
      >(
        index: T_index,
        arrayLike: T_arrayLike,
      ): Promise<T_element | undefined>;

      export async function atArrayLikeAsync<
        const T_arrayLike extends MaybeAsyncIterable<any>,
        const T_element extends T_arrayLike extends MaybeAsyncIterable<infer T_element>
          ? T_element
          : never,
        const T_index extends number,
      >(
        index: T_index,
        arrayLike: T_arrayLike,
      ): Promise<T_element | undefined> {
        if (Array.isArray(arrayLike)) {
          const arrArrayLike = arrayLike as T_element[];
          return arrayLike.at(index) as T_index extends IntsNegative10to10 ? (typeof arrArrayLike)[T_index]
            : (typeof arrArrayLike)[number] | undefined;
        }
      ```

      Just because the type parameter isn't used in the function signature doesn't mean it won't find use in the function body.
       */
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',

      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          'checksVoidReturn': {
            // passing a () => Promise<void> to a () => void parameter
            'arguments': false,
          },
        },
      ],

      'tsdoc/syntax': 'warn',

      // Using Vite bundler.
      'n/no-unpublished-import': 'off',

      'unicorn/prevent-abbreviations': ['error', {
        replacements: {
          // If readdir is good enough for node, it's good enough.
          dir: false,
          dirs: false,

          //region unambiguious -- Everybody knows what these are.
          fn: false,
          lib: false,
          temp: false,
          dev: false,
          param: false,
          args: false,
          props: false,
          ctx: false,
          var: false,
          l: false, // logger
          src: false,
          pkg: false,
          num: false,
          val: false,
          obj: false,
          //endregion umambiguious
        },
      }],

      'unicorn/no-keyword-prefix': ['error', {
        // `new` and `class` doesn't look too similar to me.
        disallowedPrefixes: [],
      }],

      'unicorn/import-style': ['warn', {
        'styles': {
          // path does export named imports like join and resolve
          'path': false,
          'node:path': false,
        },
      }],
    },
  },
  {
    files: ['**/*.{test,bench}.ts'],

    plugins: {
      vitest,
    },

    rules: {
      ...vitest.configs.all.rules,
      '@typescript-eslint/require-await': 'off',
      'vitest/prefer-expect-assertions': 'off',
      'unicorn/prevent-abbreviations': 'off',
      // Padding is a formatting concern, not a linting concern per ESLint's current philosophy
      'vitest/padding-around-all': 'off',
      'vitest/padding-around-expect-groups': 'off',
      'vitest/padding-around-describe-blocks': 'off',
      'vitest/padding-around-test-blocks': 'off',
      'vitest/padding-around-before-all-blocks': 'off',
      'vitest/padding-around-before-each-blocks': 'off',
      'vitest/padding-around-after-all-blocks': 'off',
      'vitest/padding-around-after-each-blocks': 'off',
      // Test files don't need JSDoc comments
      'jsdoc/require-jsdoc': 'off',

      'vitest/require-hook': ['warn', {
        allowedFunctionCalls: [
          //region For blackbox testing
          'readFile',
          'readTextFile',
          'execAsync',
          //endregion For blackbox testing
          // Extended test
          'test',
        ],
      }],
    },

    settings: {
      vitest: {
        typecheck: true,
      },
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
  },
  //region oxlint -- Turn off rules already supported by oxlint.
  {
    rules: {
      ...eslintRules,
      ...importRules,

      // Seems like Oxlint doesn't support TSDoc. Turned off. Enabled all Eslint TSDoc rules.
      // ...jsdocRules,

      ...jsxA11yRules,
      ...nodeRules,
      ...promiseRules,
      ...reactRules,
      ...typescriptRules,
      ...unicornRules,
      ...vitestRules,
    },
  },
  //endregion oxlint -- Turn off rules already supported by oxlint.

  //region Astro files -- Use astro-internal plugin recommended config
  ...astroPlugin.configs.recommended,
  //endregion Astro files
);

export default myConfigArray;
