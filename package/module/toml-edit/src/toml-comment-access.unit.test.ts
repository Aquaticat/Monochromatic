import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  parseTomlEdit,
  tomlGetCommentAfter,
  tomlGetCommentsBefore,
  tomlInsertCommentAfter,
  tomlInsertCommentBefore,
  tomlStringify,
  TomlPathNotFoundError,
} from '@monochromatic-dev/module-toml-edit';

await describe({
  name: 'comment accessor boundaries',
  children: [
    it({
      name: 'reports the missing path in both comment accessors',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'key = 1\n', },);
        expect(() => tomlGetCommentAfter({ edit, path: ['missing',], },),)
          .toThrow('Path missing not found',);
        expect(() => tomlGetCommentsBefore({ edit, path: ['missing',], },),)
          .toThrow(TomlPathNotFoundError,);
        expect(() => tomlGetCommentsBefore({ edit, path: ['missing',], },),)
          .toThrow('Path missing not found',);
      },
    },),
    it({
      name: 'rejects missing insertion paths with a named diagnostic',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'key = 1\n', },);
        expect(() => tomlInsertCommentAfter({ edit, path: ['missing',], comment: 'note', },),)
          .toThrow('Path missing not found',);
        expect(() => tomlInsertCommentBefore({ edit, path: ['missing',], comment: 'note', },),)
          .toThrow('Path missing not found',);
      },
    },),
    it({
      name: 'inserts comments inside a standard table without touching sibling tables',
      fn: async () => {
        const source = '[a]\nx=1\ny=2\n[b]\nz=3\n';
        const edit = parseTomlEdit({ source, },);
        expect(tomlStringify({
          edit: tomlInsertCommentBefore({ edit, path: ['a', 'y',], comment: 'note', },),
        },),).toBe('[a]\nx=1\n# note\ny=2\n[b]\nz=3\n',);
        expect(tomlStringify({
          edit: tomlInsertCommentAfter({ edit, path: ['a', 'y',], comment: 'note', },),
        },),).toBe('[a]\nx=1\ny=2  # note\n[b]\nz=3\n',);
      },
    },),
    it({
      name: 'keeps earlier top-level entries when inserting before a later key',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'first=1\nsecond=2\n', },);
        const updated = tomlInsertCommentBefore({ edit, path: ['second',], comment: 'note', },);
        expect(tomlStringify({ edit: updated, },),).toBe('first=1\n# note\nsecond=2\n',);
      },
    },),
    it({
      name: 'reads an attached block and same-line comment on a standard table header',
      fn: async () => {
        const edit = parseTomlEdit({ source: '# before\n[table] # after\nx = 1\n', },);
        expect(tomlGetCommentsBefore({ edit, path: ['table',], },)
          .map(function valueOf(comment,) {
            return comment.value;
          },),)
          .toStrictEqual([' before',],);
        expect(tomlGetCommentAfter({ edit, path: ['table',], },).comment?.value,)
          .toBe(' after',);
      },
    },),
    it({
      name: 'reads the selected array-of-tables header instead of another instance',
      fn: async () => {
        const edit = parseTomlEdit({
          source: '[[foo]] # first\nx = 1\n[[foo]] # second\nx = 2\n',
        },);
        expect(tomlGetCommentAfter({ edit, path: ['foo', 0,], },).comment?.value,)
          .toBe(' first',);
        expect(tomlGetCommentAfter({ edit, path: ['foo', 1,], },).comment?.value,)
          .toBe(' second',);
        expect(tomlGetCommentAfter({ edit, path: ['foo',], },).comment?.value,)
          .toBe(' second',);
      },
    },),
  ],
},);
