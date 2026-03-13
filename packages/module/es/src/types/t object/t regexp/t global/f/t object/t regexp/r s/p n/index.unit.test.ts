import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const {$} = types.object.regexp.global.from.object.regexp.sync.named;

describe('ensure regexp has global flag', () => {
  test('adds global flag to regexp without flags', () => {
    const regexp = /test/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.global,).toBe(true,);
    expect(result.source,).toBe('test',);
  });

  test('adds global flag to regexp with existing flags', () => {
    const regexp = /test/i;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('gi',);
    expect(result.global,).toBe(true,);
    expect(result.ignoreCase,).toBe(true,);
    expect(result.source,).toBe('test',);
  });

  test('preserves global flag if already present', () => {
    const regexp = /test/g;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.global,).toBe(true,);
    expect(result.source,).toBe('test',);
  });

  test('preserves global flag with multiple existing flags', () => {
    const regexp = /test/gim;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('gim',);
    expect(result.global,).toBe(true,);
    expect(result.ignoreCase,).toBe(true,);
    expect(result.multiline,).toBe(true,);
    expect(result.source,).toBe('test',);
  });

  test('works with complex regex patterns', () => {
    const regexp = /^[a-z]+/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.source,).toBe('^[a-z]+',);
    expect(result.test('abc',),).toBe(true,);
    expect(result.test('123',),).toBe(false,);
  });

  test('works with special characters in pattern', () => {
    const regexp = /[$()*+.?[\\\]^{|}]/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.source,).toBe(String.raw`[$()*+.?[\\\]^{|}]`,);
  });

  test('works with unicode characters', () => {
    const regexp = /Hello 世界/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    // Bun (JavaScriptCore) escapes non-ASCII in .source when constructing via new RegExp()
    expect(result.source,).toBe(String.raw`Hello \u4E16\u754C`,);
    expect(result.test('Hello 世界',),).toBe(true,);
  });

  test('works with escaped characters', () => {
    const regexp = /\d+\.\d+/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.source,).toBe(String.raw`\d+\.\d+`,);
  });

  test('returns new RegExp instance', () => {
    const original = /test/;
    const result = $({ regexp: original, },);

    expect(result,).not.toBe(original,);
    expect(result,).toBeInstanceOf(RegExp,);
  });

  test('new regexp works with exec for multiple matches', () => {
    const regexp = /\w+/;
    const globalRegexp = $({ regexp, },);

    const text = 'hello world test';
    const matches: RegExpExecArray[] = [];

    let match: RegExpExecArray | null;
    while ((match = globalRegexp.exec(text,)) !== null)
      matches.push(match,);

    expect(matches.length,).toBe(3,);
    expect(matches[0]?.[0],).toBe('hello',);
    expect(matches[1]?.[0],).toBe('world',);
    expect(matches[2]?.[0],).toBe('test',);
  });

  test('new regexp works with matchAll', () => {
    const regexp = /\d+/;
    const globalRegexp = $({ regexp, },);

    const text = 'test123 foo456 bar789';
    const matches = [...text.matchAll(globalRegexp)];

    expect(matches.length,).toBe(3,);
    expect(matches[0]?.[0],).toBe('123',);
    expect(matches[1]?.[0],).toBe('456',);
    expect(matches[2]?.[0],).toBe('789',);
  });

  test('with dotAll flag (s)', () => {
    const regexp = /test.test/s;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('gs',);
    expect(result.dotAll,).toBe(true,);
  });

  test('with sticky flag (y)', () => {
    const regexp = /test/y;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('gy',);
    expect(result.sticky,).toBe(true,);
  });

  test('with unicode flag (u)', () => {
    const regexp = /\u{1F600}/u;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('gu',);
    expect(result.unicode,).toBe(true,);
  });

  test('empty regex gets global flag', () => {
    const regexp = /(?:)/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.source,).toBe('(?:)',);
  });

  test('works with alternation patterns', () => {
    const regexp = /cat|dog|bird/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.test('cat',),).toBe(true,);
    result.lastIndex = 0;
    expect(result.test('dog',),).toBe(true,);
    result.lastIndex = 0;
    expect(result.test('bird',),).toBe(true,);
    result.lastIndex = 0;
    expect(result.test('fish',),).toBe(false,);
  });

  test('works with capturing groups', () => {
    const regexp = /(\d+)-(\d+)-(\d+)/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    const match = result.exec('2024-12-25',);
    expect(match,).not.toBeNull();
    expect(match?.[1],).toBe('2024',);
    expect(match?.[2],).toBe('12',);
    expect(match?.[3],).toBe('25',);
  });

  test('works with lookaheads', () => {
    const regexp = /\w+(?=\s)/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.source,).toBe(String.raw`\w+(?=\s)`,);
  });

  test('works with lookbehinds', () => {
    const regexp = /(?<=\s)\w+/;
    const result = $({ regexp, },);

    expect(result.flags,).toBe('g',);
    expect(result.source,).toBe(String.raw`(?<=\s)\w+`,);
  });
});
