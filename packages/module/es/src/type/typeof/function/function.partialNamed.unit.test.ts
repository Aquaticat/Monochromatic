import {
  partialNamed,

  // Logging library used.
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('partialNamed', () => {
  test('applies pre-applied options and merges with additional options', () => {
    const greet = (options: { greeting: string; name: string; punctuation?: string }) => 
      `${options.greeting}, ${options.name}${options.punctuation || '!'}`;

    const sayHello = partialNamed({ 
      fn: greet, 
      preApplied: { greeting: 'Hello' } 
    });

    const result1 = sayHello({ name: 'World' });
    expect(result1).toBe('Hello, World!');

    const result2 = sayHello({ name: 'Alice', punctuation: '.' });
    expect(result2).toBe('Hello, Alice.');
  });

  test('additional options override pre-applied options', () => {
    const createMessage = (options: { prefix: string; message: string; suffix?: string }) =>
      `${options.prefix}${options.message}${options.suffix || ''}`;

    const prefixedMessage = partialNamed({
      fn: createMessage,
      preApplied: { prefix: 'INFO: ', suffix: ' [default]' }
    });

    const result = prefixedMessage({ 
      message: 'test', 
      suffix: ' [custom]' 
    });
    expect(result).toBe('INFO: test [custom]');
  });

  test('works with functions that only need pre-applied options', () => {
    const calculate = (options: { a: number; b: number }) => options.a + options.b;

    const fullyApplied = partialNamed({
      fn: calculate,
      preApplied: { a: 5, b: 3 }
    });

    const result = fullyApplied({});
    expect(result).toBe(8);
  });

  test('works with empty pre-applied options', () => {
    const identity = (options: { value: string }) => options.value;

    const noPreApplied = partialNamed({
      fn: identity,
      preApplied: {}
    });

    const result = noPreApplied({ value: 'test' });
    expect(result).toBe('test');
  });

  test('works with complex nested options', () => {
    const processData = (options: { 
      config: { timeout: number; retries: number }; 
      data: { id: string; value: number } 
    }) => ({
      id: options.data.id,
      value: options.data.value * 2,
      timeout: options.config.timeout
    });

    const withConfig = partialNamed({
      fn: processData,
      preApplied: { 
        config: { timeout: 5000, retries: 3 } 
      }
    });

    const result = withConfig({
      data: { id: 'test', value: 10 }
    });

    expect(result).toEqual({
      id: 'test',
      value: 20,
      timeout: 5000
    });
  });

  test('preserves function return type', () => {
    const getString = (options: { text: string }) => options.text;
    const getNumber = (options: { num: number }) => options.num;

    const partialString = partialNamed({
      fn: getString,
      preApplied: {}
    });

    const partialNumber = partialNamed({
      fn: getNumber,
      preApplied: {}
    });

    const stringResult = partialString({ text: 'hello' });
    const numberResult = partialNumber({ num: 42 });

    expect(typeof stringResult).toBe('string');
    expect(typeof numberResult).toBe('number');
    expect(stringResult).toBe('hello');
    expect(numberResult).toBe(42);
  });
});