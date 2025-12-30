import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const { $, verify, } = types.object.logger.sink.file.positional;

describe('file sink', () => {
  test('verify function exists and is callable', ({ expect, }) => {
    expect(typeof verify,).toBe('function',);
  });

  test('verify returns boolean or promise', async ({ expect, }) => {
    const result = verify();
    const resolved = result instanceof Promise ? await result : result;
    expect(typeof resolved,).toBe('boolean',);
  });

  test('sink function exists and is callable', ({ expect, }) => {
    expect(typeof $,).toBe('function',);
  });

  test('sink accepts valid LogRecord', async ({ expect, }) => {
    // Verify first to set up the file path
    await verify();

    const record = {
      level: 'info' as const,
      message: 'test message',
      timestamp: Date.now(),
    };

    // Should not throw even if file is unavailable
    await expect(Promise.resolve($(record,),),).resolves.not.toThrow();
  });

  test('sink handles all log levels', async ({ expect, }) => {
    await verify();

    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal',] as const;

    for (const level of levels) {
      const record = {
        level,
        message: `test ${level} message`,
        timestamp: Date.now(),
      };
      // eslint-disable-next-line no-await-in-loop -- Ensuring each level works sequentially
      await expect(Promise.resolve($(record,),),).resolves.not.toThrow();
    }
  });

  test('sink handles unicode in message', async ({ expect, }) => {
    await verify();

    const record = {
      level: 'info' as const,
      message: 'Hello 世界 🌍',
      timestamp: Date.now(),
    };

    await expect(Promise.resolve($(record,),),).resolves.not.toThrow();
  });

  test('sink handles empty message', async ({ expect, }) => {
    await verify();

    const record = {
      level: 'info' as const,
      message: '',
      timestamp: Date.now(),
    };

    await expect(Promise.resolve($(record,),),).resolves.not.toThrow();
  });

  test('sink handles JSON in message', async ({ expect, }) => {
    await verify();

    const record = {
      level: 'info' as const,
      message: '{"key": "value", "nested": {"a": 1}}',
      timestamp: Date.now(),
    };

    await expect(Promise.resolve($(record,),),).resolves.not.toThrow();
  });
});
