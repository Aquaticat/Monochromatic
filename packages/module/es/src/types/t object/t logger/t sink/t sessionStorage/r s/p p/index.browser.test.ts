// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-return, typescript/strict-boolean-expressions -- browser evaluate callbacks lose type info across page boundary

import {
  expect,
  test,
} from '@playwright/test';

import type * as ModuleEs from '@monochromatic-dev/module-es';

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- global augmentation requires interface
  interface Window {
    moduleEs: ModuleEs;
  }
}

test.describe('sessionStorage sink', () => {
  test.beforeEach(async ({ page, },) => {
    await page.goto('/',);
    await page.waitForFunction(() => globalThis.moduleEs !== undefined);
  },);

  test('verify function exists and is callable', async ({ page, },) => {
    const typeofVerify = await page.evaluate(() => {
      const { verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      return typeof verify;
    },);
    expect(typeofVerify,).toBe('function',);
  });

  test('verify returns boolean', async ({ page, },) => {
    const resultType = await page.evaluate(() => {
      const { verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      return typeof verify();
    },);
    expect(resultType,).toBe('boolean',);
  });

  test('verify detects sessionStorage availability', async ({ page, },) => {
    const result = await page.evaluate(() => {
      const { verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      return verify();
    },);
    expect(result,).toBe(true,);
  });

  test('sink function exists and is callable', async ({ page, },) => {
    const typeofSink = await page.evaluate(() => {
      const { $, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      return typeof $;
    },);
    expect(typeofSink,).toBe('function',);
  });

  test('sink writes valid LogRecord', async ({ page, },) => {
    const didNotThrow = await page.evaluate(() => {
      const { $, verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      verify();
      const record = {
        level: 'info' as const,
        message: 'test message',
        timestamp: Date.now(),
      };
      try {
        $(record,);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });

  test('sink handles all log levels', async ({ page, },) => {
    const allSucceeded = await page.evaluate(() => {
      const { $, verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      verify();
      const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal',] as const;
      for (const level of levels) {
        const record = {
          level,
          message: `test ${level} message`,
          timestamp: Date.now(),
        };
        try {
          $(record,);
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
    const didNotThrow = await page.evaluate(() => {
      const { $, verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      verify();
      const record = {
        level: 'info' as const,
        message: 'Hello 世界 🌍',
        timestamp: Date.now(),
      };
      try {
        $(record,);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });

  test('sink handles empty message', async ({ page, },) => {
    const didNotThrow = await page.evaluate(() => {
      const { $, verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      verify();
      const record = {
        level: 'info' as const,
        message: '',
        timestamp: Date.now(),
      };
      try {
        $(record,);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });

  test('sink handles JSON in message', async ({ page, },) => {
    const didNotThrow = await page.evaluate(() => {
      const { $, verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;
      verify();
      const record = {
        level: 'info' as const,
        message: '{"key": "value", "nested": {"a": 1}}',
        timestamp: Date.now(),
      };
      try {
        $(record,);
        return true;
      }
      catch {
        return false;
      }
    },);
    expect(didNotThrow,).toBe(true,);
  });

  test('written records can be retrieved from sessionStorage', async ({ page, },) => {
    const result = await page.evaluate(() => {
      const { $, verify, } =
        globalThis.moduleEs.types.object.logger.sink.sessionStorage.sync.positional;

      // Clear any existing logs first
      const keysToRemove: string[] = [];
      const storageLength = globalThis.sessionStorage.length;
      for (let storageIndex = 0; storageIndex < storageLength; storageIndex++) {
        const key = globalThis.sessionStorage.key(storageIndex,);
        if (key?.startsWith('monochromatic.log',))
          keysToRemove.push(key,);
      }
      keysToRemove.forEach(key => {
        globalThis.sessionStorage.removeItem(key,);
      },);

      verify();

      const testMessage = `unique-test-${Date.now()}`;
      const record = {
        level: 'info' as const,
        message: testMessage,
        timestamp: Date.now(),
      };

      $(record,);

      // Find the written record
      const currentStorageLength = globalThis.sessionStorage.length;
      for (let storageIndex = 0; storageIndex < currentStorageLength; storageIndex++) {
        const key = globalThis.sessionStorage.key(storageIndex,);
        if (key?.startsWith('monochromatic.log',)) {
          const value = globalThis.sessionStorage.getItem(key,);
          if (value?.includes(testMessage,)) {
            const parsed = JSON.parse(value,);
            return {
              found: true,
              message: parsed.message,
              level: parsed.level,
              testMessage,
            };
          }
        }
      }

      return { found: false, message: null, level: null, testMessage, };
    },);

    expect(result.found,).toBe(true,);
    expect(result.message,).toBe(result.testMessage,);
    expect(result.level,).toBe('info',);
  });
});
