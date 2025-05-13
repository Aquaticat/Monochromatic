import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'vitest';
import {
  gatherArguments,
  spreadArguments,
} from './function.arguments.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('spreadArguments', () => {
  test('spreads array elements as function arguments', () => {
    const sum = (a: number, b: number, c: number) => a + b + c;
    const spreadSum = spreadArguments(sum);

    expect(spreadSum([1, 2, 3])).toBe(6);
  });

  test('works with no arguments', () => {
    const noArgs = () => 42;
    const spreadNoArgs = spreadArguments(noArgs);

    expect(spreadNoArgs([])).toBe(42);
  });

  test('works with single argument', () => {
    const double = (x: number) => x * 2;
    const spreadDouble = spreadArguments(double);

    expect(spreadDouble([5])).toBe(10);
  });

  test('preserves this context', () => {
    const obj = {
      multiplier: 2,
      multiply(x: number) {
        return x * this.multiplier;
      },
    };

    const boundMultiply = obj.multiply.bind(obj);
    const spreadMultiply = spreadArguments(boundMultiply);

    expect(spreadMultiply([5])).toBe(10);
  });

  test('works with various data types', () => {
    const concat = (str: string, num: number, bool: boolean) => `${str}${num}${bool}`;
    const spreadConcat = spreadArguments(concat);

    expect(spreadConcat(['test', 123, true])).toBe('test123true');
  });

  test('works with async functions', async () => {
    const asyncSum = async (a: number, b: number, c: number) => a + b + c;
    const spreadAsyncSum = spreadArguments(asyncSum);

    expect(await spreadAsyncSum([1, 2, 3])).toBe(6);
  });

  test('preserves promise rejection', () => {
    const asyncError = async () => {
      throw new Error('Test error');
    };
    const spreadAsyncError = spreadArguments(asyncError);

    expect(spreadAsyncError([])).rejects.toThrow('Test error');
  });
});

describe('gatherArguments', () => {
  test('gathers individual arguments into an array', () => {
    const processArray = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const gatheredProcess = gatherArguments(processArray);

    expect(gatheredProcess(1, 2, 3, 4)).toBe(10);
  });

  test('works with no arguments', () => {
    const countArgs = (arr: any[]) => arr.length;
    const gatheredCount = gatherArguments(countArgs);

    expect(gatheredCount()).toBe(0);
  });

  test('works with single argument', () => {
    const firstElement = (arr: number[]) => arr[0];
    const gatheredFirst = gatherArguments(firstElement);

    expect(gatheredFirst(42)).toBe(42);
  });

  test('works with various data types', () => {
    const joinTypes = (arr: any[]) => arr.map((item) => typeof item).join(',');
    const gatheredJoin = gatherArguments(joinTypes);

    expect(gatheredJoin(1, 'two', true, {})).toBe('number,string,boolean,object');
  });

  test('preserves this context', () => {
    const obj = {
      prefix: 'Count: ',
      count(arr: any[]) {
        return `${this.prefix}${arr.length}`;
      },
    };

    const boundCount = obj.count.bind(obj);
    const gatheredCount = gatherArguments(boundCount);

    expect(gatheredCount(1, 2, 3)).toBe('Count: 3');
  });

  test('works with async functions', async () => {
    const asyncSum = async (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const gatheredAsyncSum = gatherArguments(asyncSum);

    expect(await gatheredAsyncSum(1, 2, 3, 4)).toBe(10);
  });

  test('preserves promise rejection', () => {
    const asyncError = async (_arr: any[]) => {
      throw new Error('Test error');
    };
    const gatheredAsyncError = gatherArguments(asyncError);

    expect(gatheredAsyncError(1, 2, 3)).rejects.toThrow('Test error');
  });
});
