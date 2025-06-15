import { unwrapResult } from '@monochromatic-dev/module-es';
import {
  Err,
  Ok,
} from 'happy-rusty';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe('unwrapResult', () => {
  test('returns value from successful Result', () => {
    const successResult = Ok<string, Error>('hello world');
    const value = unwrapResult(successResult);
    expect(value).toBe('hello world');
  });

  test('works with different success value types', () => {
    // String
    expect(unwrapResult(Ok<string, Error>('test'))).toBe('test');

    // Number
    expect(unwrapResult(Ok<number, Error>(42))).toBe(42);

    // Boolean
    expect(unwrapResult(Ok<boolean, Error>(true))).toBe(true);
    expect(unwrapResult(Ok<boolean, Error>(false))).toBe(false);

    // Array
    const arr = [1, 2, 3];
    expect(unwrapResult(Ok<number[], Error>(arr))).toBe(arr);

    // Object
    const obj = { key: 'value' };
    expect(unwrapResult(Ok<{ key: string; }, Error>(obj))).toBe(obj);

    // Null and undefined
    expect(unwrapResult(Ok<null, Error>(null))).toBe(null);
    expect(unwrapResult(Ok<undefined, Error>(undefined))).toBe(undefined);
  });

  test('throws error from failed Result', () => {
    const error = new Error('Something went wrong');
    const errorResult = Err(error);

    expect(() => unwrapResult(errorResult)).toThrow('Something went wrong');
    expect(() => unwrapResult(errorResult)).toThrow(Error);
  });

  test('throws the exact same error instance', () => {
    const error = new Error('Test error');
    const errorResult = Err(error);

    try {
      unwrapResult(errorResult);
      expect.fail('Should have thrown');
    } catch (thrownError) {
      expect(thrownError).toBe(error);
    }
  });

  test('adds ENOENT code to NotFoundError messages', () => {
    const notFoundError = new Error('NotFoundError: File not found');
    const notFoundResult = Err(notFoundError);

    try {
      unwrapResult(notFoundResult);
      expect.fail('Should have thrown');
    } catch (thrownError) {
      expect(thrownError).toBe(notFoundError);
      expect((thrownError as Error & { code?: string; }).code).toBe('ENOENT');
    }
  });

  test('handles various NotFoundError message formats', () => {
    const testCases = [
      'NotFoundError: File not found',
      'NotFoundError: Resource missing',
      'NotFoundError:',
      'NotFoundError: Some very long error message with details',
    ];

    testCases.forEach((message) => {
      const error = new Error(message);
      const errorResult = Err(error);

      try {
        unwrapResult(errorResult);
        expect.fail(`Should have thrown for message: ${message}`);
      } catch (thrownError) {
        expect((thrownError as Error & { code?: string; }).code).toBe('ENOENT');
      }
    });
  });

  test('does not add ENOENT code to non-NotFoundError messages', () => {
    const testCases = [
      'Regular error message',
      'ValidationError: Invalid input',
      'notfounderror: lowercase',
      'Error: NotFoundError in the middle',
      'Some NotFoundError: at the end',
      '',
    ];

    testCases.forEach((message) => {
      const error = new Error(message);
      const errorResult = Err(error);

      try {
        unwrapResult(errorResult);
        expect.fail(`Should have thrown for message: ${message}`);
      } catch (thrownError) {
        expect((thrownError as Error & { code?: string; }).code).toBeUndefined();
      }
    });
  });

  test('preserves existing error properties', () => {
    const error = new Error('NotFoundError: File not found') as Error & {
      existingProperty?: string;
      code?: string;
    };
    error.existingProperty = 'preserved';

    const errorResult = Err(error);

    try {
      unwrapResult(errorResult);
      expect.fail('Should have thrown');
    } catch (thrownError) {
      const typedError = thrownError as Error & {
        existingProperty?: string;
        code?: string;
      };
      expect(typedError.existingProperty).toBe('preserved');
      expect(typedError.code).toBe('ENOENT');
    }
  });

  test('overwrites existing code property for NotFoundError', () => {
    const error = new Error('NotFoundError: File not found') as Error & {
      code?: string;
    };
    error.code = 'EXISTING_CODE';

    const errorResult = Err(error);

    try {
      unwrapResult(errorResult);
      expect.fail('Should have thrown');
    } catch (thrownError) {
      expect((thrownError as Error & { code?: string; }).code).toBe('ENOENT');
    }
  });

  test('works with custom error classes', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }

    const customError = new CustomError('NotFoundError: Custom error');
    const errorResult = Err(customError);

    try {
      unwrapResult(errorResult);
      expect.fail('Should have thrown');
    } catch (thrownError) {
      expect(thrownError).toBeInstanceOf(CustomError);
      expect((thrownError as CustomError & { code?: string; }).code).toBe('ENOENT');
    }
  });

  test('maintains error type information', () => {
    // Test with regular error
    const regularError = new Error('Regular error');
    const regularResult = Err(regularError);

    try {
      unwrapResult(regularResult);
      expect.fail('Should have thrown');
    } catch (thrownError: any) {
      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError.name).toBe('Error');
    }

    // Test with TypeError
    const typeError = new TypeError('NotFoundError: Type error');
    const typeResult = Err(typeError);

    try {
      unwrapResult(typeResult);
      expect.fail('Should have thrown');
    } catch (thrownError: any) {
      expect(thrownError).toBeInstanceOf(TypeError);
      expect(thrownError.name).toBe('TypeError');
      expect((thrownError as TypeError & { code?: string; }).code).toBe('ENOENT');
    }
  });

  test('handles complex success values', () => {
    // Nested objects
    const complexObject = {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      meta: { total: 2, page: 1 },
    };
    expect(unwrapResult(Ok(complexObject))).toEqual(complexObject);
    expect(unwrapResult(Ok(complexObject))).toBe(complexObject);

    // Functions
    const testFn = (): string => 'test';
    expect(unwrapResult(Ok(testFn))).toBe(testFn);
    expect(unwrapResult(Ok(testFn))()).toBe('test');

    // Dates
    const date = new Date('2023-01-01');
    expect(unwrapResult(Ok(date))).toBe(date);
    expect(unwrapResult(Ok(date)).getTime()).toBe(date.getTime());
  });

  test('works with Result containing Error-like objects', () => {
    // Error-like object (not an actual Error instance)
    const errorLike = {
      message: 'NotFoundError: Error-like object',
      name: 'ErrorLike',
    } as Error;

    const errorResult = Err(errorLike);

    try {
      unwrapResult(errorResult);
      expect.fail('Should have thrown');
    } catch (thrownError) {
      expect(thrownError).toBe(errorLike);
      expect((thrownError as Error & { code?: string; }).code).toBe('ENOENT');
    }
  });

  test('case sensitivity of NotFoundError detection', () => {
    const caseSensitiveTests = [
      { message: 'NotFoundError: test', shouldHaveCode: true },
      { message: 'notfounderror: test', shouldHaveCode: false },
      { message: 'NOTFOUNDERROR: test', shouldHaveCode: false },
      { message: 'NotFoundERROR: test', shouldHaveCode: false },
    ];

    caseSensitiveTests.forEach(({ message, shouldHaveCode }) => {
      const error = new Error(message);
      const errorResult = Err(error);

      try {
        unwrapResult(errorResult);
        expect.fail(`Should have thrown for message: ${message}`);
      } catch (thrownError) {
        const code = (thrownError as Error & { code?: string; }).code;
        if (shouldHaveCode) {
          expect(code).toBe('ENOENT');
        } else {
          expect(code).toBeUndefined();
        }
      }
    });
  });
});
