/**
 * Tests for `findMiseMonorepoRoot`.
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
  findMiseMonorepoRoot,
  findMiseMonorepoRootCached,
} from './find-monorepo-root.ts';
import { isAbsolute, } from './index.ts';

await describe({
  name: findMiseMonorepoRoot.name,
  children: [
    it({
      name: 'returns an absolute path when called from inside the monorepo',
      fn: async () => {
        const root = await findMiseMonorepoRoot();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
    it({
      name:
        'returns the monorepo directory (Monochromatic) when called from this package',
      fn: async () => {
        const root = await findMiseMonorepoRoot({ cwd: import.meta.dirname, },);
        expect(root.endsWith('/Monochromatic',),).toBe(true,);
      },
    },),
    it({
      name: 'normalizes /home/ to /var/home/ on Fedora ostree systems',
      fn: async () => {
        const root = await findMiseMonorepoRoot();
        expect(root.startsWith('/home/',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: findMiseMonorepoRootCached.name,
  children: [
    it({
      name: 'resolves to the same root that findMiseMonorepoRoot returns from process.cwd()',
      fn: async () => {
        const cached = await findMiseMonorepoRootCached();
        const fresh = await findMiseMonorepoRoot();
        expect(cached,).toBe(fresh,);
      },
    },),
    it({
      name: 'returns the same value across sequential calls',
      fn: async () => {
        const first = await findMiseMonorepoRootCached();
        const second = await findMiseMonorepoRootCached();
        const third = await findMiseMonorepoRootCached();
        expect(first,).toBe(second,);
        expect(second,).toBe(third,);
      },
    },),
    it({
      name: 'resolves concurrent callers to the same value (one walk shared)',
      fn: async () => {
        const [a, b, c, d,] = await Promise.all([
          findMiseMonorepoRootCached(),
          findMiseMonorepoRootCached(),
          findMiseMonorepoRootCached(),
          findMiseMonorepoRootCached(),
        ],);
        expect(a,).toBe(b,);
        expect(b,).toBe(c,);
        expect(c,).toBe(d,);
      },
    },),
    it({
      name: 'returns an absolute path',
      fn: async () => {
        const root = await findMiseMonorepoRootCached();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
  ],
},);
