import {
  describe,
  expect,
  test,
} from 'bun:test';
import { p, } from './p.ts';

//region String shorthand

describe('p (string shorthand)', () => {
  test('sets bin, check, effname, and empty overrides from a single name', () => {
    const entry = p('curl',);
    expect(entry.bin,).toBe('curl',);
    expect(entry.check,).toBe('--version',);
    expect(entry.effname,).toBe('curl',);
    expect(entry.overrides,).toEqual({},);
  });

  test('produces a frozen overrides object', () => {
    const entry = p('tmux',);
    expect(Object.isFrozen(entry.overrides,),).toBe(true,);
  });
});

//endregion String shorthand

//region Object spec

describe('p (object spec)', () => {
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

  test('extracts manager keys into overrides', () => {
    const entry = p({
      effname: 'wget',
      winget: 'JernejSimoncic.Wget',
    },);
    expect(entry.overrides,).toEqual({
      winget: 'JernejSimoncic.Wget',
    },);
  });

  test('extracts multiple manager overrides', () => {
    const entry = p({
      bin: 'magick',
      effname: 'imagemagick',
      dnf: 'ImageMagick',
      winget: 'ImageMagick.ImageMagick',
    },);
    expect(entry.bin,).toBe('magick',);
    expect(entry.effname,).toBe('imagemagick',);
    expect(entry.overrides,).toEqual({
      dnf: 'ImageMagick',
      winget: 'ImageMagick.ImageMagick',
    },);
  });

  test('handles entries with only some managers', () => {
    const entry = p({
      effname: 'curl',
      dnf: 'curl',
    },);
    expect(entry.overrides,).toEqual({ dnf: 'curl', },);
  });

  test('produces a frozen overrides object', () => {
    const entry = p({
      effname: 'wget',
      winget: 'JernejSimoncic.Wget',
    },);
    expect(Object.isFrozen(entry.overrides,),).toBe(true,);
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
});

//endregion Object spec
