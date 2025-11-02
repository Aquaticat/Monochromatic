import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

import type * as Jsonc from '@_/types/t object/t jsonc/t/index.ts';
import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const exported = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;

//region expectArraySeparatorOrEnd
describe('expectArraySeparatorOrEnd', () => {
  const $ = exported.expectArraySeparatorOrEnd;
  test('end directly', ({ expect, },) => {
    const r = ']TAIL' as FragmentStringJsonc;
    const out = $(r,);
    if (out.kind !== 'end')
      throw new Error('expected end',);
    expect(out.tail,).toBe('TAIL',);
  });
  test('trailing comma then end', ({ expect, },) => {
    const out = $(', /* c */ ]TAIL' as FragmentStringJsonc,);
    if (out.kind !== 'end')
      throw new Error('expected end',);
    expect(out.tail,).toBe('TAIL',);
  });
  test('next element start', ({ expect, },) => {
    const out = $(', /* c */ 2, x' as FragmentStringJsonc,);
    if (out.kind !== 'next')
      throw new Error('expected next',);
    expect(out.tailStart.startsWith('2',),).toBe(true,);
  });
});
//endregion expectArraySeparatorOrEnd

//region parseArrayElements
describe('parseArrayElements', () => {
  const $ = exported.parseArrayElements;
  test('single element then end', ({ expect, },) => {
    const out = $('1]TAIL' as FragmentStringJsonc,);
    expect(out.items,).toEqual([{ value: 1, },],);
    expect(out.tail,).toBe('TAIL',);
  });
  test('multi with comments and trailing comma', ({ expect, },) => {
    const out = $('1, /* c */ 2, /* d */ ]X' as FragmentStringJsonc,);
    expect((out.items as Jsonc.Number[]).map(v => v.value),).toEqual([1, 2,],);
    expect(out.tail,).toBe('X',);
  });
  test('invalid: identifier right after literal (boundary handled by separator)', ({ expect, },) => {
    expect(() => $('nullY]' as FragmentStringJsonc,)).toThrow(/expected ',' or ']'/,);
  });
});
//endregion parseArrayElements
