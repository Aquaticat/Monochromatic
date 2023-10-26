import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['**./*.ts', '**./*.mts', '**./*.cts', '**./*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        lib: ['ESNext', 'DOM', 'WebWorker'],
        warnOnUnsupportedTypeScriptVersion: false,
        EXPERIMENTAL_useProjectService: true,
      },
    },
    plugins: {
      ts: typescriptPlugin,
    },

    // See https://typescript-eslint.io/linting/configs
    rules: {
      //region Copy pasted from https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/recommended-type-checked.ts
      // because typescript-eslint doesn't provide a flat config for now.
      'ts/await-thenable': 'error',
      'ts/ban-ts-comment': 'error',
      'ts/ban-types': 'error',
      'no-array-constructor': 'off',
      'ts/no-array-constructor': 'error',
      'ts/no-base-to-string': 'error',
      'ts/no-duplicate-enum-values': 'error',
      'ts/no-duplicate-type-constituents': 'error',
      'ts/no-explicit-any': 'error',
      'ts/no-extra-non-null-assertion': 'error',
      'ts/no-floating-promises': 'error',
      'ts/no-for-in-array': 'error',
      'no-implied-eval': 'off',
      'ts/no-implied-eval': 'error',
      'no-loss-of-precision': 'off',
      'ts/no-loss-of-precision': 'error',
      'ts/no-misused-new': 'error',
      'ts/no-misused-promises': 'error',
      'ts/no-namespace': 'error',
      'ts/no-non-null-asserted-optional-chain': 'error',
      'ts/no-redundant-type-constituents': 'error',
      'ts/no-this-alias': 'error',
      'ts/no-unnecessary-type-assertion': 'error',
      'ts/no-unnecessary-type-constraint': 'error',
      'ts/no-unsafe-argument': 'error',
      'ts/no-unsafe-assignment': 'error',
      'ts/no-unsafe-call': 'error',
      'ts/no-unsafe-declaration-merging': 'error',
      'ts/no-unsafe-enum-comparison': 'error',
      'ts/no-unsafe-member-access': 'error',
      'ts/no-unsafe-return': 'error',
      'no-unused-vars': 'off',
      'ts/no-unused-vars': 'error',
      'ts/no-var-requires': 'error',
      'ts/prefer-as-const': 'error',
      'require-await': 'off',
      'ts/require-await': 'error',
      'ts/restrict-plus-operands': 'error',
      'ts/restrict-template-expressions': 'error',
      'ts/triple-slash-reference': 'error',
      'ts/unbound-method': 'error',
      //endregion

      //region Copy pasted from https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/stylistic-type-checked.ts
      // because typescript-eslint doesn't provide a flat config for now.
      'ts/adjacent-overload-signatures': 'error',
      'ts/array-type': 'error',
      'ts/ban-tslint-comment': 'error',
      'ts/class-literal-property-style': 'error',
      'ts/consistent-generic-constructors': 'error',
      'ts/consistent-indexed-object-style': 'error',
      'ts/consistent-type-assertions': 'error',
      'ts/consistent-type-definitions': 'error',
      'dot-notation': 'off',
      'ts/dot-notation': 'error',
      'ts/no-confusing-non-null-assertion': 'error',
      'no-empty-function': 'off',
      'ts/no-empty-function': 'error',
      'ts/no-empty-interface': 'error',
      'ts/no-inferrable-types': 'error',
      'ts/non-nullable-type-assertion-style': 'error',
      'ts/prefer-for-of': 'error',
      'ts/prefer-function-type': 'error',
      'ts/prefer-namespace-keyword': 'error',
      'ts/prefer-nullish-coalescing': 'error',
      'ts/prefer-optional-chain': 'error',
      'ts/prefer-string-starts-ends-with': 'error',
      //endregion
    },
  },
  {
    files: ['**./*.ts', '**./*.mts', '**./*.cts', '**./*.tsx'],

    // See https://typescript-eslint.io/rules/
    rules: {
      'ts/array-type': 'error',

      'ts/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
          'ts-check': 'allow-with-description',
        },
      ],

      'ts/ban-tslint-comment': 'error',

      'ts/consistent-generic-constructors': 'error',

      'ts/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow-as-parameter' },
      ],

      'ts/consistent-type-definitions': 'error',

      'ts/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
          allowFunctionsWithoutTypeParameters: true,
          allowedNames: [],
          allowIIFEs: true,
        },
      ],

      'ts/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public',
          overrides: {
            properties: 'off',
          },
        },
      ],

      'ts/explicit-module-boundary-types': [
        'error',
        {
          allowArgumentsExplicitlyTypedAsAny: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowedNames: [],
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],

      'ts/method-signature-style': 'error',

      'ts/naming-convention': [
        'error',
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: [
            'is',
            'should',
            'has',
            'can',
            'did',
            'will',
          ],
        },
        {
          selector: ['variable', 'function'],
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['UPPER_CASE', 'camelCase'],
        },
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          types: [
            'array',
            'boolean',
            'number',
            'string',
          ],
          format: ['UPPER_CASE'],
        },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          prefix: ['T'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false,
          },
        },
        {
          selector: [
            'classProperty',
            'objectLiteralProperty',
            'typeProperty',
            'classMethod',
            'objectLiteralMethod',
            'typeMethod',
            'accessor',
            'enumMember',
          ],
          modifiers: ['requiresQuotes'],
          format: null,
        },
        {
          selector: 'variable',
          modifiers: ['destructured'],
          format: null,
        },
      ],

      'ts/no-base-to-string': 'error',

      'ts/no-confusing-non-null-assertion': 'error',

      'ts/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],

      'ts/no-dynamic-delete': 'error',

      'ts/no-empty-interface': [
        'error',
        {
          allowSingleExtends: false,
        },
      ],

      'ts/no-explicit-any': 'off',

      'ts/no-extraneous-class': 'error',

      'ts/no-floating-promises': ['error', { ignoreVoid: true, ignoreIIFE: true }],

      'ts/no-import-type-side-effects': 'error',

      'ts/no-meaningless-void-operator': 'error',

      'ts/no-non-null-asserted-nullish-coalescing': 'error',

      'ts/no-non-null-asserted-optional-chain': 'off',

      'ts/no-non-null-assertion': 'off',

      'ts/no-unnecessary-boolean-literal-compare': 'error',

      'ts/no-unnecessary-condition': ['error', { allowConstantLoopConditions: true }],

      'ts/no-unnecessary-type-assertion': [
        'warn',
        {
          typesToIgnore: [
            // https://typescript-eslint.io/rules/no-unnecessary-type-assertion doesn't correctly handle those.
            'Element',
            'HTMLElement',
            'HTMLAnchorElement',
            'HTMLAreaElement',
            'HTMLAudioElement',
            'HTMLBRElement',
            'HTMLBaseElement',
            'HTMLBodyElement',
            'HTMLButtonElement',
            'HTMLCanvasElement',
            'HTMLContentElement',
            'HTMLDListElement',
            'HTMLDataElement',
            'HTMLDataListElement',
            'HTMLDialogElement',
            'HTMLDivElement',
            'HTMLEmbedElement',
            'HTMLFieldSetElement',
            'HTMLFormElement',
            'HTMLFrameSetElement',
            'HTMLHRElement',
            'HTMLHeadElement',
            'HTMLHeadingElement',
            'HTMLHtmlElement',
            'HTMLIFrameElement',
            'HTMLImageElement',
            'HTMLInputElement',
            'HTMLLIElement',
            'HTMLLabelElement',
            'HTMLLegendElement',
            'HTMLLinkElement',
            'HTMLMapElement',
            'HTMLMediaElement',
            'HTMLMetaElement',
            'HTMLMeterElement',
            'HTMLModElement',
            'HTMLOListElement',
            'HTMLObjectElement',
            'HTMLOptGroupElement',
            'HTMLOptionElement',
            'HTMLOutputElement',
            'HTMLParagraphElement',
            'HTMLPictureElement',
            'HTMLPreElement',
            'HTMLProgressElement',
            'HTMLQuoteElement',
            'HTMLScriptElement',
            'HTMLSelectElement',
            'HTMLShadowElement',
            'HTMLSourceElement',
            'HTMLSpanElement',
            'HTMLStyleElement',
            'HTMLTableCaptionElement',
            'HTMLTableCellElement',
            'HTMLTableColElement',
            'HTMLTableElement',
            'HTMLTableRowElement',
            'HTMLTableSectionElement',
            'HTMLTemplateElement',
            'HTMLTextAreaElement',
            'HTMLTimeElement',
            'HTMLTitleElement',
            'HTMLTrackElement',
            'HTMLUListElement',
            'HTMLUnknownElement',
            'HTMLVideoElement',
          ],
        },
      ],

      'ts/no-unnecessary-type-arguments': 'error',

      'ts/no-unsafe-argument': 'off',

      'ts/no-unsafe-assignment': 'off',

      'ts/no-unsafe-call': 'off',

      'ts/no-unsafe-member-access': 'off',

      'ts/no-unsafe-return': 'off',

      'ts/non-nullable-type-assertion-style': 'error',

      'ts/prefer-includes': 'error',

      'ts/prefer-nullish-coalescing': 'error',

      'ts/prefer-optional-chain': 'error',

      'ts/prefer-reduce-type-parameter': 'error',

      'ts/prefer-string-starts-ends-with': 'error',

      'ts/restrict-plus-operands': ['error', { allowAny: true }],

      'ts/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: true,
          allowNullish: true,
          allowRegExp: true,
        },
      ],

      'ts/unbound-method': ['error', { ignoreStatic: true }],

      'ts/unified-signatures': ['error', { ignoreDifferentlyNamedParameters: true }],

      //region Extension Rules

      /* https://typescript-eslint.io/rules/no-extra-semi/ insists that a semi after export statement is extra.
       Disabled this. Just use the base rule.
       Update: Disabled the base rule instead because
               it keeps complaining there should be a semicolon when there already is a semicolon.
       Update: Disabled both because I want to use extra semicolons and I will let dprint handle it. */
      'ts/no-extra-semi': 'off',

      // Disable the base rule.
      'require-await': 'off',
      //endregion
    },
  },
];
