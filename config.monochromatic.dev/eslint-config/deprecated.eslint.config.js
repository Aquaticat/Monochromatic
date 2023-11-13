import js from '@eslint/js';

import globals from 'globals';

export default [
  js.configs.recommended,

  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },

    // See https://eslint.org/docs/latest/rules/
    rules: {
      //region Layout & Formatting

      /* Let dprint handle it.
         Edit: No need, keeping this allows eslint to fix it.
               Also, this somehow doesn't conflict with dprint.
         Edit: 2023NOV08 ESlint v8.53.0 deprecated those.
               Disabled to avoid surprises when upgrading to a later ESLint version. */

      'array-bracket-newline': ['warn', { multiline: true, minItems: 3 }],
      'array-bracket-spacing': 'warn',
      'array-element-newline': [
        'warn',

        {
          ArrayExpression: { multiline: true, minItems: 3 },
          ArrayPattern: { multiline: true, minItems: 3 },
        },
      ],

      'arrow-parens': 'error',
      'arrow-spacing': 'error',

      'block-spacing': 'warn',

      'brace-style': 'warn',

      // Let dprint handle it.
      'comma-dangle': ['off', 'always-multiline'],

      'comma-spacing': 'error',
      'comma-style': 'error',

      'computed-property-spacing': 'error',

      'dot-location': ['error', 'property'],

      'eol-last': 'error',

      'func-call-spacing': 'error',
      'function-call-argument-newline': ['error', 'consistent'],

      // Let dprint handle it.
      'function-paren-newline': ['off', 'never'],

      'generator-star-spacing': 'error',

      // Turned it off because I want to let dprint handle it.
      'implicit-arrow-linebreak': ['off', 'below'],

      'indent': [
        // Turned it off because I want to let dprint handle it.
        'off',
        2,

        {
          SwitchCase: 1,
          VariableDeclarator: 'first',
          outerIIFEBody: 0,
          MemberExpression: 1,
          FunctionDeclaration: { body: 1, parameters: 'first' },
          FunctionExpression: { body: 1, parameters: 'first' },
          StaticBlock: { body: 1 },
          CallExpression: { arguments: 'first' },
          ArrayExpression: 'first',
          ObjectExpression: 'first',
          ImportDeclaration: 'first',
          flatTernaryExpressions: false,
          offsetTernaryExpressions: true,
          ignoreComments: true,
        },
      ],

      'key-spacing': 'error',

      'keyword-spacing': 'error',

      'linebreak-style': 'error',

      'lines-around-comment': [
        'error',

        {
          beforeBlockComment: true,
          afterBlockComment: false,
          beforeLineComment: true,
          afterLineComment: false,
          allowBlockStart: true,
          allowBlockEnd: true,
          allowObjectStart: true,
          allowObjectEnd: true,
          allowArrayStart: true,
          allowArrayEnd: true,
          allowClassStart: true,
          allowClassEnd: true,

          ignorePattern: 'endregion',

          applyDefaultIgnorePatterns: true,
        },
      ],

      'lines-between-class-members': 'error',

      'max-statements-per-line': ['error', { max: 3 }],

      'multiline-ternary': ['error', 'always-multiline'],

      'new-parens': 'error',

      'newline-per-chained-call': ['error', { ignoreChainWithDepth: 3 }],

      'no-multi-spaces': 'error',

      'no-multiple-empty-lines': [
        'error',

        {
          max: 3,
          maxEOF: 1,
          maxBOF: 0,
        },
      ],

      'no-tabs': 'error',

      'no-trailing-spaces': 'error',

      'no-whitespace-before-property': 'error',

      /* Clearer for:
       ```if (bool)
            return 1;
       ``` */
      'nonblock-statement-body-position': [
        'error',
        'below',
        { overrides: { do: 'any' } },
      ],

      'object-curly-newline': [
        'error',

        {
          multiline: true,
          minProperties: 3,
          consistent: true,
        },
      ],

      'object-curly-spacing': [
        'error',
        'always',
        { arraysInObjects: true, objectsInObjects: true },
      ],

      'object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],

      'operator-linebreak': [
        'error',
        'before',
        { overrides: { '=': 'after' } },
      ],

      'padded-blocks': [
        'error',

        {
          blocks: 'never',
          classes: 'always',
          switches: 'never',
        },

        { allowSingleLineBlocks: true },
      ],

      'padding-line-between-statements': [
        'error',

        {
          blankLine: 'always',
          prev: '*',
          next: 'block',
        },

        {
          blankLine: 'always',
          prev: 'block',
          next: '*',
        },

        {
          blankLine: 'always',
          prev: '*',
          next: 'multiline-block-like',
        },

        {
          blankLine: 'always',
          prev: 'multiline-block-like',
          next: '*',
        },

        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },

        {
          blankLine: 'always',
          prev: '*',
          next: 'continue',
        },

        {
          blankLine: 'always',
          prev: '*',
          next: 'break',
        },

        {
          blankLine: 'always',

          prev: [
            'const',
            'let',
            'var',
          ],

          next: '*',
        },
        {
          blankLine: 'any',

          prev: [
            'const',
            'let',
            'var',
          ],

          next: [
            'const',
            'let',
            'var',
          ],
        },

        {
          blankLine: 'always',
          prev: 'directive',
          next: '*',
        },

        {
          blankLine: 'any',
          prev: 'directive',
          next: 'directive',
        },

        {
          blankLine: 'always',
          prev: ['case', 'default'],
          next: '*',
        },

        {
          blankLine: 'always',
          prev: ['import', 'cjs-import'],
          next: '*',
        },

        {
          blankLine: 'always',
          prev: '*',
          next: ['export', 'cjs-export'],
        },
      ],

      'quotes': ['error', 'single'],

      'rest-spread-spacing': 'error',

      // Let dprint handle it.
      'semi': ['off', 'always'],

      'semi-spacing': 'error',

      'semi-style': 'error',

      'space-before-blocks': 'error',

      'space-before-function-paren': [
        'error',

        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],

      'space-in-parens': 'error',

      'space-infix-ops': ['error', { int32Hint: true }],

      'space-unary-ops': ['error', { words: true, nonwords: false }],

      'switch-colon-spacing': 'error',

      'template-curly-spacing': 'error',

      'template-tag-spacing': 'error',

      'wrap-iife': 'error',

      'wrap-regex': 'error',

      'yield-star-spacing': ['error', 'before'],
      //endregion
    }
  }
];
