import {
  consoleLogger,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import type {
  Logger,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  expectTypeOf,
  test,
  vi,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('Logger type', () => {
  test('should have correct method signatures', () => {
    expectTypeOf<Logger['trace']>().toEqualTypeOf<(message: string) => unknown>();
    expectTypeOf<Logger['debug']>().toEqualTypeOf<(message: string) => unknown>();
    expectTypeOf<Logger['info']>().toEqualTypeOf<(message: string) => unknown>();
    expectTypeOf<Logger['warn']>().toEqualTypeOf<(message: string) => unknown>();
    expectTypeOf<Logger['error']>().toEqualTypeOf<(message: string) => unknown>();
    expectTypeOf<Logger['fatal']>().toEqualTypeOf<(message: string) => unknown>();
  });

  test('should accept implementations with all required methods', () => {
    const mockLogger: Logger = {
      trace: (message: string) => undefined,
      debug: (message: string) => undefined,
      info: (message: string) => undefined,
      warn: (message: string) => undefined,
      error: (message: string) => undefined,
      fatal: (message: string) => undefined,
    };

    expectTypeOf(mockLogger).toEqualTypeOf<Logger>();
  });

  test('should allow different return types for methods', () => {
    const customLogger: Logger = {
      trace: (message: string) => message.length,
      debug: (message: string) => true,
      info: (message: string) => null,
      warn: (message: string) => { console.warn(message); },
      error: (message: string) => Promise.resolve(),
      fatal: (message: string) => new Error(message),
    };

    expectTypeOf(customLogger).toMatchTypeOf<Logger>();
  });
});

describe('consoleLogger', () => {
  test('should implement Logger interface', () => {
    expectTypeOf(consoleLogger).toEqualTypeOf<Logger>();
  });

  test('should have all required methods', () => {
    expect(consoleLogger).toHaveProperty('trace');
    expect(consoleLogger).toHaveProperty('debug');
    expect(consoleLogger).toHaveProperty('info');
    expect(consoleLogger).toHaveProperty('warn');
    expect(consoleLogger).toHaveProperty('error');
    expect(consoleLogger).toHaveProperty('fatal');

    expect(typeof consoleLogger.trace).toBe('function');
    expect(typeof consoleLogger.debug).toBe('function');
    expect(typeof consoleLogger.info).toBe('function');
    expect(typeof consoleLogger.warn).toBe('function');
    expect(typeof consoleLogger.error).toBe('function');
    expect(typeof consoleLogger.fatal).toBe('function');
  });

  test('should map to correct console methods', () => {
    expect(consoleLogger.trace).toBe(console.trace);
    expect(consoleLogger.debug).toBe(console.debug);
    expect(consoleLogger.info).toBe(console.info);
    expect(consoleLogger.warn).toBe(console.warn);
    expect(consoleLogger.error).toBe(console.error);
    expect(consoleLogger.fatal).toBe(console.error); // fatal maps to console.error
  });

  test('should call appropriate console methods when used', () => {
    const traceSpy = vi.spyOn(console, 'trace').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      consoleLogger.trace('trace message');
      consoleLogger.debug('debug message');
      consoleLogger.info('info message');
      consoleLogger.warn('warn message');
      consoleLogger.error('error message');
      consoleLogger.fatal('fatal message');

      expect(traceSpy).toHaveBeenCalledWith('trace message');
      expect(debugSpy).toHaveBeenCalledWith('debug message');
      expect(infoSpy).toHaveBeenCalledWith('info message');
      expect(warnSpy).toHaveBeenCalledWith('warn message');
      expect(errorSpy).toHaveBeenCalledWith('error message');
      expect(errorSpy).toHaveBeenCalledWith('fatal message'); // fatal uses console.error
    } finally {
      traceSpy.mockRestore();
      debugSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test('should handle multiple calls correctly', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    try {
      consoleLogger.info('first message');
      consoleLogger.info('second message');
      consoleLogger.info('third message');

      expect(infoSpy).toHaveBeenCalledTimes(3);
      expect(infoSpy).toHaveBeenNthCalledWith(1, 'first message');
      expect(infoSpy).toHaveBeenNthCalledWith(2, 'second message');
      expect(infoSpy).toHaveBeenNthCalledWith(3, 'third message');
    } finally {
      infoSpy.mockRestore();
    }
  });

  test('should work with different message types', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      consoleLogger.warn('simple string');
      consoleLogger.warn('string with numbers 123');
      consoleLogger.warn('string with special chars @#$%');
      consoleLogger.warn('empty string test: ');
      consoleLogger.warn('multiline\nstring\ntest');

      expect(warnSpy).toHaveBeenCalledTimes(5);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('Logger interface usage patterns', () => {
  test('should allow custom logger implementations', () => {
    const messages: { level: string; message: string }[] = [];
    
    const customLogger: Logger = {
      trace: (message: string) => messages.push({ level: 'trace', message }),
      debug: (message: string) => messages.push({ level: 'debug', message }),
      info: (message: string) => messages.push({ level: 'info', message }),
      warn: (message: string) => messages.push({ level: 'warn', message }),
      error: (message: string) => messages.push({ level: 'error', message }),
      fatal: (message: string) => messages.push({ level: 'fatal', message }),
    };

    customLogger.info('test message');
    customLogger.error('error message');

    expect(messages).toEqual([
      { level: 'info', message: 'test message' },
      { level: 'error', message: 'error message' }
    ]);
  });

  test('should support logger composition and decoration', () => {
    const logs: string[] = [];
    
    const decoratedLogger: Logger = {
      trace: (message: string) => logs.push(`[TRACE] ${message}`),
      debug: (message: string) => logs.push(`[DEBUG] ${message}`),
      info: (message: string) => logs.push(`[INFO] ${message}`),
      warn: (message: string) => logs.push(`[WARN] ${message}`),
      error: (message: string) => logs.push(`[ERROR] ${message}`),
      fatal: (message: string) => logs.push(`[FATAL] ${message}`),
    };

    decoratedLogger.info('application started');
    decoratedLogger.warn('deprecated feature used');
    decoratedLogger.error('connection failed');

    expect(logs).toEqual([
      '[INFO] application started',
      '[WARN] deprecated feature used',
      '[ERROR] connection failed'
    ]);
  });
});