import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

const { $, verify, } = types.object.logger.sink.file.positional;

await describe({
  name: $.constructor.name,
  children: [
    it({
      name: 'verify function exists and is callable',
      fn: async () => {
        expect(typeof verify,).toBe('function',);
      },
    }),

    it({
      name: 'verify returns boolean or promise',
      fn: async () => {
        const result = verify();
        const resolved = result instanceof Promise ? await result : result;
        expect(typeof resolved,).toBe('boolean',);
      },
    }),

    it({
      name: 'sink function exists and is callable',
      fn: async () => {
        expect(typeof $,).toBe('function',);
      },
    }),

    it({
      name: 'sink accepts valid LogRecord',
      fn: async () => {
        // Verify first to set up the file path
        await verify();

        const record = {
          level: 'info' as const,
          message: 'test message',
          timestamp: Date.now(),
        };

        // Should not throw even if file is unavailable
        await Promise.resolve($(record,),);
      },
    }),

    it({
      name: 'sink handles all log levels',
      fn: async () => {
        await verify();

        const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal',] as const;

        for (const level of levels) {
          const record = {
            level,
            message: `test ${level} message`,
            timestamp: Date.now(),
          };
          // oxlint-disable-next-line no-await-in-loop -- Ensuring each level works sequentially
          await Promise.resolve($(record,),);
        }
      },
    }),

    it({
      name: 'sink handles unicode in message',
      fn: async () => {
        await verify();

        const record = {
          level: 'info' as const,
          message: 'Hello 世界 🌍',
          timestamp: Date.now(),
        };

        await Promise.resolve($(record,),);
      },
    }),

    it({
      name: 'sink handles empty message',
      fn: async () => {
        await verify();

        const record = {
          level: 'info' as const,
          message: '',
          timestamp: Date.now(),
        };

        await Promise.resolve($(record,),);
      },
    }),

    it({
      name: 'sink handles JSON in message',
      fn: async () => {
        await verify();

        const record = {
          level: 'info' as const,
          message: '{"key": "value", "nested": {"a": 1}}',
          timestamp: Date.now(),
        };

        await Promise.resolve($(record,),);
      },
    }),
  ],
},);
