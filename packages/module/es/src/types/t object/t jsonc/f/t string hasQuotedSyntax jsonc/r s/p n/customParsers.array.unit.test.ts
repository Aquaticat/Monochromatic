import { types } from '@monochromatic-dev/module-es';
import { describe, test } from 'vitest';

import type { FragmentStringJsonc } from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.customParserForArray;

describe($, () => {
  //region Empty arrays -- basic and with comments
  test('empty array', ({ expect }) => {
    const input = '[]' as FragmentStringJsonc;
    const out = $({ value: input });
    expect(out.value).toEqual([]);
    expect(out.remainingContent).toBe('');
  });

  test('empty array with leading comment', ({ expect }) => {
    const input = '[ /* c */ ]TAIL' as FragmentStringJsonc;
    const out = $({ value: input });
    expect(out.value).toEqual([]);
    expect(out.comment?.type).toBe('block');
    expect(out.remainingContent).toBe('TAIL');
  });
  //endregion Empty arrays

  //region Primitives and separators -- single/multiple numbers and trailing comma
  test('single primitive number', ({ expect }) => {
    const out = $({ value: '[1]' as FragmentStringJsonc });
    expect(Array.isArray(out.value)).toBe(true);
    expect(out.value[0]).toEqual({ value: 1 });
    expect(out.remainingContent).toBe('');
  });

  test('multiple numbers', ({ expect }) => {
    const out = $({ value: '[1, 2, 3]' as FragmentStringJsonc });
    expect(out.value.map((v: any) => v.value)).toEqual([1, 2, 3]);
  });

  test('trailing comma with comments', ({ expect }) => {
    const out = $({ value: '[1, /* c */ 2, /* d */ ]X' as FragmentStringJsonc });
    expect(out.value.map((v: any) => v.value)).toEqual([1, 2]);
    expect(out.remainingContent).toBe('X');
  });
  //endregion Primitives and separators

  //region Strings and escapes -- ensure quoted parsing cooperates
  test('strings with escaped quote', ({ expect }) => {
    const out = $({ value: '["a\\"b", "c"]' as FragmentStringJsonc });
    expect(out.value[0]).toHaveProperty('value');
    expect((out.value[0] as any).value).toBe('"a\\"b"');
    expect((out.value[1] as any).value).toBe('"c"');
  });
  //endregion Strings and escapes

  //region Nested arrays -- delegate inner arrays
  test('nested arrays', ({ expect }) => {
    const out = $({ value: '[[1], [2, 3]]' as FragmentStringJsonc });
    const inner1 = (out.value[0] as any).value as any[];
    const inner2 = (out.value[1] as any).value as any[];
    expect(inner1[0]).toEqual({ value: 1 });
    expect(inner2.map((v: any) => v.value)).toEqual([2, 3]);
  });
  //endregion Nested arrays

  //region Errors -- malformed separators
  test('missing comma between elements', ({ expect }) => {
    expect(() => $({ value: '[1 2]' as FragmentStringJsonc })).toThrow(/expected ',' or '\]'/);
  });

  test('dangling comma without closing bracket', ({ expect }) => {
    expect(() => $({ value: '[1, 2,' as FragmentStringJsonc })).toThrow();
  });
  //endregion Errors
});
