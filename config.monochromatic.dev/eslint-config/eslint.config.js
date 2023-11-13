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
      //region Possible Problems

      'array-callback-return': [
        'error',
        {
          checkForEach: true,

          // feat: 2023NOV08 add new option in ESLint v8.50.0 - 2023SEP22
          allowVoid: true,
        },
      ],

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

      'require-atomic-updates': ['error', { allowProperties: true }],

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

      'no-implicit-coercion': [
        'error',

        /* feat: Otherwise I'd go and log an entire array in console.log
               then wonder why it's not logged in full.
               2023NOV08 for ESLint v7.24.0 - 2021APR09 */
        { disallowTemplateShorthand: true },
      ],

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

            // Half of viewport. Example: 50vw is half of the window width.
            50,
            '50n',
            -50,
            '-50n',

            // Default rem is 16px.
            16,
            '16n',
            -16,
            '-16n',

            /* Maximum supported rem according to
               https://www.w3.org/WAI/GL/UNDERSTANDING-WCAG20/visual-audio-contrast-scale.html */
            32,
            '32n',
            -32,
            '-32n',

            /* region Common window width and height.
                Note: Height is only relevant when app is in fullscreen.
                Write 1920/2 for half of the width. */

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
            720,
            '720n',
            -720,
            '-720n',

            //endregion

            //region Frequently seen in Computer Science
            2147483647,
            '2147483647n',
            -2147483647,
            '-2147483647n',

            1970,
            '1970n',
            -1970,
            '-1970n',
          ],

          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
        },
      ],

      // feat: 2023NOV08 for eslint v7.24.0 - 2021APR09
      'no-multi-assign': ['error', { ignoreNonDeclaration: true }],

      // Use template literals instead.
      'no-multi-str': 'warn',

      'no-new': 'error',

      'no-new-func': 'error',

      // fix: 2023NOV08 Renamed in ESLint v8.50.0 - 2023SEP22
      'no-object-constructor': 'error',

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

      'line-comment-position': 'error',

      'unicode-bom': 'error',
      //endregion
    },
  },
];
