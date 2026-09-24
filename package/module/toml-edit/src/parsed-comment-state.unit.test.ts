import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseTomlEdit, } from '@monochromatic-dev/module-toml-edit';

await describe({
  name: 'parsed comment state',
  children: [
    it({
      name: 'retains attached lines and a hash adjacent to the value',
      fn: async () => {
        const edit = parseTomlEdit({ source: '# one\n# two\nkey = 1#tail\n', },);
        const block = edit.blocks.find(function isKeyValue(entry,) {
          return entry.kind === 'keyvalue';
        },);
        if ((block === undefined) || (block.kind !== 'keyvalue'))
          throw new Error('Expected parsed key-value block',);
        expect(block.commentsBefore,).toStrictEqual([' one', ' two',],);
        expect(block.commentAfter,).toBe('tail',);
      },
    },),
  ],
},);
