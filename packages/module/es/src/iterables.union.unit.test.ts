import { unionIterables } from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest';

describe(unionIterables, () => {
  it('returns an empty Set when no arguments are provided', () => {
    const result = unionIterables();
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('returns a Set of unique elements from a single iterable', () => {
    const result = unionIterables([1, 2, 3, 3, 2, 1]);
    expect([...result]).toEqual([1, 2, 3]);
  });

  it('returns a Set of unique elements from multiple iterables', () => {
    const result = unionIterables([1, 2, 3], [3, 4, 5], [5, 6, 7]);
    expect([...result]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('works with different types of iterables', () => {
    const set = new Set([3, 4, 5]);
    const map = new Map([[1, 'a'], [2, 'b']]);
    const result = unionIterables([1, 2], set, map.keys());
    expect([...result]).toEqual([1, 2, 3, 4, 5]);
  });

  it('works with string iterables', () => {
    const result = unionIterables('abc', 'def', 'cba');
    expect([...result]).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('preserves the correct types with type inference', () => {
    // These tests check typing, not runtime behavior
    const numResult = unionIterables([1, 2, 3], [4, 5, 6]);
    const strResult = unionIterables(['a', 'b'], ['c', 'd']);
    const mixedResult = unionIterables([1, 2], ['a', 'b']);

    // Type assertions - these won't run at runtime but verify types compile
    expectTypeOf(numResult).toEqualTypeOf<Set<1 | 2 | 3 | 4 | 5 | 6>>();
    expectTypeOf(strResult).toEqualTypeOf<Set<'a' | 'b' | 'c' | 'd'>>();
    expectTypeOf(mixedResult).toEqualTypeOf<Set<1 | 2 | 'a' | 'b'>>();

    // Runtime checks
    expect([...numResult]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...strResult]).toEqual(['a', 'b', 'c', 'd']);
    expect([...mixedResult]).toContain(1);
    expect([...mixedResult]).toContain('a');
  });
});

// Add tests for other functions in iterables.union.ts AI!
