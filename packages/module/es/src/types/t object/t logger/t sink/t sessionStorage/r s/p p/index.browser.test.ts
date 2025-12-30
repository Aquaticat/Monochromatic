import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const { $, verify, } = types.object.logger.sink.sessionStorage.sync.positional;

describe('sessionStorage sink', () => {
  test('verify function exists and is callable', ({ expect, }) => {
    expect(typeof verify,).toBe('function',);
  });

  test('verify returns boolean', ({ expect, }) => {
    const result = verify();
    expect(typeof result,).toBe('boolean',);
  });

  test('verify detects sessionStorage availability', ({ expect, }) => {
    // In browser environment, sessionStorage should be available
    const result = verify();
    expect(result,).toBe(true,);
  });

  test('sink function exists and is callable', ({ expect, }) => {
    expect(typeof $,).toBe('function',);
  });

  test('sink writes valid LogRecord', ({ expect, }) => {
    verify();

    const record = {
      level: 'info' as const,
      message: 'test message',
      timestamp: Date.now(),
    };

    expect(() => $(record,),).not.toThrow();
  });

  test('sink handles all log levels', ({ expect, }) => {
    verify();

    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal',] as const;

    for (const level of levels) {
      const record = {
        level,
        message: `test ${level} message`,
        timestamp: Date.now(),
      };
      expect(() => $(record,),).not.toThrow();
    }
  });

  test('sink handles unicode in message', ({ expect, }) => {
    verify();

    const record = {
      level: 'info' as const,
      message: 'Hello 世界 🌍',
      timestamp: Date.now(),
    };

    expect(() => $(record,),).not.toThrow();
  });

  test('sink handles empty message', ({ expect, }) => {
    verify();

    const record = {
      level: 'info' as const,
      message: '',
      timestamp: Date.now(),
    };

    expect(() => $(record,),).not.toThrow();
  });

  test('sink handles JSON in message', ({ expect, }) => {
    verify();

    const record = {
      level: 'info' as const,
      message: '{"key": "value", "nested": {"a": 1}}',
      timestamp: Date.now(),
    };

    expect(() => $(record,),).not.toThrow();
  });

  test('written records can be retrieved from sessionStorage', ({ expect, }) => {
    // Clear any existing logs first
    const keysToRemove: string[] = [];
    const storageLength = globalThis.sessionStorage.length;
    for (let storageIndex = 0; storageIndex < storageLength; storageIndex++) {
      const key = globalThis.sessionStorage.key(storageIndex,);
      if (key?.startsWith('monochromatic.log',)) {
        keysToRemove.push(key,);
      }
    }
    keysToRemove.forEach((key,) => globalThis.sessionStorage.removeItem(key,),);

    verify();

    const testMessage = `unique-test-${Date.now()}`;
    const record = {
      level: 'info' as const,
      message: testMessage,
      timestamp: Date.now(),
    };

    $(record,);

    // Find the written record
    let found = false;
    const currentStorageLength = globalThis.sessionStorage.length;
    for (let storageIndex = 0; storageIndex < currentStorageLength; storageIndex++) {
      const key = globalThis.sessionStorage.key(storageIndex,);
      if (key?.startsWith('monochromatic.log',)) {
        const value = globalThis.sessionStorage.getItem(key,);
        if (value?.includes(testMessage,)) {
          found = true;
          const parsed = JSON.parse(value,);
          expect(parsed.message,).toBe(testMessage,);
          expect(parsed.level,).toBe('info',);
          break;
        }
      }
    }

    expect(found,).toBe(true,);
  });
});
