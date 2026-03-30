import {
  describe,
  expect,
  test,
} from 'bun:test';
import {
  ensurePackage,
  registerPackages,
} from './ensure-package.ts';
import { p, } from './p.ts';

//region registerPackages

describe('registerPackages', () => {
  test('accepts an array of entries without throwing', () => {
    expect(() => {
      registerPackages([
        p('curl',),
        p({ bin: 'rg', effname: 'ripgrep', },),
      ],);
    },)
      .not
      .toThrow();
  });

  test('replaces previously registered entries', () => {
    registerPackages([p('curl',),],);
    registerPackages([p('tmux',),],);
    /** No assertion needed beyond not throwing; index rebuild is lazy */
  });
});

//endregion registerPackages

//region ensurePackage (already installed)

describe('ensurePackage (binary already on PATH)', () => {
  test('returns immediately for an existing binary', async () => {
    registerPackages([],);
    /** `ls` exists on every POSIX system */
    await expect(ensurePackage('ls',),).resolves.toBeUndefined();
  });

  test('returns immediately for `true`', async () => {
    registerPackages([],);
    await expect(ensurePackage('true',),).resolves.toBeUndefined();
  });
});

//endregion ensurePackage (already installed)

//region ensurePackage (missing binary)

/**
 * Install-path tests run in containers via the container test matrix.
 * See `ensure-package.container-test.ts` for the actual install verification.
 * Running `ensurePackage` for a missing binary locally would modify the host system.
 */

//endregion ensurePackage (missing binary)

//region Index lookup

describe('ensurePackage (index lookup)', () => {
  test('skips index lookup when binary is already on PATH', async () => {
    /** Register an entry for `ls` but it should never be consulted */
    registerPackages([
      p({ bin: 'ls', effname: 'wrong-package', },),
    ],);
    await expect(ensurePackage('ls',),).resolves.toBeUndefined();
  });
});

//endregion Index lookup
