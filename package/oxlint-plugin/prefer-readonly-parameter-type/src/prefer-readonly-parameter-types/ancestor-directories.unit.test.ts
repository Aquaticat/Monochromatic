import {
  dirname,
  join,
  parse,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { ancestorDirectories, } from './ancestor-directories.ts';

await describe({
  name: ancestorDirectories.name,
  children: [
    it({
      name: 'yields the start and each ancestor through the filesystem root once',
      fn() {
        const root = parse(process.cwd(),).root;
        const start = join(
          root,
          'ancestor-probe-parent',
          'ancestor-probe-child',
        );
        expect([...ancestorDirectories(start,)],).toEqual([
          start,
          dirname(start,),
          root,
        ],);
      },
    },),
    it({
      name: 'yields a root starting point exactly once',
      fn() {
        const root = parse(process.cwd(),).root;
        expect([...ancestorDirectories(root,)],).toEqual([root,],);
      },
    },),
  ],
},);
