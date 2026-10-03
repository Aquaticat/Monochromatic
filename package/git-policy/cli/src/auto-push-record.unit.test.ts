/**
 The per-branch `last-pushed` record: validation, atomic publication, and tolerant reads.

 @module
 */
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../dist/final/node/index.mjs';

const {
  LAST_PUSHED_ABSENT,
  parseLastPushedRecord,
  readLastPushedRecord,
  writeLastPushedRecord,
} = internalTestExports;

/**
 A valid failed-attempt record.
 */
const FAILED_RECORD = {
  schemaVersion: 1,
  tip: 'a'.repeat(40,),
  outcome: 'failed',
  ownerToken: 'token-1',
  ownerPid: 4_242,
  exitCode: 1,
  output: 'error: failed to push some refs\n',
} as const;

/**
 Scratch directory.

 @returns directory and disposer
 */
async function scratch(): Promise<AsyncDisposable & Readonly<{ path: string; }>> {
  /**
   Directory.
   */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-last-pushed-',),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: parseLastPushedRecord.name,
  children: [
    it({
      name: 'accepts a complete record',
      fn: async function testAccepts(): Promise<void> {
        /** Serialized record. */
        const text = JSON.stringify(FAILED_RECORD,);
        expect(parseLastPushedRecord(text,),).toEqual(FAILED_RECORD,);
      },
    },),
    it({
      name: 'rejects every missing or mistyped field',
      fn: async function testRejects(): Promise<void> {
        for (const malformed of [
          { ...FAILED_RECORD, schemaVersion: 2, },
          { ...FAILED_RECORD, tip: '', },
          { ...FAILED_RECORD, outcome: 'maybe', },
          { ...FAILED_RECORD, ownerToken: '', },
          { ...FAILED_RECORD, ownerPid: 1.5, },
          { ...FAILED_RECORD, exitCode: '1', },
          { ...FAILED_RECORD, output: null, },
          null,
        ]) {
          expect(function parseMalformed(): unknown {
            return parseLastPushedRecord(JSON.stringify(malformed,),);
          },).toThrow(TypeError,);
        }
      },
    },),
  ],
},);

await describe({
  name: readLastPushedRecord.name,
  children: [
    it({
      name: 'reads an absent record as absent',
      fn: async function testAbsent(): Promise<void> {
        await using directory = await scratch();
        /** Record path nothing wrote. */
        const recordPath = join(directory.path, 'missing.json',);
        expect(await readLastPushedRecord(recordPath,),).toBe(LAST_PUSHED_ABSENT,);
      },
    },),
    it({
      name: 'reads an unreadable record as absent instead of blocking every later push',
      fn: async function testUnreadable(): Promise<void> {
        await using directory = await scratch();
        /** Truncated record. */
        const recordPath = join(directory.path, 'record.json',);
        await writeFile(recordPath, '{"schemaVersion":1,',);
        expect(await readLastPushedRecord(recordPath,),).toBe(LAST_PUSHED_ABSENT,);
      },
    },),
  ],
},);

await describe({
  name: writeLastPushedRecord.name,
  children: [
    it({
      name: 'publishes a private record by rename, replacing the previous one without leaving candidates',
      fn: async function testWrite(): Promise<void> {
        await using directory = await scratch();
        /** Record path. */
        const recordPath = join(directory.path, 'record.json',);
        await writeLastPushedRecord({ recordPath, record: { ...FAILED_RECORD, tip: 'b'.repeat(40,), }, },);
        await writeLastPushedRecord({ recordPath, record: FAILED_RECORD, },);
        expect(await readLastPushedRecord(recordPath,),).toEqual(FAILED_RECORD,);
        expect(await readdir(directory.path,),).toEqual(['record.json',],);
        expect((await stat(recordPath,)).mode & 0o777,).toBe(0o600,);
      },
    },),
    it({
      name: 'removes its candidate and rethrows when publication fails',
      fn: async function testWriteFailure(): Promise<void> {
        await using directory = await scratch();
        /** Record path occupied by a non-empty directory, so the candidate is written but the rename fails. */
        const recordPath = join(directory.path, 'record.json',);
        await mkdir(recordPath,);
        await writeFile(join(recordPath, 'occupant',), '',);
        await expect(writeLastPushedRecord({ recordPath, record: FAILED_RECORD, },),).rejects.toThrow();
        expect(await readdir(directory.path,),).toEqual(['record.json',],);
      },
    },),
  ],
},);
