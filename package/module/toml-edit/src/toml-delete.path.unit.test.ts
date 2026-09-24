import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  parseTomlEdit,
  tomlDelete,
  tomlGetValue,
  tomlStringify,
} from '@monochromatic-dev/module-toml-edit';

await describe({
  name: 'nested deletion paths',
  children: [
    it({
      name: 'deletes the root document without changing the original state',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'a = 1\n[b]\nx = 2\n', },);
        const deleted = tomlDelete({ edit, path: [], },);
        expect(tomlStringify({ edit: deleted, },),).toBe('',);
        expect(tomlStringify({ edit, },),).toBe('a = 1\n[b]\nx = 2\n',);
      },
    },),
    it({
      name: 'removes a field from only the selected array-of-tables instance',
      fn: async () => {
        const edit = parseTomlEdit({ source: '[[foo]]\nname="a"\n[[foo]]\nname="b"\n', },);
        const deleted = tomlDelete({ edit, path: ['foo', 1, 'name',], },);
        expect(tomlGetValue({ edit: deleted, path: ['foo',], },),).toEqual([
          { name: 'a', },
          {},
        ],);
        expect(tomlStringify({ edit: deleted, },),).toBe('[[foo]]\nname="a"\n[[foo]]\n',);
      },
    },),
    it({
      name: 'descends through nested standard-table headers',
      fn: async () => {
        const edit = parseTomlEdit({ source: '[a.b]\nx=1\ny=2\n[a.c]\nz=3\n', },);
        const deleted = tomlDelete({ edit, path: ['a', 'b', 'x',], },);
        expect(tomlStringify({ edit: deleted, },),).toBe('[a.b]\ny=2\n[a.c]\nz=3\n',);
        expect(tomlGetValue({ edit: deleted, path: ['a', 'c', 'z',], },),).toBe(3,);
      },
    },),
    it({
      name: 'descends through an inline-table entry before removing a nested field',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'foo = { a = { b = 1, c = 2 }, d = 3 }\n', },);
        const deleted = tomlDelete({ edit, path: ['foo', 'a', 'b',], },);
        expect(tomlGetValue({ edit: deleted, path: ['foo',], },),).toEqual({
          a: { c: 2, },
          d: 3,
        },);
        expect(tomlStringify({ edit: deleted, },),).toBe('foo = { a = { c = 2, }, d = 3, }\n',);
      },
    },),
    it({
      name: 'ignores array indices outside the current bounds',
      fn: async () => {
        const source = 'arr = [10,20]\n';
        const edit = parseTomlEdit({ source, },);
        for (const index of [-1, 2, 3,])
          expect(tomlStringify({ edit: tomlDelete({ edit, path: ['arr', index,], },), },),).toBe(source,);
      },
    },),
  ],
},);
