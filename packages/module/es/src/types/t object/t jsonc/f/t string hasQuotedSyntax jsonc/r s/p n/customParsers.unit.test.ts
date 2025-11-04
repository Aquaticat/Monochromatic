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

//region parseValueFromStart
describe('parseValueFromStart', () => {
  const $ = exported.parseValueFromStart;
  test('string and number', ({ expect, },) => {
    const s = $({ value: '"x"TAIL' as FragmentStringJsonc, },);
    expect((s.parsed as Jsonc.String).value,).toBe('"x"',);
    expect($({ value: '1, 2' as FragmentStringJsonc, },).parsed,).toEqual({
      value: 1,
    },);
  });
  test('array dispatch', ({ expect, },) => {
    const out = $({ value: '[1]TAIL' as FragmentStringJsonc, },);
    const arr = out.parsed as Jsonc.Array;
    expect(arr.value[0],).toEqual({ value: 1, },);
    expect(out.remaining,).toBe('TAIL',);
  });
});
//endregion parseValueFromStart
