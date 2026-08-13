/**
 * Tests for the parser that reads attribution out of settled artifacts.
 *
 * These exist because the report's own tests hand `chunkCritics` in by hand, so
 * they exercise the FOLD and never the WIRING. The eligible-versus-ineligible
 * decision the whole report rests on is not made there at all: it is made here,
 * by `toEntry` OMITTING the key for an artifact that carries no attribution. A
 * reader could emit an empty array instead, every entry would become eligible,
 * and every fold test would still pass.
 *
 * That is the third instance this session of a fold with tests and a wiring
 * without, so this file reads real files off disk rather than accepting parsed
 * objects.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { gatherAttributionEntries, } from '../../dist/final/node/index.mjs';

/**
 * Critic used throughout.
 */
const TABBY = 'hf:openai/gpt-oss-120b';

/**
 * Writes artifacts into a fresh throwaway directory that removes itself.
 *
 * Disposable rather than cleaned up by hand, so a failing expectation cannot
 * leave a directory behind. Never a real runs directory: this writes files.
 *
 * @param artifacts - file name to artifact body
 *
 * @returns Directory holding them, disposable
 *
 * @example
 * ```ts
 * await using scratch = await writeArtifacts({ artifacts: { 'a.json': {}, }, },);
 * ```
 */
async function writeArtifacts(
  {
    artifacts,
  }: {
    readonly artifacts: Record<string, unknown>;
  },
): Promise<{ readonly dir: string; } & AsyncDisposable> {
  /**
   * Throwaway directory, never a real runs directory.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'attribution-read-',
  ),);

  await Promise.all(Object
    .entries(artifacts,)
    .map(async function writeOne([name, body,],) {
    await writeFile(
      join(
        dir,
        name,
      ),
      JSON.stringify(body,),
      'utf8',
    );
  },),);

  return {
    dir,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        dir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

await describe({
  name: gatherAttributionEntries.name,
  children: [
    it({
      name: 'distinguishes an artifact that RECORDS attribution from one that '
        + 'predates it, which is the decision the whole report rests on and the '
        + 'one its own tests cannot reach, since they supply chunkCritics by '
        + 'hand and so make every entry eligible by construction',
      fn: async () => {
        /**
         * One post-attribution artifact beside one written before it existed.
         */
        await using scratch = await writeArtifacts({
          artifacts: {
            'whiskers.json': {
              id: 'Whiskers',
              chunkCritics: [
                {
                  chunkIndex: 0,
                  heardCriticIds: [TABBY,],
                  claimAttributions: [],
                },
              ],
              issues: [],
            },
            'mittens.json': {
              id: 'Mittens',
              issues: [],
            },
          },
        },);

        /**
         * Entries as the CLI would gather them.
         */
        const entries = await gatherAttributionEntries({ artifactsDir: scratch.dir, },);

        /**
         * Entry written after attribution landed.
         */
        const whiskers = entries
          .find(function isWhiskers(entry,) {
          return entry.id === 'Whiskers';
        },);

        /**
         * Entry written before it landed.
         */
        const mittens = entries
          .find(function isMittens(entry,) {
          return entry.id === 'Mittens';
        },);

        expect(whiskers?.chunkCritics,).toHaveLength(1,);
        // Undefined, NOT an empty array. An empty array would read as an entry
        // whose critics raised nothing, which is the exact conflation the
        // eligible population exists to prevent.
        expect(mittens?.chunkCritics,).toBeUndefined();
      },
    },),

    it({
      name: 'DROPS a chunk record whose index does not parse rather than '
        + 'calling it chunk zero, because the chunk count is the denominator '
        + 'every rate divides by and inventing one inflates all of them',
      fn: async () => {
        /**
         * Artifact carrying one usable chunk record and one malformed one.
         */
        await using scratch = await writeArtifacts({
          artifacts: {
            'whiskers.json': {
              id: 'Whiskers',
              chunkCritics: [
                {
                  chunkIndex: 0,
                  heardCriticIds: [TABBY,],
                  claimAttributions: [],
                },
                {
                  chunkIndex: 'one',
                  heardCriticIds: [TABBY,],
                  claimAttributions: [],
                },
              ],
              issues: [],
            },
          },
        },);

        /**
         * Entries as the CLI would gather them.
         */
        const entries = await gatherAttributionEntries({ artifactsDir: scratch.dir, },);

        expect(entries[0]?.chunkCritics,).toHaveLength(1,);
      },
    },),
  ],
},);
