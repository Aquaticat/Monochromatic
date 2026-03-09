import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const {$} = types.object.logger.from.never.sync.positional;

describe('multi-sink logger', () => {
  test('logger has all six log level methods', () => {
    expect(typeof $.trace,).toBe('function',);
    expect(typeof $.debug,).toBe('function',);
    expect(typeof $.info,).toBe('function',);
    expect(typeof $.warn,).toBe('function',);
    expect(typeof $.error,).toBe('function',);
    expect(typeof $.fatal,).toBe('function',);
  });

  test('trace method accepts string message', () => {
    expect(() => $.trace('test trace message',),).not.toThrow();
  });

  test('debug method accepts string message', () => {
    expect(() => $.debug('test debug message',),).not.toThrow();
  });

  test('info method accepts string message', () => {
    expect(() => $.info('test info message',),).not.toThrow();
  });

  test('warn method accepts string message', () => {
    expect(() => $.warn('test warn message',),).not.toThrow();
  });

  test('error method accepts string message', () => {
    expect(() => $.error('test error message',),).not.toThrow();
  });

  test('fatal method accepts string message', () => {
    expect(() => $.fatal('test fatal message',),).not.toThrow();
  });

  test('logs with empty string message', () => {
    expect(() => $.info('',),).not.toThrow();
  });

  test('logs with unicode message', () => {
    expect(() => $.info('Hello 世界 🌍',),).not.toThrow();
  });

  test('logs with multiline message', () => {
    expect(() => $.info('line1\nline2\nline3',),).not.toThrow();
  });

  test('logs with special characters', () => {
    expect(() => $.info('Special: <script>alert("xss")</script>',),).not.toThrow();
  });

  test('logs with JSON-like content', () => {
    expect(() => $.info('{"key": "value", "count": 42}',),).not.toThrow();
  });

  test('handles rapid successive logs', () => {
    expect(() => {
      const RAPID_LOG_COUNT = 100;
      for (let logIndex = 0; logIndex < RAPID_LOG_COUNT; logIndex++) {
        $.debug(`rapid log ${logIndex}`,);
      }
    },).not.toThrow();
  });
});
