import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  emptyTomlEdit,
  parseTomlEdit,
  tomlGetValue,
  tomlSet,
  tomlStringify,
} from '@monochromatic-dev/module-toml-edit';

await describe({
  name: 'synthetic value-node emission',
  children: [
    it({
      name: 'indents nested synthetic arrays relative to each parent',
      fn: async () => {
        const base = emptyTomlEdit({
          canonical: { arrayInlineThreshold: 1, arrayInlineMaxColumns: 9, },
        },);
        const edit = tomlSet({ edit: base, path: ['nested',], value: [[1, 2,], [3,],], },);
        const text = tomlStringify({ edit, },);
        expect(text,).toBe('nested = [\n  [\n    1,\n    2,\n  ],\n  [ 3, ],\n]\n',);
        expect(tomlGetValue({
          edit: parseTomlEdit({ source: text, },),
          path: ['nested',],
        },),).toEqual([[1, 2,], [3,],],);
      },
    },),
    it({
      name: 'indents an array inside a synthetic inline table',
      fn: async () => {
        const base = emptyTomlEdit({
          canonical: { arrayInlineThreshold: 1, arrayInlineMaxColumns: 9, },
        },);
        const edit = tomlSet({ edit: base, path: ['inline',], value: { xs: [1, 2,], }, },);
        const text = tomlStringify({ edit, },);
        expect(text,).toBe('inline = { xs = [\n    1,\n    2,\n  ], }\n',);
        expect(tomlGetValue({
          edit: parseTomlEdit({ source: text, },),
          path: ['inline', 'xs',],
        },),).toEqual([1, 2,],);
      },
    },),
  ],
},);
