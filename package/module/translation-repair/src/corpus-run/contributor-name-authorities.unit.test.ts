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
            sliceIndex: 0,
            source: '### 其三：猫猫\n\n它睡了。\n\n> <p style="text-align: end;">——猫猫, 2024 年 12 月 17 日</p>',
            target: '### Maomao\n\nIt sleeps.\n\n> <p style="text-align: end;">—Maomao, December 17, 2024</p>',
          },),],
          pageText: new Map([[5, '### Anon\n\nUnrelated.',],]),
        },);
        expect(authorities.get('猫猫',)?.rendering,).toBe('Maomao',);
      },
    },),
  ],
},);
