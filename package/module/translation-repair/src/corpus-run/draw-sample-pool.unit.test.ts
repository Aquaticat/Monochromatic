/**
 Tests for the read of a runs directory into the pool a draw samples from.

 THE POOL IS A DENOMINATOR, so what is pinned is which files it reads, in what
 order and what it asks the corpus for: every admitted artifact once, by the
 page its entry names, and nothing a directory or a stray file adds. The pool's
 own census prints its lines through the console, which each case diverts.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  digestPipeline,
  readDrawPool,
} from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { divertingConsoleLog, } from './console-log-capture.test-fixture.ts';
import { writeSettledArtifact, } from './settled-v1-pool.test-fixture.ts';

await describe({
  name: readDrawPool.name,
  // ONE AT A TIME: its cases divert the process-wide `console.log`.
  concurrency: 1,
  children: [
    it({
      name: 'READS every settled artifact in code point order, asking the corpus for the page of each entry once',
      fn: async (ctx) => {
        await using scratch = await scratchDir({ prefix: 'draw-pool-', },);
        await writeSettledArtifact({
          runsDir: scratch.path,
          entryId: 'tabby',
          issueIds: ['adjudicated/nap',],
          repairRecorded: false,
        },);
        await writeSettledArtifact({
          runsDir: scratch.path,
          entryId: 'mittens',
          issueIds: [
            'adjudicated/purr',
            'adjudicated/knead',
          ],
          repairRecorded: false,
        },);
        await mkdir(join(
          scratch.path,
          'artifacts',
          'backup.json',
        ),);

        /**
         Pages the corpus was asked for, in order.
         */
        const asked: string[] = [];
        using capture = divertingConsoleLog({ sinon: ctx.sinon, },);

        const pool = await readDrawPool({
          runsDir: scratch.path,
          readSource: async function readPage({ relPath, },): Promise<string> {
            asked.push(relPath,);
            return await Promise.resolve('猫猫在窗台上睡觉。\n',);
          },
        },);
        const { digest, } = await digestPipeline({ dir: join(
          import.meta.dirname,
          '../../dist/final/node',
        ), },);

        expect(pool.names,).toEqual([
          'mittens.json',
          'tabby.json',
        ],);
        expect(pool.entries.map(function idOf(entry,): string {
          return entry.id;
        },),).toEqual([
          'mittens',
          'tabby',
        ],);
        expect(pool.pool.map(function issueOf(candidate,): string {
          return candidate.issueId;
        },),).toEqual([
          pool.entries[0]?.candidates[0]?.issueId,
          pool.entries[0]?.candidates[1]?.issueId,
          pool.entries[1]?.candidates[0]?.issueId,
        ],);
        expect(pool.pool.length,).toBe(3,);
        expect(pool.eligible.entryIds,).toEqual([
          'mittens',
          'tabby',
        ],);
        expect(asked.toSorted(),).toEqual([
          'people/mittens/page.md',
          'people/tabby/page.md',
        ],);
        expect(capture.lines,).toEqual([
          `POOL read by pipeline ${digest}`,
          'POOL 2 entries across 1 pipeline generation',
        ],);
      },
    },),
  ],
},);
