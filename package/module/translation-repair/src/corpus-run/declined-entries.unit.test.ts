/**
 * Tests for the decline records a pass leaves behind and the next pass reads.
 *
 * @module
 */

import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DECLINED_DIR,
  declinedEntryIds,
  writeDeclinedEntry,
} from '../../dist/final/node/index.mjs';

/**
 * A throwaway root, removed when the case ends.
 *
 * @returns Root path with its disposer
 *
 * @example
 * ```ts
 * await using root = await throwawayRoot();
 * ```
 */
async function throwawayRoot(): Promise<{ readonly path: string; } & AsyncDisposable> {
  /**
   * Root nothing outside this case writes into.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'declined-',
  ),);
  return {
    path,
    [Symbol.asyncDispose]: async () => {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

await describe({
  name: writeDeclinedEntry.name,
  children: [
    it({
      name: 'writes one JSON record per declined entry into a directory it creates, and reads the ids back '
        + 'sorted; an absent directory reads as no declines',
      fn: async () => {
        await using root = await throwawayRoot();
        /**
         * Directory of records, not yet created.
         */
        const declinedDir = join(
          root.path,
          DECLINED_DIR,
        );
        expect(await declinedEntryIds({ declinedDir, },),).toStrictEqual(new Set<string>(),);
        await writeDeclinedEntry({
          declinedDir,
          record: {
            id: 'zeta',
            tip: 'abc',
            pipelineDigest: 'sha256:0',
            corpusSha: 'def',
            timestamp: '2026-09-08T21:00:00.000Z',
            reason: 'archive-original',
            note: '这篇文章的原文即英文',
          },
        },);
        await writeDeclinedEntry({
          declinedDir,
          record: {
            id: 'alpha',
            tip: 'abc',
            pipelineDigest: 'sha256:0',
            corpusSha: 'def',
            timestamp: '2026-09-08T21:00:01.000Z',
            reason: 'archive-original',
            note: '请翻译时不要动本篇',
          },
        },);
        expect([ ...await declinedEntryIds({ declinedDir, },), ],).toStrictEqual([
          'alpha',
          'zeta',
        ],);
        /**
         * The record as written.
         */
        const written: unknown = JSON.parse(await readFile(
          join(
            declinedDir,
            'zeta.json',
          ),
          'utf8',
        ),);
        expect(written,).toStrictEqual({
          id: 'zeta',
          tip: 'abc',
          pipelineDigest: 'sha256:0',
          corpusSha: 'def',
          timestamp: '2026-09-08T21:00:00.000Z',
          reason: 'archive-original',
          note: '这篇文章的原文即英文',
        },);
      },
    },),
  ],
},);
