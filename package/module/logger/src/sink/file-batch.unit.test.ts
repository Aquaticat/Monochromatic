import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import { join, } from 'node:path';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createFileSink, } from '../../dist/final/node/node.mjs';

import type { LogRecord, Sink, } from '../../dist/final/neutral/index.mjs';

//region Disposable files exercise completion ownership at the persisted artifact

/** Persisted records expose serialization or append boundaries without inspecting filesystem calls. */
async function withFileSink(run: (input: {
  readonly sink: Sink;
  readonly directory: string;
  readonly readRecords: () => Promise<unknown[]>;
}) => Promise<void>,): Promise<void> {
  /** Fixture parent lives in the injected home rather than the real shared log destination. */
  const scratch = join(homedir(), 'temp/agent',);
  await mkdir(scratch, { recursive: true, mode: 0o700, },);
  await chmod(scratch, 0o700,);
  /** Each test owns its directory and asynchronous cleanup. */
  const directory = await mkdtemp(join(scratch, 'logger-batch-',),);
  await using cleanup = {
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(directory, { recursive: true, force: true, },);
    },
  };
  /** Explicit directory avoids ancestor discovery and other logger instances. */
  const sink = createFileSink({ directory, },);
  expect(await sink.verify(),).toBe(true,);
  /** Read-back checks the complete JSONL artifact after the tested completion settles. */
  async function readRecords(): Promise<unknown[]> {
    /** Verified sink creates exactly one log in this disposable directory. */
    const filenames = await readdir(directory,);
    expect(filenames,).toHaveLength(1,);
    /** Missing output must fail before any read can silently target another file. */
    const [filename,] = filenames;
    if (filename === undefined)
      throw new Error('Verified file sink did not create its log',);
    /** Newlines delimit complete records even when their JSON strings contain escaped newlines. */
    const output = await readFile(join(directory, filename,), 'utf8',);
    return output.trimEnd().split('\n',).map(function parseRecord(row,): unknown {
      return JSON.parse(row,);
    },);
  }
  await run({ sink, readRecords, directory, },);
}

await describe({
  name: 'file sink batch completion',
  concurrency: 1,
  children: [
    it({
      name: 'keeps a record admitted during an issued append in a later complete batch',
      fn: async () => {
        await withFileSink(async function checkIssuedAppend({ sink, readRecords, },): Promise<void> {
          const first = { level: 'info' as const, timestamp: 1, message: 'issued record', };
          const later = { level: 'info' as const, timestamp: 2, message: 'admitted during append', };
          /** Microtask admission happens before filesystem completion callbacks can run. */
          async function admitLater(): Promise<void> {
            await Promise.resolve();
            await sink.write(later,);
          }
          const issued = sink.write(first,);
          await Promise.all([issued, admitLater(),],);
          expect((await readRecords()).slice(1,),).toEqual([first, later,],);
        },);
      },
    },),
    it({
      name: 'reports append failure, releases its completion, and accepts the next restored write',
      fn: async ({ sinon, },) => {
        const warnings = sinon.stub(console, 'warn',);
        await withFileSink(async function checkAppendFailure({ sink, directory, readRecords, },): Promise<void> {
          const [filename,] = await readdir(directory,);
          if (filename === undefined)
            throw new Error('Verified sink has no log file',);
          const file = join(directory, filename,);
          const saved = join(directory, 'saved.jsonl',);
          await rename(file, saved,);
          await mkdir(file,);
          await sink.write({ level: 'info', timestamp: 0, message: 'failed append', },);
          await rm(file, { recursive: true, },);
          await rename(saved, file,);
          const after = { level: 'info' as const, timestamp: 1, message: 'after restored destination', };
          await sink.write(after,);
          expect((await readRecords()).slice(1,),).toEqual([after,],);
          expect(warnings.callCount,).toBe(1,);
        },);
      },
    },),
    it({
      name: 'reports rejected serializations without inserting non-JSON lines or disabling later writes',
      fn: async ({ sinon, },) => {
        const warnings = sinon.stub(console, 'warn',);
        await withFileSink(async function checkSerialization({ sink, readRecords, },): Promise<void> {
          const cyclic: LogRecord & { self?: unknown; } = {
            level: 'info', timestamp: 0, message: 'cyclic record',
          };
          cyclic.self = cyclic;
          await sink.write(cyclic,);
          const missing = { level: 'info' as const, timestamp: 0, message: 'missing JSON', toJSON(): undefined {
            return undefined;
          }, };
          await sink.write(missing,);
          const after = { level: 'info' as const, timestamp: 1, message: 'after rejected serialization', };
          await sink.write(after,);
          expect((await readRecords()).slice(1,),).toEqual([after,],);
          expect(warnings.callCount,).toBe(2,);
        },);
      },
    },),
    it({
      name: 'isolates same-millisecond sinks so multi-write records cannot interleave',
      fn: async ({ sinon, },) => {
        sinon.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date',], },);
        await withFileSink(async function checkSeparateOwners({ sink, directory, },): Promise<void> {
          const other = createFileSink({ directory, },);
          expect(await other.verify(),).toBe(true,);
          const first = { level: 'info' as const, timestamp: 1, message: `first${'"\\\n世界'.repeat(150_000,)}`, };
          const second = { level: 'info' as const, timestamp: 2, message: `second${'"\\\n世界'.repeat(150_000,)}`, };
          await Promise.all([sink.write(first,), other.write(second,),],);
          const filenames = await readdir(directory,);
          const contents = await Promise.all(filenames.map(function readLog(filename,) {
            return readFile(join(directory, filename,), 'utf8',);
          },),);
          const records = contents.flatMap(function parseLog(content,) {
            return content.trimEnd().split('\n',).map(function parseRecord(row,): unknown {
              return JSON.parse(row,);
            },);
          },);
          expect(records,).toContainEqual(first,);
          expect(records,).toContainEqual(second,);
          expect(filenames,).toHaveLength(2,);
        },);
      },
    },),
    it({
      name: 'captures same-frame records before their shared append completion',
      fn: async () => {
        await withFileSink(async function checkBatch({ sink, readRecords, },): Promise<void> {
          /** Mutation after invocation must not replace the captured record. */
          const record = { level: 'info' as const, message: 'before\n世界', timestamp: 1, };
          /** One synchronous producer frame can reuse one pending append completion. */
          const first = sink.write(record,);
          record.message = 'after';
          /** Second record joins the pending batch without losing its original position. */
          const second = sink.write({ level: 'info', message: 'second', timestamp: 2, },);
          await second;
          expect(first,).toBe(second,);
          expect((await readRecords()).slice(1,),).toEqual([
            { level: 'info', message: 'before\n世界', timestamp: 1, },
            { level: 'info', message: 'second', timestamp: 2, },
          ],);
        },);
      },
    },),
    it({
      name: 'preserves record order across bounded batches and restarts after completion',
      fn: async () => {
        await withFileSink(async function checkBatches({ sink, readRecords, },): Promise<void> {
          const records = Array.from({ length: 2_000, }, function record(_, timestamp,) {
            return { level: 'info' as const, timestamp, message: '世界\n'.repeat(30,), };
          },);
          await Promise.all(records.map(function write(record,) {
            return sink.write(record,);
          },),);
          const after = { level: 'info' as const, timestamp: records.length, message: 'after drainage', };
          await sink.write(after,);
          expect((await readRecords()).slice(1,),).toEqual([...records, after,],);
        },);
      },
    },),
    it({
      name: 'serializes reentrant multi-write records without interleaving',
      fn: async () => {
        await withFileSink(async function checkReentrant({ sink, readRecords, },): Promise<void> {
          /** Both records exceed an appendFile write chunk and contain JSON escapes. */
          const message = '"\\\n世界'.repeat(150_000,);
          /** The serializer owns this reentrant write and exposes its completion for drainage. */
          const state: { inner?: Promise<void>; } = {};
          /** Serialization can call the same sink before the enclosing record is enqueued. */
          const outer = {
            level: 'info' as const,
            message,
            timestamp: 2,
            toJSON(): { level: 'info'; message: string; timestamp: number; } {
              state.inner = sink.write({ level: 'info', message, timestamp: 1, },);
              return { level: 'info', message, timestamp: 2, };
            },
          };
          await sink.write(outer,);
          await state.inner;
          expect((await readRecords()).slice(1,),).toEqual([
            { level: 'info', message, timestamp: 1, },
            { level: 'info', message, timestamp: 2, },
          ],);
        },);
      },
    },),
  ],
},);

//endregion Disposable files exercise completion ownership at the persisted artifact
