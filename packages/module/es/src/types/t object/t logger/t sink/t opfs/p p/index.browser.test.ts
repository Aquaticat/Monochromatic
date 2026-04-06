// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-return, typescript/require-await, eslint/no-await-in-loop -- browser evaluate callbacks lose type info across page boundary

import {
  expect,
  test,
} from '@playwright/test';

declare global {
  // oxlint-disable-next-line no-var -- global augmentation requires var declaration
  // oxlint-disable-next-line typescript/consistent-type-imports -- typeof import() cannot use import type syntax
  var moduleEs: typeof import('@monochromatic-dev/module-es');
}

test.describe('OPFS sink', () => {
  test.beforeEach(async ({ page, },) => {
    await page.goto('/',);
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- runs in browser page context where moduleEs may not be loaded yet
    await page.waitForFunction(() => globalThis.moduleEs !== undefined);
  },);

  test('verify function exists and is callable', async ({ page, },) => {
    const typeofVerify = await page.evaluate(() => {
      const { verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      return typeof verify;
    },);
    expect(typeofVerify,).toBe('function',);
  });

  test('verify returns boolean or promise', async ({ page, },) => {
    const resultType = await page.evaluate(async () => {
      const { verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      const result = verify();
      const resolved = result instanceof Promise ? await result : result;
      return typeof resolved;
    },);
    expect(resultType,).toBe('boolean',);
  });

  test('verify detects OPFS availability', async ({ page, },) => {
    const result = await page.evaluate(async () => {
      const { verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      return verify();
    },);
    expect(result,).toBe(true,);
  });

  test('sink function exists and is callable', async ({ page, },) => {
    const typeofSink = await page.evaluate(() => {
      const { $, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      return typeof $;
    },);
    expect(typeofSink,).toBe('function',);
  });

  test('sink writes valid LogRecord', async ({ page, },) => {
    const didNotThrow = await page.evaluate(async () => {
      const { $, verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      await verify();
      const record = {
        level: 'info' as const,
        message: 'test message',
        timestamp: Date.now(),
      };
      try {
        await Promise.resolve($(record,),);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });

  test('sink handles all log levels', async ({ page, },) => {
    const allSucceeded = await page.evaluate(async () => {
      const { $, verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      await verify();
      const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal',] as const;
      for (const level of levels) {
        const record = {
          level,
          message: `test ${level} message`,
          timestamp: Date.now(),
        };
        try {
          await Promise.resolve($(record,),);
        }
        catch {
          return false;
        }
      }
      return true;
    },);
    expect(allSucceeded,).toBe(true,);
  });

  test('sink handles unicode in message', async ({ page, },) => {
    const didNotThrow = await page.evaluate(async () => {
      const { $, verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      await verify();
      const record = {
        level: 'info' as const,
        message: 'Hello 世界 🌍',
        timestamp: Date.now(),
      };
      try {
        await Promise.resolve($(record,),);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });

  test('sink handles empty message', async ({ page, },) => {
    const didNotThrow = await page.evaluate(async () => {
      const { $, verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      await verify();
      const record = {
        level: 'info' as const,
        message: '',
        timestamp: Date.now(),
      };
      try {
        await Promise.resolve($(record,),);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });

  test('sink handles JSON in message', async ({ page, },) => {
    const didNotThrow = await page.evaluate(async () => {
      const { $, verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      await verify();
      const record = {
        level: 'info' as const,
        message: '{"key": "value", "nested": {"a": 1}}',
        timestamp: Date.now(),
      };
      try {
        await Promise.resolve($(record,),);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });

  test('sink handles multiline message', async ({ page, },) => {
    const didNotThrow = await page.evaluate(async () => {
      const { $, verify, } = globalThis.moduleEs.types.object.logger.sink.opfs.positional;
      await verify();
      const record = {
        level: 'info' as const,
        message: 'line1\nline2\nline3',
        timestamp: Date.now(),
      };
      try {
        await Promise.resolve($(record,),);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });
});
