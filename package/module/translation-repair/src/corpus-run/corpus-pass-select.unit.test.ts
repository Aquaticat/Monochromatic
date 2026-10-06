/**
 Tests for the choice of entries a corpus pass runs: every complete unsettled
 pair at the pin, or only those the command line names, resuming cached
 progress first, with the restriction and every pair it could not read said
 on the way.

 The corpus is a throwaway repository of invented pages, never the
 operator's clone.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { selectPendingEntries, } from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';
import { relayingConsoleLog, } from './console-log-capture.test-fixture.ts';
import { makeCorpusPassClone, } from './corpus-pass-clone.test-fixture.ts';

/**
 Original page of an entry whose size puts it in the small band.
 */
const SMALL_PAGE = '猫睡觉。\n';

/**
 English page of an entry.
 */
const ENGLISH_PAGE = 'The cat naps.\n';

/**
 Complete pairs of the invented corpus, in the order the clone lists them.
 */
const COMPLETE = [
  {
    id: 'biscuit',
    sourceText: SMALL_PAGE,
    targetText: ENGLISH_PAGE,
  },
  {
    id: 'tabby',
    sourceText: SMALL_PAGE,
    targetText: ENGLISH_PAGE,
  },
] as const;

/**
 Ids of a list of pairs, in order.

 @param pairs - pairs to read

 @returns Their ids

 @example
 ```ts
 const ids = idsOf({ pairs, },);
 ```
 */
function idsOf(
  { pairs, }: { readonly pairs: readonly { readonly id: string; }[]; },
): readonly string[] {
  return pairs.map(function toId(pair,): string {
    return pair.id;
  },);
}

await describe({
  name: selectPendingEntries.name,
  concurrency: 1,
  children: [
    it({
      name: 'CHOOSES EVERY COMPLETE PAIR in the corpus, and says nothing when nothing is restricted or missing',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: COMPLETE, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-select-', },);

        /**
         What the pass would run.
         */
        const pending = await selectPendingEntries({
          line: lineOf({
            command: 'corpus-pass',
            typed: [],
          },),
          pin: clone,
          done: new Set<string>(),
          attempts: new Map(),
          sliceCacheDir: scratch.path,
        },);

        expect(idsOf({ pairs: pending, },),).toEqual([
          'biscuit',
          'tabby',
        ],);
        expect(printed.lines,).toEqual([],);
      },
    },),
    it({
      name: 'LEAVES OUT AN ENTRY FINISHED BEFORE and one with no English page, and names the second',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: [
          ...COMPLETE,
          {
            id: 'mittens',
            sourceText: SMALL_PAGE,
          },
        ], },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-select-', },);

        /**
         What the pass would run.
         */
        const pending = await selectPendingEntries({
          line: lineOf({
            command: 'corpus-pass',
            typed: [],
          },),
          pin: clone,
          done: new Set(['biscuit',],),
          attempts: new Map(),
          sliceCacheDir: scratch.path,
        },);

        expect(idsOf({ pairs: pending, },),).toEqual(['tabby',],);
        expect(printed.lines,).toEqual([
          `INCOMPLETE mittens: target page absent at the pin (corpus read failed for ${clone.commitSha}:`
          + 'people/mittens/page.en.md (missing-object); check that the clone exists and the pinned commit '
          + 'is present.)',
        ],);
      },
    },),
    it({
      name: 'CHOOSES ONLY THE ENTRIES THE COMMAND LINE NAMES and says it bypassed the ordering, naming them in '
        + 'code point order',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: COMPLETE, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-select-', },);

        /**
         What the pass would run.
         */
        const pending = await selectPendingEntries({
          line: lineOf({
            command: 'corpus-pass',
            typed: [
              '--only',
              'tabby',
            ],
          },),
          pin: clone,
          done: new Set<string>(),
          attempts: new Map(),
          sliceCacheDir: scratch.path,
        },);

        expect(idsOf({ pairs: pending, },),).toEqual(['tabby',],);
        expect(printed.lines,).toEqual([
          'ONLY tabby (ordering is bypassed; run this into a throwaway TRANSLATION_REPAIR_RUNS_DIR so a '
          + 'hand-picked entry never enters a pool later draws treat as natural accumulation)',
        ],);
      },
    },),
    it({
      name: 'REFUSES AN ENTRY THE CORPUS DOES NOT HOLD after saying which entries it was restricted to',
      fn: async (ctx) => {
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using clone = await makeCorpusPassClone({ entries: COMPLETE, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-select-', },);

        await expect(selectPendingEntries({
          line: lineOf({
            command: 'corpus-pass',
            typed: [
              '--only',
              'nobody',
            ],
          },),
          pin: clone,
          done: new Set<string>(),
          attempts: new Map(),
          sliceCacheDir: scratch.path,
        },),).rejects.toThrow('--only asks for "nobody", which the corpus at the pin does not hold',);
        expect(printed.lines.length,).toBe(1,);
      },
    },),
    it({
      name: 'RESUMES AN ENTRY HOLDING CACHED SLICES FIRST, ahead of one that comes earlier in the corpus',
      fn: async () => {
        await using clone = await makeCorpusPassClone({ entries: COMPLETE, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-select-', },);
        await mkdir(join(
          scratch.path,
          'tabby',
        ),);
        await writeFile(
          join(
            scratch.path,
            'tabby',
            '0.json',
          ),
          '{}',
        );

        /**
         What the pass would run.
         */
        const pending = await selectPendingEntries({
          line: lineOf({
            command: 'corpus-pass',
            typed: [],
          },),
          pin: clone,
          done: new Set<string>(),
          attempts: new Map(),
          sliceCacheDir: scratch.path,
        },);

        expect(idsOf({ pairs: pending, },),).toEqual([
          'tabby',
          'biscuit',
        ],);
      },
    },),
    it({
      name: 'PUTS AN ENTRY TRIED BEFORE BEHIND ONE NOT YET TRIED of its band, from the counts it is handed',
      fn: async () => {
        await using clone = await makeCorpusPassClone({ entries: COMPLETE, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-select-', },);

        /**
         What the pass would run.
         */
        const pending = await selectPendingEntries({
          line: lineOf({
            command: 'corpus-pass',
            typed: [],
          },),
          pin: clone,
          done: new Set<string>(),
          attempts: new Map([
            [
              'biscuit',
              4,
            ],
          ],),
          sliceCacheDir: scratch.path,
        },);

        expect(idsOf({ pairs: pending, },),).toEqual([
          'tabby',
          'biscuit',
        ],);
      },
    },),
  ],
},);
