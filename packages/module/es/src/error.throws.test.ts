import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'bun:test';
import { throws } from './error.throws.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('throws', () => {
  test('throws an Error instance unchanged', () => {
    const error = new Error('test error');
    expect(() => throws(error)).toThrow(Error);
    try {
      throws(error);
    } catch (e) {
      expect(e).toBe(error);
    }
  });

  test('throws Error with string message', () => {
    expect(() => throws('test message')).toThrow(Error);
    try {
      throws('test message');
    } catch (e: any) {
      expect(e instanceof Error).toBe(true);
      expect(e.message).toBe('test message');
    }
  });

  test('throws Error from object with message', () => {
    expect(() => throws({ message: 'object message' })).toThrow(Error);
    try {
      throws({ message: 'object message' });
    } catch (e: any) {
      expect(e instanceof Error).toBe(true);
      expect(e.message).toBe('object message');
    }
  });

  test('throws Error with cause', () => {
    const cause = new Error('cause error');
    expect(() => throws({ message: 'with cause', cause })).toThrow(Error);
    try {
      throws({ message: 'with cause', cause });
    } catch (e: any) {
      expect(e instanceof Error).toBe(true);
      expect(e.message).toBe('with cause');
      expect(e.cause).toBe(cause);
    }
  });

  test('throws named Error types', () => {
    const errorTypes = [
      { name: 'Error', constructor: Error },
      { name: 'RangeError', constructor: RangeError },
      { name: 'ReferenceError', constructor: ReferenceError },
      { name: 'TypeError', constructor: TypeError },
      { name: 'URIError', constructor: URIError },
    ];

    for (const { name, constructor } of errorTypes) {
      expect(() => throws({ name, message: `${name} message` })).toThrow(constructor);
      try {
        throws({ name, message: `${name} message` });
      } catch (e: any) {
        expect(e instanceof constructor).toBe(true);
        expect(e.message).toBe(`${name} message`);
      }
    }
  });

  test('throws named Error types with cause', () => {
    const cause = { someData: 'test' };
    const errorTypes = [
      { name: 'Error', constructor: Error },
      { name: 'RangeError', constructor: RangeError },
      { name: 'ReferenceError', constructor: ReferenceError },
      { name: 'TypeError', constructor: TypeError },
      { name: 'URIError', constructor: URIError },
    ];

    for (const { name, constructor } of errorTypes) {
      expect(() => throws({ name, message: `${name} with cause`, cause })).toThrow(
        constructor,
      );
      try {
        throws({ name, message: `${name} with cause`, cause });
      } catch (e: any) {
        expect(e instanceof constructor).toBe(true);
        expect(e.message).toBe(`${name} with cause`);
        expect(e.cause).toBe(cause);
      }
    }
  });

  test('handles custom error names', () => {
    expect(() => throws({ name: 'CustomError', message: 'custom error' })).toThrow(Error);
    try {
      throws({ name: 'CustomError', message: 'custom error' });
    } catch (e: any) {
      expect(e instanceof Error).toBe(true);
      expect(e.message).toBe('CustomError: custom error');
    }
  });

  test('handles custom error names with cause', () => {
    const cause = new Error('original');
    expect(() => throws({ name: 'CustomError', message: 'custom with cause', cause }))
      .toThrow(Error);
    try {
      throws({ name: 'CustomError', message: 'custom with cause', cause });
    } catch (e: any) {
      expect(e instanceof Error).toBe(true);
      expect(e.message).toBe('CustomError: custom with cause');
      expect(e.cause).toBe(cause);
    }
  });
});
