import { stat, } from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createFileSink,
  findNodeModulesUp,
  NO_NODE_MODULES_FOUND,
} from './file.ts';
import type { LogRecord, } from '../types.ts';

/**
 * Mock `stat` that always throws an ENOENT-like error, so `findNodeModulesUp`
 * walks the whole tree and exhausts without matching.
 *
 * @returns Never; always throws.
 */
function statAlwaysMissing(): never {
  const error: NodeJS.ErrnoException = Object.assign(
    new Error('ENOENT',),
    { code: 'ENOENT', },
  );
  throw error;
}

/**
 * Mock `stat` that always throws an unexpected permission error.
 *
 * @returns Never; always throws.
 */
function statAlwaysDenied(): never {
  const error: NodeJS.ErrnoException = Object.assign(
    new Error('EACCES',),
    { code: 'EACCES', },
  );
  throw error;
}

/**
 * Builds a LogRecord for write-path tests.
 *
 * @param message - Message body.
 *
 * @returns Record at a fixed timestamp.
 */
function record({ message, }: { readonly message: string; },): LogRecord {
  return {
    level: 'info',
    message,
    timestamp: 0,
  };
}

await describe({
  name: 'file sink',
  children: [
    it({
      name: 'exposes callable verify and write methods',
      fn: async () => {
        const sink = createFileSink();
        expect(typeof sink.verify,).toBe('function',);
        expect(typeof sink.write,).toBe('function',);
      },
    },),

    it({
      name: 'verify resolves a boolean',
      fn: async () => {
        const resolved = await createFileSink().verify();
        expect(typeof resolved,).toBe('boolean',);
      },
    },),

    it({
      name: 'verify reports availability when running in a package with ancestor node_modules',
      fn: async () => {
        // Tests run from within the monorepo, so an ancestor node_modules
        // always exists. Availability proves find-up located it AND that
        // mkdir/appendFile/readFile all succeeded.
        expect(await createFileSink().verify(),).toBe(true,);
      },
    },),

    it({
      name: 'concurrent verify calls on one sink share a single in-flight promise',
      fn: async () => {
        // Regression guard for the race that used to return false to late
        // callers. The memo now lives in the instance closure, not a module
        // global, so a fresh sink exercises it cleanly.
        const sink = createFileSink();
        const [a, b, c,] = await Promise.all([
          sink.verify(),
          sink.verify(),
          sink.verify(),
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
        if ((typeof result) === 'string')
          expect(result.endsWith('node_modules',),).toBe(true,);
      },
    },),

    it({
      name: 'findNodeModulesUp keeps expected missing candidates silent',
      fn: async () => {
        /** Unexpected faults reported during expected missing-path walk. */
        const reports: unknown[] = [];
        /** Exhausted ancestor result. */
        const result = await findNodeModulesUp({
          cwd: import.meta.dirname,
          stat: statAlwaysMissing as unknown as typeof stat,
          dirname,
          join,
          reportError: function collectUnexpectedReport(report,) {
            reports.push(report,);
          },
        },);
        expect(result,).toBe(NO_NODE_MODULES_FOUND,);
        expect(reports,).toEqual([],);
      },
    },),

    it({
      name: 'findNodeModulesUp reports unexpected stat failures',
      fn: async () => {
        /** Unexpected faults reported during denied-path walk. */
        const reports: unknown[] = [];
        await findNodeModulesUp({
          cwd: import.meta.dirname,
          stat: statAlwaysDenied as unknown as typeof stat,
          dirname,
          join,
          reportError: function collectUnexpectedReport(report,) {
            reports.push(report,);
          },
        },);
        expect(reports.length > 0,).toBe(true,);
      },
    },),

    it({
      name: 'write before verify resolves without touching the filesystem',
      fn: async () => {
        // Verification resolves the log path and caches `appendFile`; without
        // it both stay unset, so write takes the unset-guard early return,
        // resolving as a silent no-op rather than throwing or writing.
        const sink = createFileSink();
        await expect(
          sink.write(record({ message: 'before verify', },),),
        )
          .resolves
          .toBeUndefined();
      },
    },),

    it({
      name: 'a verified sink accepts records across levels and message shapes',
      fn: async () => {
        const sink = createFileSink();
        await sink.verify();

        const messages = [
          'plain message',
          'Hello 世界 🌍',
          '',
          '{"key": "value", "nested": {"a": 1}}',
          'line1\nline2\nline3',
        ];
        for (const message of messages)
          // oxlint-disable-next-line no-await-in-loop -- sequential appends keep file order deterministic
          await sink.write(record({ message, },),);
      },
    },),
  ],
},);
