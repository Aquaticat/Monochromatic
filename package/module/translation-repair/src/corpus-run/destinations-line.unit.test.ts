/**
 * Tests for the per-entry destinations line.
 *
 * WHAT THESE PIN: the line carries the three counts under stable names a grep
 * can total, carries no address, and appends findings after the counts.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { destinationsLine, } from '../../dist/final/node/index.mjs';

await describe({
  name: destinationsLine.name,
  children: [
    it({
      name: 'carries the three counts and no address',
      fn: async () => {
        const line = destinationsLine({
          entryId: 'BookshopCat',
          destinations: {
            source: [
              'https://example.org/tabby',
              'https://example.org/album',
            ],
            page: ['https://example.org/album',],
            dropped: ['https://example.org/tabby',],
            findings: [],
          },
        },);

        expect(line,).toBe('DESTINATIONS BookshopCat source=2 page=1 dropped=1',);
      },
    },),

    it({
      name: 'appends each finding after the counts',
      fn: async () => {
        const line = destinationsLine({
          entryId: 'BookshopCat',
          destinations: {
            source: [],
            page: [],
            dropped: [],
            findings: ['destinations-mdx-downgraded (page)',],
          },
        },);

        expect(line,).toBe(
          'DESTINATIONS BookshopCat source=0 page=0 dropped=0 destinations-mdx-downgraded (page)',
        );
      },
    },),
  ],
},);
