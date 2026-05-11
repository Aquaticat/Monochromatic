/**
 * Tests for `findMonorepoRoot`.
 *
 * Runs from inside the Monochromatic monorepo, so the upward walk must succeed
 * and resolve to the directory containing the monorepo's `mise.toml`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { findMonorepoRoot, } from './find-monorepo-root.ts';
import { isAbsolute, } from './index.ts';

await describe({
  name: 'findMonorepoRoot',
  children: [
    it({
      name: 'returns an absolute path when called from inside the monorepo',
      fn: async () => {
        const root = await findMonorepoRoot();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
    it({
      name: 'returns the monorepo directory (Monochromatic) when called from this package',
      fn: async () => {
        const root = await findMonorepoRoot({ cwd: import.meta.dirname, },);
        expect(root.endsWith('/Monochromatic',),).toBe(true,);
      },
    },),
    it({
      name: 'normalizes /home/ to /var/home/ on Fedora ostree systems',
      fn: async () => {
        const root = await findMonorepoRoot();
        expect(root.startsWith('/home/',),).toBe(false,);
      },
    },),
  ],
},);
