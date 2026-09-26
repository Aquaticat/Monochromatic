/**
 Tests for the package entry point's export surface.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  InvalidInputsError,
  InvalidPatternsError,
  isMatch,
  matcher,
} from '../dist/final/neutral/index.mjs';

await describe({
  name: '',
  children: [
    it({
      name: 'exports the matcher entry points and both error classes',
      fn: async () => {
        expect(typeof matcher,).toBe('function',);
        expect(typeof isMatch,).toBe('function',);
        expect(typeof InvalidInputsError,).toBe('function',);
        expect(typeof InvalidPatternsError,).toBe('function',);
      },
    },),

    it({
      name: 'filters inputs through the package entry point',
      fn: async () => {
        expect(matcher({
          inputs: [
            'foo',
            'bar',
            'moo',
          ],
          patterns: [
            '*oo',
            '!foo',
          ],
        },),).toEqual([
          'moo',
        ],);
      },
    },),

    it({
      name: 'answers through the package entry point',
      fn: async () => {
        expect(isMatch({
          inputs: 'unicorn',
          patterns: 'uni*',
        },),).toBe(true,);
      },
    },),
  ],
},);
