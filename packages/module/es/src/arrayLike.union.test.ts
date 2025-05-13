import {
  describe,
  expect,
  it,
} from 'vitest';
import { union } from './arrayLike.union.ts';

describe('union', () => {
  it('returns an empty Set when no arguments are provided', () => {
    const result = union();
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('returns a Set of unique elements from a single iterable', () => {
    const result = union([1, 2, 3, 3, 2, 1]);
    expect([...result]).toEqual([1, 2, 3]);
  });

  it('returns a Set of unique elements from multiple iterables', () => {
    const result = union([1, 2, 3], [3, 4, 5], [5, 6, 7]);
    expect([...result]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('works with different types of iterables', () => {
    const set = new Set([3, 4, 5]);
    const map = new Map([[1, 'a'], [2, 'b']]);
    const result = union([1, 2], set, map.keys());
    expect([...result]).toEqual([1, 2, 3, 4, 5]);
  });

  it('works with string iterables', () => {
    const result = union('abc', 'def', 'cba');
    expect([...result]).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('preserves the correct types with type inference', () => {
    // These tests check typing, not runtime behavior
    const numResult = union([1, 2, 3], [4, 5, 6]);
    const strResult = union(['a', 'b'], ['c', 'd']);
    const mixedResult = union([1, 2], ['a', 'b']);

    // Type assertions - these won't run at runtime but verify types compile
    const _numCheck: Set<number> = numResult;
    const _strCheck: Set<string> = strResult;
    const _mixedCheck: Set<string | number> = mixedResult;

    // Runtime checks
    expect([...numResult]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...strResult]).toEqual(['a', 'b', 'c', 'd']);
    expect([...mixedResult]).toContain(1);
    expect([...mixedResult]).toContain('a');
  });
});
