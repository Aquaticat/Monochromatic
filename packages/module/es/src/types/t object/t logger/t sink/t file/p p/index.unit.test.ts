import {
  stat,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

const {
  $,
  findNodeModulesUp,
  verify,
} = types.object.logger.sink.file.positional;

/**
 * Mock `stat` that always throws an ENOENT-like error, so `findNodeModulesUp`
 * walks the whole tree and exhausts without matching.
 *
 * @returns never -- always throws
 */
function statAlwaysMissing(): never {
  const error: NodeJS.ErrnoException = Object.assign(
    new Error('ENOENT',),
    { code: 'ENOENT', },
  );
  throw error;
}

await describe({
  name: $.constructor.name,
  children: [
    it({
      name: 'verify function exists and is callable',
      fn: async () => {
        expect(typeof verify,).toBe('function',);
      },
    },),

    it({
      name: 'verify returns boolean or promise',
      fn: async () => {
        const result = verify();
        const resolved = result instanceof Promise ? await result : result;
        expect(typeof resolved,).toBe('boolean',);
      },
    },),

    it({
      name: 'verify reports availability when running in a package with ancestor node_modules',
      fn: async () => {
        // Tests run from within the monorepo, so an ancestor node_modules
        // always exists. Availability proves find-up located it AND that
        // mkdir/appendFile/readFile all succeeded.
        expect(await verify(),).toBe(true,);
      },
    },),

    it({
      name: 'concurrent verify calls share a single in-flight promise',
      fn: async () => {
        // Regression guard for the race that used to return false to late
        // callers because a synchronous `verified = true` flag was flipped
        // at entry before the async work finished.
        const [a, b, c,] = await Promise.all([
          verify(),
          verify(),
          verify(),
        ],);
        expect(a,).toBe(b,);
        expect(b,).toBe(c,);
      },
    },),

    it({
      name: 'findNodeModulesUp finds the nearest ancestor node_modules',
      fn: async () => {
        const result = await findNodeModulesUp({
          cwd: import.meta.dirname,
          stat,
          dirname,
          join,
        },);
        expect(typeof result,).toBe('string',);
        expect(result?.endsWith('node_modules',),).toBe(true,);
      },
    },),

    it({
      name: 'findNodeModulesUp returns undefined when no ancestor contains node_modules',
      fn: async () => {
        const result = await findNodeModulesUp({
          cwd: import.meta.dirname,
          stat: statAlwaysMissing as unknown as typeof stat,
          dirname,
          join,
        },);
        expect(result,).toBe(undefined,);
      },
    },),

    it({
      name: 'sink function exists and is callable',
      fn: async () => {
        expect(typeof $,).toBe('function',);
      },
    },),

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
    },),

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
    },),

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
    },),

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
    },),

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
    },),
  ],
},);
