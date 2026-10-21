/**
 Tests the whole `reader-measure` command over scripted pieces: trusted
 readings and pictures in throwaway directories, a scripted deterministic
 reader and a scripted client. No provider is reached.

 WHAT THEY PIN: a candidate that answers as the seated readers do passes both
 clauses and is told the one edit to make; a candidate that answers with
 something else fails and is told to keep the hold; a measurement with nothing
 to hold the candidate to, or nothing to try, is refused by name; and the
 per-picture lines name what the candidate gave.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { mkdir, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary';
import type { ModelCaller, } from '@monochromatic-dev/translation-repair-provider';
import { HANG_STOP_MS, } from '@monochromatic-dev/translation-repair-test-fixture/ts/hang-stop.test-fixture.ts';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/rejecting-call.test-fixture.ts';
import { scratchDir, } from '@monochromatic-dev/translation-repair-test-fixture/ts/scratch-dir.test-fixture.ts';
import {
  loadPictures,
  MINIMUM_PRODUCED_READINGS,
  runReaderMeasure,
} from '../../dist/final/node/index.mjs';

/**
 A transcription of a notice about a lost cat.
 */
const NOTICE = 'Lost tabby cat called Mittens, last seen by the old well. Please call 555 0134.';

/**
 What a reader that agrees with nobody says.
 */
const STRANGER = 'Zyx wvu qj kk zz yy xx, zzz yyy xxx www vvv uuu.';

/**
 Client answering every ask with one reply.

 @param reply - text every ask gets

 @returns Client

 @example
 ```ts
 const client = answering({ reply: NOTICE, },);
 ```
 */
function answering({ reply, }: { readonly reply: string; },): ModelCaller {
  return {
    chatText: async () => {
      await Promise.resolve();
      return { text: reply, };
    },
    chatJson: async () => {
      throw new Error('chatJson unused',);
    },
  };
}

/**
 Writes a trusted record and as many pictures as the minimum verdict needs.

 @param root - throwaway directory

 @returns Paths of the runs directory and the pictures directory

 @example
 ```ts
 const dirs = await seeded({ root: scratch.path, },);
 ```
 */
async function seeded({ root, }: { readonly root: string; },): Promise<{ readonly runs: string; readonly people: string; }> {
  const runs = join(root, 'runs', 'Tabby_01',);
  const people = join(root, 'people', 'Mittens', 'photos',);
  await mkdir(runs, { recursive: true, },);
  await mkdir(people, { recursive: true, },);
  await writeFile(join(runs, 'picture.aaa.json',), JSON.stringify({
    cacheKey: 'stand-in-key',
    record: {
      kind: 'corroborated',
      overlap: 0.9,
      readings: [
        {
          modelId: 'seated-one',
          text: NOTICE,
        },
        {
          modelId: 'seated-two',
          text: NOTICE,
        },
      ],
    },
  },),);
  await Promise.all(Array.from(
    { length: MINIMUM_PRODUCED_READINGS, },
    async function writePicture(_unused, index,): Promise<void> {
      await writeFile(join(people, `notice${String(index,)}.webp`,), 'stand-in bytes',);
    },
  ),);

  return {
    runs: join(root, 'runs',),
    people: join(root, 'people',),
  };
}

/**
 Runs the command and returns the lines it printed.

 @param root - throwaway directory

 @param reply - text the candidate answers

 @returns Lines printed

 @example
 ```ts
 const lines = await printed({ root: scratch.path, reply: NOTICE, },);
 ```
 */
async function printed({ root, reply, }: { readonly root: string; readonly reply: string; },): Promise<readonly string[]> {
  const { runs, people, } = await seeded({ root, },);
  /**
   Lines the command printed.
   */
  const lines: string[] = [];
  await runReaderMeasure({
    ask: {
      modelId: 'gemma-4-26b-a4b-it',
      trustedDirs: [runs,],
      picturesDir: people,
      sample: 9,
      apiKey: 'whisker-key-7421',
    },
    client: answering({ reply, },),
    readOcr: async () => {
      await Promise.resolve();
      return {
        kind: 'read' as const,
        text: NOTICE,
      };
    },
    signal: AbortSignal.timeout(HANG_STOP_MS,),
    perCallTimeoutMs: HANG_STOP_MS,
    print: function keep(line: string,): void {
      lines.push(line,);
    },
  },);
  return lines;
}

await describe({
  name: runReaderMeasure.name,
  concurrency: 1,
  children: [
    it({
      name: 'PASSES A CANDIDATE THAT ANSWERS AS THE SEATED READERS DO and names the edit that follows',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'whiskers-reader-measure-', },);
        const text = (await printed({ root: scratch.path, reply: NOTICE, },)).join('\n',);
        expect(text,).toContain('both clauses met',);
        expect(text,).toContain('openrouter-pictures-unmeasured',);
        expect(text,).toContain('notice0.webp',);
      },
    },),

    it({
      name: 'FAILS A CANDIDATE THAT AGREES WITH NOBODY, on both clauses, and keeps the hold',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'whiskers-reader-measure-', },);
        const text = (await printed({ root: scratch.path, reply: STRANGER, },)).join('\n',);
        expect(text,).toContain('first clause failed',);
        expect(text,).toContain('second clause failed',);
        expect(text,).toContain('keep the hold',);
      },
    },),

    it({
      name: 'REPORTS A CANDIDATE THAT ANSWERS NOTHING AS NOT MEASURED, with the reason on each picture',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'whiskers-reader-measure-', },);
        const text = (await printed({ root: scratch.path, reply: '', },)).join('\n',);
        expect(text,).toContain('nothing (empty-reply)',);
        expect(text,).toContain('not measured',);
      },
    },),

    it({
      name: 'REFUSES BY NAME WHEN NO STORED READING OR NO PICTURE IS FOUND',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'whiskers-reader-measure-', },);
        const refusal = await rejectionOf(async function measureEmpty(): Promise<void> {
          await runReaderMeasure({
            ask: {
              modelId: 'gemma-4-26b-a4b-it',
              trustedDirs: [scratch.path,],
              picturesDir: scratch.path,
              sample: 9,
              apiKey: 'whisker-key-7421',
            },
            client: answering({ reply: NOTICE, },),
            readOcr: async () => {
              await Promise.resolve();
              return {
                kind: 'no-text' as const,
                characters: 0,
              };
            },
            signal: AbortSignal.timeout(HANG_STOP_MS,),
            perCallTimeoutMs: HANG_STOP_MS,
            print: () => undefined,
          },);
        },);
        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain('no stored picture reading',);
      },
    },),
  ],
},);

await describe({
  name: loadPictures.name,
  children: [
    it({
      name: 'READS THE PICTURE FILES UNDER A DIRECTORY AT ANY DEPTH, in path order, named by their path, and '
        + 'skips hidden files and other kinds',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'whiskers-reader-pictures-', },);
        await mkdir(join(scratch.path, 'b', 'photos',), { recursive: true, },);
        await mkdir(join(scratch.path, 'a',), { recursive: true, },);
        await writeFile(join(scratch.path, 'b', 'photos', 'two.WEBP',), 'two',);
        await writeFile(join(scratch.path, 'a', 'one.png',), 'one',);
        await writeFile(join(scratch.path, 'a', '.hidden.png',), 'hidden',);
        await writeFile(join(scratch.path, 'a', 'notes.md',), 'notes',);

        const pictures = await loadPictures({ dir: scratch.path, },);
        expect(pictures.map(function nameOf(picture,): string {
          return picture.assetName;
        },),).toEqual([join('a', 'one.png',), join('b', 'photos', 'two.WEBP',),],);
        expect(Buffer.from(pictures[0]?.bytes ?? new Uint8Array(),).toString(),).toBe('one',);
      },
    },),
  ],
},);
