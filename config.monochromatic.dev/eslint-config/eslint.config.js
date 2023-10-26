import js from '@eslint/js';

export default [
  js.configs.recommended,

  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },

    // See https://eslint.org/docs/latest/rules/
    rules: {
      //region Possible Problems

      'array-callback-return': ['error', { checkForEach: true }],

      'no-constant-binary-expression': 'error',

      'no-constructor-return': 'error',

      'no-duplicate-imports': 'error',

      'no-new-native-nonconstructor': 'error',

      'no-promise-executor-return': 'error',

      'no-self-compare': 'error',

      'no-unmodified-loop-condition': 'error',

      'no-unreachable-loop': 'error',

      'no-unused-private-class-members': 'error',

      'no-use-before-define': ['error', { allowNamedExports: true }],

      //endregion

      //region Suggestions

      'accessor-pairs': 'error',

      'arrow-body-style': ['error', 'as-needed'],

      // The keyword var should not be used anyway.
      'block-scoped-var': 'error',

      'class-methods-use-this': 'error',

      /* Let dprint handle it.
       preferNone */
      'curly': 'off',

      'default-case': 'error',
      'default-case-last': 'error',

      'default-param-last': 'error',

      'eqeqeq': 'error',

      'func-style': 'error',

      'init-declarations': 'error',

      'logical-assignment-operators': [
        'error',
        'always',
        { enforceForIfStatements: true },
      ],

      // Using bare-block instead of default starred-block because it's easier to format.
      'multiline-comment-style': ['warn', 'bare-block'],

      'no-array-constructor': 'error',

      // I intentionally use extra semiColons. Also see dprint.json
      'no-extra-semi': 'off',

      'no-floating-decimal': 'error',

      'no-implicit-coercion': 'error',

      'no-invalid-this': 'error',

      'no-iterator': 'error',

      'no-magic-numbers': [
        'warn',

        {
          ignore: [
            1,
            '1n',
            0,
            -1,
            '-1n',

            2,
            '2n',
            -2,
            '-2n',

            // Viewport. Example: 100vw is window width.
            100,
            '100n',
            -100,
            '-100n',

            // Half of viewport. Example: 50vw is half of the window with.
            50,
            '50n',
            -50,
            '-50n',

            // Default rem is 16px.
            16,
            '16n',
            -16,
            '-16n',

            // Maximum supported rem according to
            // https://www.w3.org/WAI/GL/UNDERSTANDING-WCAG20/visual-audio-contrast-scale.html
            32,
            '32n',
            -32,
            '-32n',

            //region Common window width and height.
            // Note: Height is only relevant when app is in fullscreen.
            // Write 1920/2 for half of the width.

            // 1920 * 1080
            1920,
            '1920n',
            -1920,
            '-1920n',
            1080,
            '1080n',
            -1080,
            '-1080n',

            // 2560 * 1440
            2560,
            '2560n',
            -2560,
            '-2560n',
            1440,
            '1440n',
            -1440,
            '-1440n',

            // 3840 * 2160
            3840,
            '3840n',
            -3840,
            '-3840n',
            2160,
            '2160n',
            -2160,
            '-2160n',

            // 1280 * 720
            1280,
            '1280n',
            -1280,
            '-1280n',
            //endregion
          ],

          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
        },
      ],

      // Use template literals instead.
      'no-multi-str': 'warn',

      'no-new': 'error',

      'no-new-func': 'error',

      'no-new-object': 'error',

      'no-new-wrappers': 'error',

      'no-octal': 'warn',

      'no-param-reassign': 'warn',

      'no-proto': 'error',

      'no-return-assign': 'error',

      'no-sequences': 'error',

      'no-shadow': [
        'error',

        {
          builtinGlobals: false,
          hoist: 'all',
          ignoreOnInitialization: true,
        },
      ],

      'no-undefined': 'error',

      'no-unneeded-ternary': ['warn', { defaultAssignment: false }],

      'no-unused-expressions': [
        'warn',

        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],

      'no-useless-concat': 'warn',

      'no-var': 'error',

      'object-shorthand': 'warn',

      'one-var-declaration-per-line': 'error',

      'operator-assignment': 'warn',

      'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],

      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],

      'prefer-destructuring': [
        'error',
        { array: true, object: true },
        { enforceForRenamedProperties: true },
      ],

      'prefer-exponentiation-operator': 'error',

      'prefer-numeric-literals': 'error',

      'prefer-object-has-own': 'error',

      'prefer-object-spread': 'error',

      'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],

      'prefer-rest-params': 'error',

      'prefer-spread': 'error',

      'prefer-template': 'error',

      'quote-props': ['warn', 'consistent-as-needed'],

      'spaced-comment': [
        'warn',
        'always',

        {
          exceptions: [
            '-',
            '_',
            '+',
            '=',
            '*',
          ],

          markers: [
            '/',
            '*',

            // Range marker
            'region',
            'endregion',
          ],

          block: { balanced: true },
        },
      ],

      'yoda': 'error',

      //endregion

      //region Layout & Formatting

      /* Let dprint handle it.
       Edit: No need, keeping this allows eslint to fix it. Also, this somehow doesn't conflict with dprint. */
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
       ```*/
      'nonblock-statement-body-position': ['error', 'below', { overrides: { do: 'any' } }],

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

      'operator-linebreak': ['error', 'before', { overrides: { '=': 'after' } }],

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

      'unicode-bom': 'error',

      'wrap-iife': 'error',

      'wrap-regex': 'error',

      'yield-star-spacing': ['error', 'before'],
      //endregion
    },
  },
];
