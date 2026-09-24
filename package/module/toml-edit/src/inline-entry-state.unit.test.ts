import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  emptyTomlEdit,
  parseTomlEdit,
  tomlSet,
} from '@monochromatic-dev/module-toml-edit';

await describe({
  name: 'parsed inline-table state',
  children: [
    it({
      name: 'does not attach phantom comments to inline entries',
      fn: async () => {
        const edit = parseTomlEdit({ source: 't = { x = 1 }\n', },);
        const block = edit.blocks.find(function isKeyValue(entry,) {
          return entry.kind === 'keyvalue';
        },);
        if ((block === undefined) || (block.kind !== 'keyvalue'))
          throw new Error('Expected parsed key-value block',);
        if (block.value.kind !== 'inline-table')
          throw new Error('Expected parsed inline-table value',);
        expect(block.value.entries[0]?.commentsBefore,).toStrictEqual([],);
      },
    },),
    it({
      name: 'does not add comments to synthetic inline-table entries',
      fn: async () => {
        const edit = tomlSet({
          edit: emptyTomlEdit(),
          path: ['t',],
          value: { x: 1, },
        },);
        const block = edit.blocks.find(function isKeyValue(entry,) {
          return entry.kind === 'keyvalue';
        },);
        if ((block === undefined) || (block.kind !== 'keyvalue'))
          throw new Error('Expected synthetic key-value block',);
        if (block.value.kind !== 'inline-table')
          throw new Error('Expected synthetic inline-table value',);
        expect(block.value.entries[0]?.commentsBefore,).toStrictEqual([],);
      },
    },),
  ],
},);
