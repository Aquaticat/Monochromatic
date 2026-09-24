import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  parseTomlEdit,
  tomlGetCommentAfter,
  tomlGetCommentsBefore,
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
