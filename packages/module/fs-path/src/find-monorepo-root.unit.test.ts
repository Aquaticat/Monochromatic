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

import {
  findMonorepoRoot,
  findMonorepoRootCached,
} from './find-monorepo-root.ts';
import { isAbsolute, } from './index.ts';

await describe({
  name: findMonorepoRoot.name,
  children: [
    it({
      name: 'returns an absolute path when called from inside the monorepo',
      fn: async () => {
        const root = await findMonorepoRoot();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
    it({
      name:
        'returns the monorepo directory (Monochromatic) when called from this package',
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

await describe({
  name: findMonorepoRootCached.name,
  children: [
    it({
      name: 'resolves to the same root that findMonorepoRoot returns from process.cwd()',
      fn: async () => {
        const cached = await findMonorepoRootCached();
        const fresh = await findMonorepoRoot();
        expect(cached,).toBe(fresh,);
      },
    },),
    it({
      name: 'returns the same value across sequential calls',
      fn: async () => {
        const first = await findMonorepoRootCached();
        const second = await findMonorepoRootCached();
        const third = await findMonorepoRootCached();
        expect(first,).toBe(second,);
        expect(second,).toBe(third,);
      },
    },),
    it({
      name: 'resolves concurrent callers to the same value (one walk shared)',
      fn: async () => {
        const [a, b, c, d,] = await Promise.all([
          findMonorepoRootCached(),
          findMonorepoRootCached(),
          findMonorepoRootCached(),
          findMonorepoRootCached(),
        ],);
        expect(a,).toBe(b,);
        expect(b,).toBe(c,);
        expect(c,).toBe(d,);
      },
    },),
    it({
      name: 'returns an absolute path',
      fn: async () => {
        const root = await findMonorepoRootCached();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
  ],
},);
