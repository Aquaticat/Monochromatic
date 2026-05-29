/**
 * Tests for `tomlInsertCommentAfter`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { TomlPathNotFoundError, } from './errors.ts';
import { parseTomlEdit, } from './parse-toml-edit.ts';
import { tomlInsertCommentAfter, } from './toml-insert-comment-after.ts';
import { tomlStringify, } from './toml-stringify.ts';

await describe({
  name: tomlInsertCommentAfter.name,
  children: [
    it({
      name: 'appends an inline trailing comment on the same line',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'foo = 1\n', },);
        const e1 = tomlInsertCommentAfter({
          edit,
          path: ['foo',],
          comment: 'note',
        },);
        expect(tomlStringify({ edit: e1, },),).toBe('foo = 1  # note\n',);
      },
    },),

    it({
      name: 'throws TomlPathNotFoundError for missing path',
      fn: async () => {
        expect(function insert() {
          tomlInsertCommentAfter({
            edit: parseTomlEdit({ source: 'foo = 1\n', },),
            path: ['missing',],
            comment: 'x',
          },);
        },)
          .toThrow(TomlPathNotFoundError,);
      },
    },),
  ],
},);
