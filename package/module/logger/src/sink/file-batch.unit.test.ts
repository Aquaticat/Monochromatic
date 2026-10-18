import { chmod, mkdir, mkdtemp, readFile, readdir, rm, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import { join, } from 'node:path';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createFileSink, } from '../../dist/final/node/node.mjs';

import type { Sink, } from '../../dist/final/neutral/index.mjs';

//region Disposable files exercise completion ownership at the persisted artifact

/** Persisted records expose serialization or append boundaries without inspecting filesystem calls. */
async function withFileSink(run: (input: {
  readonly sink: Sink;
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
  await run({ sink, readRecords, },);
}

await describe({
  name: 'file sink batch completion',
  children: [
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
