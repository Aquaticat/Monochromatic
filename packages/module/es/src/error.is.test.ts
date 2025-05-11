import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'bun:test';
import { isError } from './error.is.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('isError', () => {
  test('identifies Error instances', () => {
    expect(isError(new Error())).toBe(true);
    expect(isError(new Error('test message'))).toBe(true);
  });

  test('identifies Error subclasses', () => {
    expect(isError(new TypeError())).toBe(true);
    expect(isError(new ReferenceError())).toBe(true);
    expect(isError(new SyntaxError())).toBe(true);
    expect(isError(new RangeError())).toBe(true);
    expect(isError(new EvalError())).toBe(true);
    expect(isError(new URIError())).toBe(true);
  });

  test('identifies custom Error subclasses', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }

    expect(isError(new CustomError('custom error'))).toBe(true);
  });

  test('rejects non-Error values', () => {
    expect(isError(null)).toBe(false);
    expect(isError(undefined)).toBe(false);
    expect(isError(0)).toBe(false);
    expect(isError('')).toBe(false);
    expect(isError('Error')).toBe(false);
    expect(isError({})).toBe(false);
    expect(isError({ message: 'error-like object' })).toBe(false);
    expect(isError([])).toBe(false);
    expect(isError(true)).toBe(false);
    expect(isError(false)).toBe(false);
    expect(isError(() => {
      // noop
    }))
      .toBe(false);
    expect(isError(new Date())).toBe(false);
    expect(isError(new Map())).toBe(false);
    expect(isError(new Set())).toBe(false);
  });

  test('rejects error-like objects', () => {
    const errorLike = {
      name: 'Error',
      message: 'This is not a real Error',
      stack: 'fake stack trace',
    };

    expect(isError(errorLike)).toBe(false);
  });
});
