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
  //region jest: Suppress leaked jest rules from vitest plugin internals.
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

  // False positives on generic functions with nullable params (e.g. nonNullishOrThrow).
  // See TROUBLESHOOTING.tsgolint-no-unnecessary-type-assertion.md
  'typescript/no-unnecessary-type-assertion': 'off',

  // Disabled: oxlint's type-aware analysis produces false positives on DOM types
  // (e.g. flags `Element.textContent ?? ''` as unnecessary even though textContent
  // is `string | null` per spec) and its auto-fix would silently strip defensive
  // null checks, causing runtime crashes. The rule has no per-rule fix-disable
  // option, so the whole rule is turned off.
  'typescript/no-unnecessary-condition': 'off',

  // The rule fundamentally cannot model immutability of Web platform types
  // (TypedArrays carry a mutable numeric index signature, DOM nodes carry
  // mutator methods, fetch types have stream-consuming methods marked
  // mutable), nor third-party SDK types where the library owns the
  // signature. Whitelist those families via the upstream `allow` option
  // and turn on `ignoreInferredTypes` so callbacks whose signature is
  // dictated by an external lib (e.g. h3 EventHandlerWithFetch) are not
  // flagged when the parameter is left un-annotated. `treatMethodsAsReadonly`
  // is intentionally left at the default `false` because it silently passes
  // legitimate Set/Map/class-state mutations (verified empirically against
  // /tmp/oxlint-prerod fixture, 2026-05-18). Real mutable plain objects
  // (`{ value: string }`) and arrays (`string[]`) are still flagged.
  'typescript/prefer-readonly-parameter-types': [
    'warn',
    {
      allow: [
        {
          from: 'lib',
          name: [
            'Uint8Array',
            'Uint8ClampedArray',
            'Uint16Array',
            'Uint32Array',
            'Int8Array',
            'Int16Array',
            'Int32Array',
            'Float32Array',
            'Float64Array',
            'BigInt64Array',
            'BigUint64Array',
            'ArrayBuffer',
            'SharedArrayBuffer',
            'DataView',
          ],
        },
        {
          from: 'lib',
          name: [
            'Request',
            'Response',
            'Headers',
            'Body',
            'Blob',
            'FormData',
            'AbortSignal',
            'AbortController',
            'ReadableStream',
            'WritableStream',
            'ReadableStreamDefaultReader',
            'WritableStreamDefaultWriter',
            'URL',
            'URLSearchParams',
            'MessageEvent',
            'MessagePort',
          ],
        },
        {
          from: 'lib',
          name: [
            'EventTarget',
            'Event',
            'KeyboardEvent',
            'MouseEvent',
            'FocusEvent',
            'InputEvent',
            'Node',
            'Element',
            'Document',
            'HTMLElement',
            'HTMLAnchorElement',
            'HTMLButtonElement',
            'HTMLDialogElement',
            'HTMLFormElement',
            'HTMLInputElement',
            'HTMLOptionElement',
            'HTMLSelectElement',
            'HTMLTextAreaElement',
          ],
        },
        {
          from: 'package',
          package: 'h3',
          name: [
            'H3Event',
            'H3EventContext',
            'H3EventResponse',
            'EventHandler',
            'EventHandlerObject',
            'EventHandlerWithFetch',
          ],
        },
        {
          from: 'package',
          package: 'srvx',
          name: [
            'ServeHandle',
          ],
        },
        {
          from: 'package',
          package: '@libsql/client',
          name: [
            'Client',
            'Database',
          ],
        },
      ],
      ignoreInferredTypes: true,
    },
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
