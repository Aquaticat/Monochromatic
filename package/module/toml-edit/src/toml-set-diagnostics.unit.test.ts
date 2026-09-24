import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  parseTomlEdit,
  tomlSet,
} from '@monochromatic-dev/module-toml-edit';

await describe({
  name: 'set rejection diagnostics',
  children: [
    it({
      name: 'names the failing path and the unsupported edit',
      fn: async () => {
        const cases = [
          {
            source: 'foo = {}\n',
            path: ['foo', 0, 'bar',],
            value: 3,
            message: 'Cannot set numeric segment 0 in foo[0].bar',
          },
          {
            source: 'foo = { a.b.c = 1 }\n',
            path: ['foo', 'a', 'b',],
            value: 3,
            message: 'tomlSet at foo.a.b would create invalid TOML: inline-table key a.b.c overlaps a.b',
          },
          {
            source: 'foo = 1\n',
            path: ['foo', 'bar',],
            value: 3,
            message: 'Cannot path-create through scalar at path foo.bar',
          },
          {
            source: '[[foo]]\nx=1\n',
            path: ['foo',],
            value: 42,
            message: 'tomlSet on an array-of-tables at foo requires an array value; pass [] to clear all instances',
          },
          {
            source: '[a.b]\nx=1\n[a.c]\ny=2\n',
            path: ['a',],
            value: {},
            message: 'tomlSet on the sibling tables at a is not supported; set per sub-table instead',
          },
          {
            source: '[foo]\nx=1\n',
            path: ['foo',],
            value: 42,
            message: 'tomlSet at foo requires a plain object to replace a table body',
          },
        ] as const;
        for (const { source, path, value, message, } of cases) {
          const edit = parseTomlEdit({ source, },);
          expect(() => tomlSet({ edit, path, value, },),).toThrow(message,);
        }
      },
    },),
  ],
},);
