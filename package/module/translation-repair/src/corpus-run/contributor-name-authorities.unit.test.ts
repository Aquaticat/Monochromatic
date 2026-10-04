/**
 Tests for the contributor-name authorities, one per original name.
 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nameAuthorities, } from '../../dist/final/node/index.mjs';
import { pair, } from './title-reference.test-fixture.ts';

await describe({
  name: nameAuthorities.name,
  children: [
    it({
      name: 'READS NO page rendering where the page names no section at that position, leaving the '
        + 'handle to its pinyin reading',
      fn: async () => {
        /**
         Authorities of one named slice whose page carries no section for
         the name at its position.
         */
        const authorities = nameAuthorities({
          slices: [pair({
            sliceIndex: 1,
            source: '### 其十：锦猫\n\n它醒了。\n\n<p style="text-align: end;">——锦猫, 2025 年 2 月 10 日</p>',
            target: '',
          },),],
          pageText: new Map([[1, '### Anon\n\nUnrelated.',],]),
        },);
        expect(authorities.get('锦猫',)?.rendering,).toBe('Jinmao',);
      },
    },),
  ],
},);
