/**
 * Tests for `findPackageRoot` and `findPackageRootCached`.
 *
 * Runs from inside the `@monochromatic-dev/module-fs-path` package, so
 * the upward walk asking for this package's own name must terminate at
 * this package's directory.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  findPackageRoot,
  findPackageRootCached,
  isAbsolute,
} from '@monochromatic-dev/module-fs-path';

/** Name in this package's own `package.json`; used as the walk target. */
const OWN_PACKAGE_NAME = '@monochromatic-dev/module-fs-path';

await describe({
  name: findPackageRoot.name,
  children: [
    it({
      name: 'returns absolute path when called from inside the package',
      fn: async () => {
        const root = await findPackageRoot({
          dir: import.meta.dirname,
          name: OWN_PACKAGE_NAME,
        },);
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
    it({
      name: "returns this package's directory when starting from its src/",
      fn: async () => {
        const root = await findPackageRoot({
          dir: import.meta.dirname,
          name: OWN_PACKAGE_NAME,
        },);
        expect(root.endsWith('/fs-path',),).toBe(true,);
      },
    },),
    it({
      name: 'throws when no matching package.json is found walking up',
      fn: async () => {
        const missingName = 'this-package-name-does-not-exist-anywhere-2026-05-12';
        let caught: unknown = undefined;
        try {
          await findPackageRoot({
            dir: import.meta.dirname,
            name: missingName,
          },);
        }
        catch (error: unknown) {
          caught = error;
        }
        expect(Error.isError(caught,),).toBe(true,);
        expect(
          Error.isError(caught,) && caught.message.includes(missingName,),
        )
          .toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: findPackageRootCached.name,
  children: [
    it({
      name: 'resolves concurrent callers to the same value (one walk shared)',
      fn: async () => {
        const [a, b, c, d,] = await Promise.all([
          findPackageRootCached({ dir: import.meta.dirname, name: OWN_PACKAGE_NAME, },),
          findPackageRootCached({ dir: import.meta.dirname, name: OWN_PACKAGE_NAME, },),
          findPackageRootCached({ dir: import.meta.dirname, name: OWN_PACKAGE_NAME, },),
          findPackageRootCached({ dir: import.meta.dirname, name: OWN_PACKAGE_NAME, },),
        ],);
        expect([a, b, c, d,],).toAllBe();
      },
    },),
    it({
      name: 'returns the same value across sequential calls',
      fn: async () => {
        const first = await findPackageRootCached({
          dir: import.meta.dirname,
          name: OWN_PACKAGE_NAME,
        },);
        const second = await findPackageRootCached({
          dir: import.meta.dirname,
          name: OWN_PACKAGE_NAME,
        },);
        const third = await findPackageRootCached({
          dir: import.meta.dirname,
          name: OWN_PACKAGE_NAME,
        },);
        expect([first, second, third,],).toAllBe();
      },
    },),
    it({
      name: 'matches findPackageRoot for the same arguments',
      fn: async () => {
        const cached = await findPackageRootCached({
          dir: import.meta.dirname,
          name: OWN_PACKAGE_NAME,
        },);
        const fresh = await findPackageRoot({
          dir: import.meta.dirname,
          name: OWN_PACKAGE_NAME,
        },);
        expect(cached,).toBe(fresh,);
      },
    },),
    it({
      name: 'returns an absolute path',
      fn: async () => {
        const root = await findPackageRootCached({
          dir: import.meta.dirname,
          name: OWN_PACKAGE_NAME,
        },);
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
  ],
},);
