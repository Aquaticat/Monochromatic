import {
  describe,
  expect,
  test,
} from 'bun:test';
import { mergeOverrides, } from './merge.ts';
import { p, } from './p.ts';

//region mergeOverrides

describe('mergeOverrides', () => {
  test('returns entries unchanged when no overrides match', () => {
    const generated = [p('curl',), p('tmux',),];
    const result = mergeOverrides(generated, [],);
    expect(result,).toEqual(generated,);
  });

  test('applies bin from override to matching effname', () => {
    const generated = [p({ effname: 'ripgrep', },),];
    const result = mergeOverrides(generated, [
      p({ bin: 'rg', effname: 'ripgrep', },),
    ],);
    expect(result[0]?.bin,).toBe('rg',);
    expect(result[0]?.effname,).toBe('ripgrep',);
  });

  test('applies check from override to matching effname', () => {
    const generated = [p({ effname: 'openssl', },),];
    const result = mergeOverrides(generated, [
      p({ check: 'version', effname: 'openssl', },),
    ],);
    expect(result[0]?.check,).toBe('version',);
  });

  test('applies both bin and check overrides', () => {
    const generated = [p({ effname: 'imagemagick', dnf: 'ImageMagick', },),];
    const result = mergeOverrides(generated, [
      p({ bin: 'convert', check: '-version', effname: 'imagemagick', },),
    ],);
    expect(result[0]?.bin,).toBe('convert',);
    expect(result[0]?.check,).toBe('-version',);
    expect(result[0]?.effname,).toBe('imagemagick',);
  });

  test('preserves manager overrides from generated entry', () => {
    const generated = [p({ effname: 'imagemagick', dnf: 'ImageMagick', },),];
    const result = mergeOverrides(generated, [
      p({ bin: 'convert', effname: 'imagemagick', },),
    ],);
    expect(result[0]?.overrides,).toEqual({ dnf: 'ImageMagick', },);
  });

  test('leaves non-matching entries untouched', () => {
    const generated = [p('curl',), p({ effname: 'ripgrep', },),];
    const result = mergeOverrides(generated, [
      p({ bin: 'rg', effname: 'ripgrep', },),
    ],);
    expect(result[0]?.bin,).toBe('curl',);
    expect(result[0]?.check,).toBe('--version',);
    expect(result[1]?.bin,).toBe('rg',);
  });

  test('keeps default check when override only changes bin', () => {
    const generated = [p({ effname: 'ripgrep', },),];
    const result = mergeOverrides(generated, [
      p({ bin: 'rg', effname: 'ripgrep', },),
    ],);
    expect(result[0]?.check,).toBe('--version',);
  });
});

//endregion mergeOverrides
