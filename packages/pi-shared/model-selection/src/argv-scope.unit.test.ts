/**
 * Unit tests for argv scope parsing.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { ABSENT, } from './core.ts';
import { parseArgvModelPatterns, } from './scope.ts';

await describe({
  name: parseArgvModelPatterns.name,
  children: [
    it({
      name: 'parses separated and inline --models arguments',
      fn: async function testArgvModels() {
        expect(parseArgvModelPatterns({
          argv: [
            'pi',
            '--models',
            'cheap/*, expensive/reviewer ',
          ],
        },),)
          .toEqual([
            'cheap/*',
            'expensive/reviewer',
          ],);
        expect(parseArgvModelPatterns({ argv: ['--models=cheap/*',], },),)
          .toEqual(['cheap/*',],);
      },
    },),
    it({
      name: 'returns ABSENT when --models is absent',
      fn: async function testAbsentArgvModels() {
        expect(parseArgvModelPatterns({ argv: ['pi',], },),).toBe(ABSENT,);
      },
    },),
  ],
},);
