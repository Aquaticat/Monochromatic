/**
 * Tests for `formatBytes`.
 *
 * @module
 */

import {
  describe,
  it,
} from '@monochromatic-dev/module-test';

import { formatBytes, } from './byte.ts';

await describe({
  name: 'formatBytes',
  children: [
    //region KiB branch: whole KiB

    it({
      name: 'renders 0 bytes as 0 KiB',
      fn: async ({ expect, },) => {
        expect(formatBytes(0,),).toBe('0 KiB',);
      },
    },),

    it({
      name: 'renders sub-KiB byte counts rounded to 0 KiB',
      fn: async ({ expect, },) => {
        expect(formatBytes(511,),).toBe('0 KiB',);
      },
    },),

    it({
      name: 'renders KiB-scale counts as whole KiB',
      fn: async ({ expect, },) => {
        expect(formatBytes(1_024,),).toBe('1 KiB',);
        expect(formatBytes(2_048,),).toBe('2 KiB',);
        expect(formatBytes(524_288,),).toBe('512 KiB',);
      },
    },),

    //endregion KiB branch: whole KiB

    //region MiB branch: one decimal

    it({
      name: 'renders 1 MiB at lower boundary with one decimal',
      fn: async ({ expect, },) => {
        expect(formatBytes(1_048_576,),).toBe('1.0 MiB',);
      },
    },),

    it({
      name: 'renders mid-range MiB with one decimal',
      fn: async ({ expect, },) => {
        expect(formatBytes(1_572_864,),).toBe('1.5 MiB',);
        expect(formatBytes(129_499_136,),).toBe('123.5 MiB',);
      },
    },),

    //endregion MiB branch: one decimal

    //region GiB branch: one decimal

    it({
      name: 'renders 1 GiB at lower boundary with one decimal',
      fn: async ({ expect, },) => {
        expect(formatBytes(1_073_741_824,),).toBe('1.0 GiB',);
      },
    },),

    it({
      name: 'renders mid-range GiB with one decimal',
      fn: async ({ expect, },) => {
        expect(formatBytes(2_684_354_560,),).toBe('2.5 GiB',);
      },
    },),

    //endregion GiB branch: one decimal
  ],
},);
