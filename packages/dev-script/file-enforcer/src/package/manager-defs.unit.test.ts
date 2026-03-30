import {
  describe,
  expect,
  test,
} from 'bun:test';
import {
  MANAGER_KEYS,
  MANAGERS,
} from './manager-defs.ts';
import type { PackageManager, } from './types.ts';

//region MANAGERS ordering

describe('MANAGERS', () => {
  test('has brew as the first entry (preferred on immutable distros)', () => {
    const [first,] = MANAGERS.keys();
    expect(first,).toBe('brew',);
  });

  test('contains every PackageManager variant', () => {
    /** All values from the PackageManager union */
    const expected: readonly PackageManager[] = [
      'apk',
      'apt',
      'brew',
      'choco',
      'dnf',
      'pacman',
      'scoop',
      'zypper',
    ];
    for (const name of expected)
      expect(MANAGERS.has(name,),).toBe(true,);
    expect(MANAGERS.size,).toBe(expected.length,);
  });

  test('every entry has non-empty check, search, and install arrays', () => {
    for (const [name, def,] of MANAGERS) {
      expect(
        def.check.length,
      )
        .toBeGreaterThan(
          0,
        );
      expect(
        def.search.length,
      )
        .toBeGreaterThan(
          0,
        );
      expect(
        def.install.length,
      )
        .toBeGreaterThan(
          0,
        );
      /** install template must contain {pkg} placeholder */
      expect(def.install.includes('{pkg}',),).toBe(true,);
      /** search template must contain {pkg} placeholder */
      expect(def.search.includes('{pkg}',),).toBe(true,);
    }
  });
});

//endregion MANAGERS ordering

//region MANAGER_KEYS

describe('MANAGER_KEYS', () => {
  test('is derived from MANAGERS and has the same size', () => {
    expect(MANAGER_KEYS.size,).toBe(MANAGERS.size,);
  });

  test('contains every key from MANAGERS', () => {
    for (const name of MANAGERS.keys())
      expect(MANAGER_KEYS.has(name,),).toBe(true,);
  });
});

//endregion MANAGER_KEYS
