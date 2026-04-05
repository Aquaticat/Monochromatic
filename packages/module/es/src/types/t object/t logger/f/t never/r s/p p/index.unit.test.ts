import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

const { $, } = types.object.logger.from.never.sync.positional;

await describe({
  name: $.constructor.name,
  children: [
    it({
      name: 'logger has all six log level methods',
      fn: async () => {
        expect(typeof $.trace,).toBe('function',);
        expect(typeof $.debug,).toBe('function',);
        expect(typeof $.info,).toBe('function',);
        expect(typeof $.warn,).toBe('function',);
        expect(typeof $.error,).toBe('function',);
        expect(typeof $.fatal,).toBe('function',);
      },
    }),

    it({
      name: 'trace method accepts string message',
      fn: async () => {
        expect(() => {
          $.trace('test trace message',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'debug method accepts string message',
      fn: async () => {
        expect(() => {
          $.debug('test debug message',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'info method accepts string message',
      fn: async () => {
        expect(() => {
          $.info('test info message',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'warn method accepts string message',
      fn: async () => {
        expect(() => {
          $.warn('test warn message',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'error method accepts string message',
      fn: async () => {
        expect(() => {
          $.error('test error message',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'fatal method accepts string message',
      fn: async () => {
        expect(() => {
          $.fatal('test fatal message',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'logs with empty string message',
      fn: async () => {
        expect(() => {
          $.info('',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'logs with unicode message',
      fn: async () => {
        expect(() => {
          $.info('Hello 世界 🌍',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'logs with multiline message',
      fn: async () => {
        expect(() => {
          $.info('line1\nline2\nline3',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'logs with special characters',
      fn: async () => {
        expect(() => {
          $.info('Special: <script>alert("xss")</script>',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'logs with JSON-like content',
      fn: async () => {
        expect(() => {
          $.info('{"key": "value", "count": 42}',);
        },)
          .not
          .toThrow();
      },
    }),

    it({
      name: 'handles rapid successive logs',
      fn: async () => {
        expect(() => {
          const RAPID_LOG_COUNT = 100;
          for (let logIndex = 0; logIndex < RAPID_LOG_COUNT; logIndex++)
            $.debug(`rapid log ${logIndex}`,);
        },)
          .not
          .toThrow();
      },
    }),
  ],
},);
