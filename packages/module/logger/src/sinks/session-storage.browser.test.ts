// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/strict-boolean-expressions -- browser evaluate callbacks lose type info across page boundary

import {
  expect,
  test,
} from '@playwright/test';

declare global {
  // oxlint-disable-next-line typescript/consistent-type-imports -- typeof import() cannot use import type syntax
  var moduleLogger: typeof import('@monochromatic-dev/module-logger');
}

test.describe('sessionStorage sink', () => {
  test.beforeEach(async ({ page, },) => {
    await page.goto('/',);
    await page.waitForFunction(() => globalThis.moduleLogger !== undefined);
  },);

  test('verifySessionStorage exists and is callable', async ({ page, },) => {
    const typeofVerify = await page.evaluate(() => {
      const { verifySessionStorage, } = globalThis.moduleLogger.sinks;
      return typeof verifySessionStorage;
    },);
    expect(typeofVerify,).toBe('function',);
  });

  test('verifySessionStorage returns boolean', async ({ page, },) => {
    const resultType = await page.evaluate(() => {
      const { verifySessionStorage, } = globalThis.moduleLogger.sinks;
      return typeof verifySessionStorage();
    },);
    expect(resultType,).toBe('boolean',);
  });

  test('verifySessionStorage detects availability', async ({ page, },) => {
    const result = await page.evaluate(() => {
      const { verifySessionStorage, } = globalThis.moduleLogger.sinks;
      return verifySessionStorage();
    },);
    expect(result,).toBe(true,);
  });

  test('sink write method exists', async ({ page, },) => {
    const typeofSink = await page.evaluate(() => {
      const { sessionStorageSink, } = globalThis.moduleLogger.sinks;
      return typeof sessionStorageSink.write;
    },);
    expect(typeofSink,).toBe('function',);
  });

  test('sink writes valid LogRecord', async ({ page, },) => {
    const didNotThrow = await page.evaluate(() => {
      const {
        sessionStorageSink,
        verifySessionStorage,
      } = globalThis.moduleLogger.sinks;
      verifySessionStorage();
      const record = {
        level: 'info' as const,
        message: 'test message',
        timestamp: Date.now(),
      };
      try {
        void sessionStorageSink.write(record,);
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
      const {
        sessionStorageSink,
        verifySessionStorage,
      } = globalThis.moduleLogger.sinks;
      verifySessionStorage();
      const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal',] as const;
      for (const level of levels) {
        const record = {
          level,
          message: `test ${level} message`,
          timestamp: Date.now(),
        };
        try {
          void sessionStorageSink.write(record,);
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
      const {
        sessionStorageSink,
        verifySessionStorage,
      } = globalThis.moduleLogger.sinks;
      verifySessionStorage();
      const record = {
        level: 'info' as const,
        message: 'Hello 世界 🌍',
        timestamp: Date.now(),
      };
      try {
        void sessionStorageSink.write(record,);
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
      const {
        sessionStorageSink,
        verifySessionStorage,
      } = globalThis.moduleLogger.sinks;
      verifySessionStorage();
      const record = {
        level: 'info' as const,
        message: '',
        timestamp: Date.now(),
      };
      try {
        void sessionStorageSink.write(record,);
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
      const {
        sessionStorageSink,
        verifySessionStorage,
      } = globalThis.moduleLogger.sinks;
      verifySessionStorage();
      const record = {
        level: 'info' as const,
        message: '{"key": "value", "nested": {"a": 1}}',
        timestamp: Date.now(),
      };
      try {
        void sessionStorageSink.write(record,);
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
      const {
        sessionStorageSink,
        verifySessionStorage,
      } = globalThis.moduleLogger.sinks;

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

      verifySessionStorage();

      const testMessage = `unique-test-${Date.now()}`;
      const record = {
        level: 'info' as const,
        message: testMessage,
        timestamp: Date.now(),
      };

      void sessionStorageSink.write(record,);

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
