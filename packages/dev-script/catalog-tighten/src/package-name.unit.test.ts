/**
 * Unit tests for the npm package-name validator.
 *
 * Pins the grammar the issue #195 guard relies on: an optional `@scope/`
 * prefix plus a name, each segment starting lowercase-alphanumeric and
 * continuing with `[a-z0-9._-]`. Real catalog keys must pass; crafted keys
 * (`__proto__`), malformed shapes, and uppercase must fail.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isValidPackageName,
} from './package-name.ts';

/** Real catalog keys that must validate. */
const VALID_NAMES: readonly string[] = [
  'oxlint',
  'opentype.js',
  'lezer-json5',
  '@anthropic-ai/sdk',
  '@types/node',
  '@total-typescript/ts-reset',
];

/** Crafted or malformed keys that must be rejected. */
const INVALID_NAMES: readonly string[] = [
  '__proto__',
  '',
  '@',
  '@scope',
  '@scope/',
  '@/name',
  'a/b/c',
  '.leading-dot',
  '_leading-underscore',
  'Upper',
  'has space',
  '# TypeScript 7 RC native compiler (binary',
];

await describe({
  name: 'package-name',
  children: [
    //region valid names
    ...VALID_NAMES.map(function validCase(name,) {
      return it({
        name: `accepts ${name}`,
        fn: async () => {
          expect(isValidPackageName(name,),).toBe(true,);
        },
      },);
    },),
    //endregion valid names

    //region invalid names
    ...INVALID_NAMES.map(function invalidCase(name,) {
      return it({
        name: `rejects ${JSON.stringify(name,)}`,
        fn: async () => {
          expect(isValidPackageName(name,),).toBe(false,);
        },
      },);
    },),
    //endregion invalid names
  ],
},);
