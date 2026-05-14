/**
 * Tests for attached / trailing comment resolution.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { parseTomlEdit, } from './parse-toml-edit.ts';
import { tomlGetCommentAfter, } from './toml-get-comment-after.ts';
import { tomlGetCommentsBefore, } from './toml-get-comments-before.ts';

await describe({
  name: 'tomlGetCommentsBefore / tomlGetCommentAfter',
  children: [
    it({
      name: 'two consecutive # lines attach as a block',
      fn: async () => {
        const source = '# one\n# two\nkey = 1\n';
        const edit = parseTomlEdit({ source, },);
        const attached = tomlGetCommentsBefore({ edit, path: ['key',], },);
        expect(attached.length,).toBe(2,);
        expect(nonNullishOrThrow(attached[0],).value,).toBe(' one',);
        expect(nonNullishOrThrow(attached[1],).value,).toBe(' two',);
      },
    },),

    it({
      name: 'a blank line between comment and key breaks attachment',
      fn: async () => {
        const source = '# header\n\nkey = 1\n';
        const edit = parseTomlEdit({ source, },);
        const attached = tomlGetCommentsBefore({ edit, path: ['key',], },);
        expect(attached.length,).toBe(0,);
      },
    },),

    it({
      name: 'trailing inline comment on same line',
      fn: async () => {
        const source = 'key = 1  # trailing\n';
        const edit = parseTomlEdit({ source, },);
        const trailing = tomlGetCommentAfter({ edit, path: ['key',], },);
        expect(trailing,).not.toBe(null,);
        expect(nonNullishOrThrow(trailing,).value,).toBe(' trailing',);
      },
    },),

    it({
      name: 'trailing inline comment absent returns null',
      fn: async () => {
        const source = 'key = 1\n';
        const edit = parseTomlEdit({ source, },);
        expect(tomlGetCommentAfter({ edit, path: ['key',], },),).toBe(null,);
      },
    },),
  ],
},);
