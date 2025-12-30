import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const { $, verify, } = types.object.logger.sink.opfs.positional;

describe('OPFS sink', () => {
  test('verify function exists and is callable', ({ expect, }) => {
    expect(typeof verify,).toBe('function',);
  });

  test('verify returns boolean or promise', async ({ expect, }) => {
    const result = verify();
    const resolved = result instanceof Promise ? await result : result;
    expect(typeof resolved,).toBe('boolean',);
  });

  test('verify detects OPFS availability', async ({ expect, }) => {
    // In modern browser environment, OPFS should be available
    const result = await verify();
    expect(result,).toBe(true,);
  });

  test('sink function exists and is callable', ({ expect, }) => {
    expect(typeof $,).toBe('function',);
  });

  test('sink writes valid LogRecord', async ({ expect, }) => {
    await verify();

    const record = {
      level: 'info' as const,
      message: 'test message',
      timestamp: Date.now(),
    };

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

  test('sink handles multiline message', async ({ expect, }) => {
    await verify();

    const record = {
      level: 'info' as const,
      message: 'line1\nline2\nline3',
      timestamp: Date.now(),
    };

    await expect(Promise.resolve($(record,),),).resolves.not.toThrow();
  });
});
