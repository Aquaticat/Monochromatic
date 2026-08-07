/**
 * Tests for the disk-backed slice cache that makes a long entry resumable.
 *
 * None of these three had a test. Their failure is expensive but silent: if
 * `persist` and the resume loader ever disagree about how a key becomes a file
 * name, resume simply never hits, every run recomputes every slice from
 * scratch, and the only symptom is that a pass costs hours more than it should.
 * Nothing errors. So the round trip gets asserted directly rather than each
 * half separately.
 *
 * The stale-schema case matters for the same reason the module comment warns
 * about it: the cache stores repair OUTCOMES, so a pipeline change invalidates
 * them. A file missing a field the current outcome carries must be treated as
 * absent and recomputed, never resumed, or a run would silently mix outputs
 * from two versions of the pipeline.
 *
 * Fixtures are cat-themed invention written into throwaway directories.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  discardSliceCache,
  listResumableEntries,
  openSliceCache,
} from '../../dist/final/node/index.mjs';

/**
 * Throwaway directory removed on scope exit.
 *
 * @returns Disposable directory handle
 *
 * @example
 * ```ts
 * await using scratch = await scratchDir();
 * ```
 */
async function scratchDir(): Promise<{
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}> {
  /**
   * Fresh directory under the platform temp root.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'whiskers-slice-cache-',
  ),);
  return {
    path,
    [Symbol.asyncDispose]: async function removeScratch() {
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

/**
 * A complete outcome, carrying every field the loader checks before trusting a
 * cache file.
 *
 * @param chunkIndex - slice position this outcome belongs to
 *
 * @returns Outcome shaped as the pipeline writes it
 *
 * @example
 * ```ts
 * const outcome = catOutcome({ chunkIndex: 0, },);
 * ```
 */
function catOutcome({ chunkIndex, }: { readonly chunkIndex: number; },) {
  return {
    chunkIndex,
    repairedText: 'The cat sleeps on the windowsill.',
    changed: true,
    issues: [],
    resolvedIssueIds: [],
    candidateResolvedIssueIds: [],
    repairRegions: [],
    accuracyPatchSelected: true,
    refined: false,
    nonTranslationVotes: 0,
    nonTranslationContradicted: false,
    nonTranslationStanding: false,
    heardCritics: 6,
    findings: [],
  };
}

await describe({
  name: openSliceCache.name,
  children: [
    it({
      name: 'ROUND-TRIPS a persisted slice, which is the property the whole '
        + 'cache rests on: if persist and the loader disagreed about how a key '
        + 'becomes a file name, resume would never hit, every run would '
        + 'recompute every slice, and nothing would error',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry cache directory.
         */
        const dir = join(
          scratch.path,
          'Mittens',
        );

        /**
         * Cache opened on a directory that does not exist yet.
         */
        const first = await openSliceCache({ dir, },);

        expect(first.resumed.size,).toBe(0,);
        await first.persist(
          'slice-hash-aaa',
          JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        );

        /**
         * Cache reopened, which is what a resumed run does.
         */
        const second = await openSliceCache({ dir, },);

        expect(second.resumed.size,).toBe(1,);
        expect(second.resumed
          .get('slice-hash-aaa',)
          ?.repairedText,).toBe('The cat sleeps on the windowsill.',);
      },
    },),

    it({
      name: 'creates the entry directory when it is absent, so a first run '
        + 'needs no setup and resumes from nothing',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Cache over a directory nested two levels below anything existing.
         */
        const cache = await openSliceCache({
          dir: join(
            scratch.path,
            'nested',
            'Mittens',
          ),
        },);

        expect(cache.resumed.size,).toBe(0,);
      },
    },),

    it({
      name: 'TREATS A STALE-SCHEMA FILE AS ABSENT rather than resuming it. The '
        + 'cache stores repair outcomes, so a pipeline change invalidates them, '
        + 'and resuming a file missing a field the current outcome carries '
        + 'would silently mix outputs from two versions of the pipeline into '
        + 'one document',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry cache directory holding one outdated file.
         */
        const dir = join(
          scratch.path,
          'Mittens',
        );
        await mkdir(
          dir,
          { recursive: true, },
        );

        /**
         * Outcome from an older pipeline, missing the refinement fields.
         */
        const stale = {
          chunkIndex: 0,
          repairedText: 'The cat sleeps.',
          changed: true,
          issues: [],
          resolvedIssueIds: [],
        };
        await writeFile(
          join(
            dir,
            'slice-hash-old.json',
          ),
          JSON.stringify(stale,),
          'utf8',
        );

        expect((await openSliceCache({ dir, },)).resumed.size,).toBe(0,);
      },
    },),

    it({
      name: 'treats a half-written file as absent, since a run killed at the '
        + 'hard cap can leave one, and recomputing that slice is correct while '
        + 'aborting the resume is not',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry cache directory holding one truncated file.
         */
        const dir = join(
          scratch.path,
          'Mittens',
        );
        await mkdir(
          dir,
          { recursive: true, },
        );
        await writeFile(
          join(
            dir,
            'slice-hash-cut.json',
          ),
          '{"chunkIndex": 0, "repairedText": "The cat sle',
          'utf8',
        );

        expect((await openSliceCache({ dir, },)).resumed.size,).toBe(0,);
      },
    },),

    it({
      name: 'ignores files that are not slice outcomes at all, so a stray log '
        + 'or note in the directory cannot become a resumed slice',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry cache directory holding one real slice and one stray file.
         */
        const dir = join(
          scratch.path,
          'Mittens',
        );
        const cache = await openSliceCache({ dir, },);
        await cache.persist(
          'slice-hash-aaa',
          JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        );
        await writeFile(
          join(
            dir,
            'notes.txt',
          ),
          'the cat naps here',
          'utf8',
        );

        expect((await openSliceCache({ dir, },)).resumed.size,).toBe(1,);
      },
    },),
  ],
},);

await describe({
  name: listResumableEntries.name,
  children: [
    it({
      name: 'returns nothing for an absent cache root, since a first pass has '
        + 'no in-flight documents and that is not a fault',
      fn: async () => {
        await using scratch = await scratchDir();

        expect(
          (await listResumableEntries({
            dir: join(
              scratch.path,
              'never-created',
            ),
          },)).size,
        ).toBe(0,);
      },
    },),

    it({
      name: 'reports an entry carrying at least one finished slice, which is '
        + 'what lets a pass finish an in-flight document before starting fresh '
        + 'ones and spending its budget on a wider front',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Cache for an entry that finished one slice.
         */
        const cache = await openSliceCache({
          dir: join(
            scratch.path,
            'Mittens',
          ),
        },);
        await cache.persist(
          'slice-hash-aaa',
          JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        );

        expect([...await listResumableEntries({ dir: scratch.path, },),],).toStrictEqual(
          ['Mittens',],
        );
      },
    },),

    it({
      name: 'EXCLUDES an entry whose directory exists but holds no slice, '
        + 'because a run that aborted before finishing anything has no progress '
        + 'to resume and would otherwise be preferred forever over entries that '
        + 'could settle',
      fn: async () => {
        await using scratch = await scratchDir();

        await mkdir(
          join(
            scratch.path,
            'Marmalade',
          ),
          { recursive: true, },
        );

        expect((await listResumableEntries({ dir: scratch.path, },)).size,).toBe(0,);
      },
    },),

    it({
      name: 'tolerates a plain FILE sitting under the cache root rather than '
        + 'throwing, since that child simply carries no resumable slices',
      fn: async () => {
        await using scratch = await scratchDir();

        await writeFile(
          join(
            scratch.path,
            'stray.txt',
          ),
          'not an entry directory',
          'utf8',
        );

        expect((await listResumableEntries({ dir: scratch.path, },)).size,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: discardSliceCache.name,
  children: [
    it({
      name: 'removes a settled entry\'s cache so the directory stays bounded '
        + 'to documents still in flight, and the entry stops being reported as '
        + 'resumable',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry cache directory to be discarded.
         */
        const dir = join(
          scratch.path,
          'Mittens',
        );

        /**
         * Cache holding one finished slice.
         */
        const cache = await openSliceCache({ dir, },);
        await cache.persist(
          'slice-hash-aaa',
          JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        );

        expect((await listResumableEntries({ dir: scratch.path, },)).size,).toBe(1,);

        await discardSliceCache({ dir, },);

        expect((await listResumableEntries({ dir: scratch.path, },)).size,).toBe(0,);
        expect((await openSliceCache({ dir, },)).resumed.size,).toBe(0,);
      },
    },),

    it({
      name: 'succeeds on a cache that was never created, so a settled entry '
        + 'that resumed nothing does not fail its own cleanup',
      fn: async () => {
        await using scratch = await scratchDir();

        await discardSliceCache({
          dir: join(
            scratch.path,
            'never-created',
          ),
        },);

        expect((await listResumableEntries({ dir: scratch.path, },)).size,).toBe(0,);
      },
    },),
  ],
},);
