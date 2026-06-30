import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isRecord,
  isWhitespaceChar,
  isWordChar,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  children: [
    describe({
      name: isWhitespaceChar.name,
      children: [
        it({
          name: 'accepts ASCII whitespace characters',
          fn: async () => {
            expect([
              ' ',
              '\t',
              '\n',
              '\r',
              '\f',
              '\v',
            ].every(function check(char,): boolean {
              return isWhitespaceChar(char,);
            },),).toBe(true,);
          },
        },),
        it({
          name: 'rejects non-whitespace characters',
          fn: async () => {
            expect(isWhitespaceChar('x',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: isWordChar.name,
      children: [
        it({
          name: 'accepts ASCII letters digits and underscore',
          fn: async () => {
            expect([
              'a',
              'Z',
              '0',
              '9',
              '_',
            ].every(function check(char,): boolean {
              return isWordChar(char,);
            },),).toBe(true,);
          },
        },),
        it({
          name: 'rejects punctuation',
          fn: async () => {
            expect(isWordChar('-',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: isRecord.name,
      children: [
        it({
          name: 'accepts object values',
          fn: async () => {
            expect(isRecord({ value: true, },),).toBe(true,);
          },
        },),
        it({
          name: 'rejects null and primitives',
          fn: async () => {
            expect(isRecord(null,),).toBe(false,);
            expect(isRecord('value',),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
