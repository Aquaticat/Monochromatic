import {
  describe,
  test,
} from 'vitest';

import { types, } from '@monochromatic-dev/module-es';

const $ = types.object.array.numberFiniteInt.from.number.exclusiveRange.sync.named.$;

describe($, () => {
  test('returns empty array when start equals end', ({ expect, },) => {
    expect($({ startExclusive: 0, endExclusive: 0, },),).toEqual([],);
  });

  test('returns empty array when start is greater than end', ({ expect, },) => {
    expect($({ startExclusive: 5, endExclusive: 3, },),).toEqual([],);
  });

  test('returns correct range for positive integers', ({ expect, },) => {
    expect($({ startExclusive: 0, endExclusive: 5, },),).toEqual([1, 2, 3, 4,],);
  });

  test('returns correct range for negative integers', ({ expect, },) => {
    expect($({ startExclusive: -5, endExclusive: 0, },),).toEqual([-4, -3, -2, -1,],);
  });

  test('returns correct range crossing zero', ({ expect, },) => {
    expect($({ startExclusive: -2, endExclusive: 3, },),).toEqual([-1, 0, 1, 2,],);
  });

  test('handles single element ranges', ({ expect, },) => {
    expect($({ startExclusive: 0, endExclusive: 2, },),).toEqual([1,],);
    expect($({ startExclusive: -1, endExclusive: 1, },),).toEqual([0,],);
  });

  test('handles decimal boundaries', ({ expect, },) => {
    expect($({ startExclusive: 0.1, endExclusive: 4.9, },),).toEqual([1, 2, 3, 4,],);
    expect($({ startExclusive: -0.9, endExclusive: 0.9, },),).toEqual([0,],);
    expect($({ startExclusive: 1.5, endExclusive: 2.3, },),).toEqual([2,],);
  });

  test('handles edge cases with large numbers', ({ expect, },) => {
    expect($({ startExclusive: 99, endExclusive: 103, },),).toEqual([100, 101, 102,],);
  });

  test('returns empty array when no integers exist in range', ({ expect, },) => {
    expect($({ startExclusive: 1.1, endExclusive: 1.9, },),).toEqual([],);
  });

  test('handles decimal boundaries that resolve to a single integer', ({ expect, },) => {
    expect($({ startExclusive: 0.5, endExclusive: 1.5, },),).toEqual([1,],);
  });
},);
