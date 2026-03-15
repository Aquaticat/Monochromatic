import {
  describe,
  expect,
  test,
} from 'bun:test';

import { types, } from '@monochromatic-dev/module-es';

import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';

const { $, } = types.object.array.numberFiniteInt.from.number.exclusiveRange.sync.named;

describe($, () => {
  test('returns empty array when start equals end', () => {
    expect($({ startExclusive: 0, endExclusive: 0, },),).toEqual([],);
  });

  test('returns empty array when start is greater than end', () => {
    expect($({ startExclusive: 5, endExclusive: 3, },),).toEqual([],);
  });

  test('returns correct range for positive integers', () => {
    expect($({ startExclusive: 0, endExclusive: 5, },),).toEqual([1 as Int, 2 as Int,
      3 as Int, 4 as Int,],);
  });

  test('returns correct range for negative integers', () => {
    expect($({ startExclusive: -5, endExclusive: 0, },),).toEqual([-4 as Int, -3 as Int,
      -2 as Int, -1 as Int,],);
  });

  test('returns correct range crossing zero', () => {
    expect($({ startExclusive: -2, endExclusive: 3, },),).toEqual([-1 as Int, 0 as Int,
      1 as Int, 2 as Int,],);
  });

  test('handles single element ranges', () => {
    expect($({ startExclusive: 0, endExclusive: 2, },),).toEqual([1 as Int,],);
    expect($({ startExclusive: -1, endExclusive: 1, },),).toEqual([0 as Int,],);
  });

  test('handles decimal boundaries', () => {
    expect($({ startExclusive: 0.1, endExclusive: 4.9, },),).toEqual([1 as Int, 2 as Int,
      3 as Int, 4 as Int,],);
    expect($({ startExclusive: -0.9, endExclusive: 0.9, },),).toEqual([0 as Int,],);
    expect($({ startExclusive: 1.5, endExclusive: 2.3, },),).toEqual([2 as Int,],);
  });

  test('handles edge cases with large numbers', () => {
    expect($({ startExclusive: 99, endExclusive: 103, },),).toEqual([100 as Int,
      101 as Int, 102 as Int,],);
  });

  test('returns empty array when no integers exist in range', () => {
    expect($({ startExclusive: 1.1, endExclusive: 1.9, },),).toEqual([],);
  });

  test('handles decimal boundaries that resolve to a single integer', () => {
    expect($({ startExclusive: 0.5, endExclusive: 1.5, },),).toEqual([1 as Int,],);
  });
},);
