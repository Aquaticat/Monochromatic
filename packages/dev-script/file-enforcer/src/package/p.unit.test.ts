import {
  describe,
  expect,
  test,
} from 'bun:test';
import { p, } from './p.ts';

//region String shorthand

describe('p (string shorthand)', () => {
  test('sets bin, check, effname, null available, and empty overrides from a single name', () => {
    const entry = p('curl',);
    expect(entry.bin,).toBe('curl',);
    expect(entry.check,).toBe('--version',);
    expect(entry.effname,).toBe('curl',);
    expect(entry.available,).toBeNull();
    expect(entry.overrides,).toEqual({},);
  });

  test('produces a frozen overrides object', () => {
    const entry = p('tmux',);
    expect(Object.isFrozen(entry.overrides,),).toBe(true,);
  });
});

//endregion String shorthand

//region Object spec without yes

describe('p (object spec without yes)', () => {
  test('uses effname as bin when bin is omitted', () => {
    const entry = p({ effname: 'wget', },);
    expect(entry.bin,).toBe('wget',);
    expect(entry.effname,).toBe('wget',);
  });

  test('uses explicit bin when provided', () => {
    const entry = p({ bin: 'rg', effname: 'ripgrep', },);
    expect(entry.bin,).toBe('rg',);
    expect(entry.effname,).toBe('ripgrep',);
  });

  test('sets available to null when yes is omitted', () => {
    const entry = p({ effname: 'wget', },);
    expect(entry.available,).toBeNull();
    expect(entry.overrides,).toEqual({},);
  });

  test('handles spec with no overrides', () => {
    const entry = p({ bin: 'rg', effname: 'ripgrep', },);
    expect(entry.overrides,).toEqual({},);
  });

  test('uses custom check flag when provided', () => {
    const entry = p({ bin: 'openssl', check: 'version', effname: 'openssl', },);
    expect(entry.check,).toBe('version',);
  });

  test('defaults check to --version when omitted', () => {
    const entry = p({ bin: 'rg', effname: 'ripgrep', },);
    expect(entry.check,).toBe('--version',);
  });

  test('produces a frozen overrides object', () => {
    const entry = p({ effname: 'wget', },);
    expect(Object.isFrozen(entry.overrides,),).toBe(true,);
  });
});

//endregion Object spec without yes

//region Object spec with yes

describe('p (object spec with yes)', () => {
  test('builds available set from bare manager names', () => {
    const entry = p({ effname: 'curl', yes: ['apt', 'dnf', 'brew',], },);
    expect(entry.available,).not.toBeNull();
    expect(entry.available?.has('apt',),).toBe(true,);
    expect(entry.available?.has('dnf',),).toBe(true,);
    expect(entry.available?.has('brew',),).toBe(true,);
    expect(entry.available?.has('pacman',),).toBe(false,);
  });

  test('extracts overrides from tuples in yes', () => {
    const entry = p({
      effname: 'acpica',
      yes: [
        'apt',
        ['dnf', 'acpica-tools',],
        ['pacman', 'acpica-utils',],
      ],
    },);
    expect(entry.available?.has('apt',),).toBe(true,);
    expect(entry.available?.has('dnf',),).toBe(true,);
    expect(entry.available?.has('pacman',),).toBe(true,);
    expect(entry.overrides,).toEqual({
      dnf: 'acpica-tools',
      pacman: 'acpica-utils',
    },);
  });

  test('bare manager names produce no overrides', () => {
    const entry = p({ effname: 'tmux', yes: ['apt', 'dnf',], },);
    expect(entry.overrides,).toEqual({},);
  });

  test('freezes available set', () => {
    const entry = p({ effname: 'curl', yes: ['apt',], },);
    expect(Object.isFrozen(entry.available,),).toBe(true,);
  });

  test('freezes overrides from yes tuples', () => {
    const entry = p({ effname: 'acpica', yes: [['dnf', 'acpica-tools',],], },);
    expect(Object.isFrozen(entry.overrides,),).toBe(true,);
  });

  test('empty yes array produces empty available set', () => {
    const entry = p({ effname: 'niche-tool', yes: [], },);
    expect(entry.available,).not.toBeNull();
    expect(entry.available?.size,).toBe(0,);
  });

  test('combines bin, check, and yes', () => {
    const entry = p({
      bin: 'rg',
      check: '-V',
      effname: 'ripgrep',
      yes: ['apt', ['brew', 'ripgrep',],],
    },);
    expect(entry.bin,).toBe('rg',);
    expect(entry.check,).toBe('-V',);
    expect(entry.effname,).toBe('ripgrep',);
    expect(entry.available?.has('apt',),).toBe(true,);
    expect(entry.available?.has('brew',),).toBe(true,);
    expect(entry.overrides,).toEqual({ brew: 'ripgrep', },);
  });
});

//endregion Object spec with yes
