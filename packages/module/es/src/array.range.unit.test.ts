import {
  arrayRange,
  arrayRangeGen,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(arrayRange, () => {
  test('creates array of consecutive integers starting from 0', () => {
    expect(arrayRange(5)).toEqual([0, 1, 2, 3, 4]);
    expect(arrayRange(3)).toEqual([0, 1, 2]);
    expect(arrayRange(1)).toEqual([0]);
  });

  test('returns empty array for length 0', () => {
    expect(arrayRange(0)).toEqual([]);
  });

  test('throws RangeError for negative length', () => {
    expect(() => arrayRange(-1)).toThrow(RangeError);
    expect(() => arrayRange(-5)).toThrow('Length must be non-negative');
  });

  test('creates correct array for larger lengths', () => {
    const result = arrayRange(10);
    expect(result).toHaveLength(10);
    expect(result[0]).toBe(0);
    expect(result[9]).toBe(9);
    expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('works with typical use cases', () => {
    // Creating index arrays
    const items = ['a', 'b', 'c'];
    const indices = arrayRange(items.length);
    expect(indices).toEqual([0, 1, 2]);

    // Mapping with generated indices
    const withIndices = indices.map(i => ({ index: i, value: items[i] }));
    expect(withIndices).toEqual([
      { index: 0, value: 'a' },
      { index: 1, value: 'b' },
      { index: 2, value: 'c' }
    ]);
  });

  test('returns new array instance each time', () => {
    const first = arrayRange(3);
    const second = arrayRange(3);
    expect(first).toEqual(second);
    expect(first).not.toBe(second); // Different instances
  });
});

describe(arrayRangeGen, () => {
  test('yields consecutive integers starting from 0', () => {
    const gen = arrayRangeGen(5);
    
    expect(gen.next().value).toBe(0);
    expect(gen.next().value).toBe(1);
    expect(gen.next().value).toBe(2);
    expect(gen.next().value).toBe(3);
    expect(gen.next().value).toBe(4);
    expect(gen.next().done).toBe(true);
  });

  test('yields nothing for length 0', () => {
    const gen = arrayRangeGen(0);
    expect(gen.next().done).toBe(true);
  });

  test('throws RangeError for negative length', () => {
    expect(() => [...arrayRangeGen(-1)]).toThrow(RangeError);
    expect(() => [...arrayRangeGen(-5)]).toThrow('Length must be non-negative');
  });

  test('can be consumed with for...of loop', () => {
    const values: number[] = [];
    for (const value of arrayRangeGen(4)) {
      values.push(value);
    }
    expect(values).toEqual([0, 1, 2, 3]);
  });

  test('can be converted to array', () => {
    const result = [...arrayRangeGen(3)];
    expect(result).toEqual([0, 1, 2]);
  });

  test('supports early termination', () => {
    const values: number[] = [];
    for (const value of arrayRangeGen(10)) {
      values.push(value);
      if (value >= 2) break; // Stop early
    }
    expect(values).toEqual([0, 1, 2]);
  });

  test('generates correct sequence for larger lengths', () => {
    const gen = arrayRangeGen(100);
    const first10 = Array.from({ length: 10 }, () => gen.next().value);
    expect(first10).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('each generator instance is independent', () => {
    const gen1 = arrayRangeGen(3);
    const gen2 = arrayRangeGen(3);

    expect(gen1.next().value).toBe(0);
    expect(gen2.next().value).toBe(0);
    expect(gen1.next().value).toBe(1);
    expect(gen2.next().value).toBe(1);
  });

  test('handles single element generation', () => {
    const gen = arrayRangeGen(1);
    expect(gen.next().value).toBe(0);
    expect(gen.next().done).toBe(true);
  });

  test('generator can be used multiple times by recreating', () => {
    function createGenerator() {
      return arrayRangeGen(3);
    }

    const firstRun = [...createGenerator()];
    const secondRun = [...createGenerator()];
    
    expect(firstRun).toEqual([0, 1, 2]);
    expect(secondRun).toEqual([0, 1, 2]);
  });
});

describe('arrayRange vs arrayRangeGen comparison', () => {
  test('both produce equivalent results when converted to arrays', () => {
    const length = 7;
    const arrayResult = arrayRange(length);
    const genResult = [...arrayRangeGen(length)];
    
    expect(arrayResult).toEqual(genResult);
  });

  test('both handle edge cases consistently', () => {
    // Empty case
    expect(arrayRange(0)).toEqual([...arrayRangeGen(0)]);
    
    // Single element
    expect(arrayRange(1)).toEqual([...arrayRangeGen(1)]);
    
    // Both throw for negative values
    expect(() => arrayRange(-1)).toThrow(RangeError);
    expect(() => [...arrayRangeGen(-1)]).toThrow(RangeError);
  });

  test('generator provides memory efficiency for large ranges', () => {
    // This test demonstrates the concept - actual memory testing would be complex
    const largeLength = 10000;
    
    // Generator doesn't create full array immediately
    const gen = arrayRangeGen(largeLength);
    expect(typeof gen.next).toBe('function');
    
    // Can take just first few elements without creating entire array
    const firstFive = [];
    for (const value of arrayRangeGen(largeLength)) {
      firstFive.push(value);
      if (firstFive.length === 5) break;
    }
    expect(firstFive).toEqual([0, 1, 2, 3, 4]);
  });
});