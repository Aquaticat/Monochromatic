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
  openTranslateSliceCache,
  TRANSLATE_SLICE_CACHE_VERSION,
} from '../../dist/final/node/index.mjs';

/**
 * Built pipeline the fixtures are filled under.
 *
 * Every case that resumes a cache has to agree with the marker, since a cache
 * filled by another pipeline is discarded rather than resumed.
 */
const TEST_GENERATION = `sha256-tree-v1:${'a'.repeat(64,)}`;

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
    rounds: [],
    droppedDeclaredNames: [],
    nonTranslationVotes: 0,
    nonTranslationContradicted: false,
    nonTranslationStanding: false,
    heardCritics: 6,
    heardCriticIds: ['hf:openai/gpt-oss-120b', 'hf:zai-org/GLM-5.2',],
    claimAttributions: [],
    findings: [],
  };
}

/**
 * A complete translate record, carrying every field its loader checks.
 *
 * @param chunkIndex - slice position this record belongs to
 *
 * @returns Record shaped as the translate driver writes it
 *
 * @example
 * ```ts
 * const record = catTranslateRecord({ chunkIndex: 0, },);
 * ```
 */
function catTranslateRecord({ chunkIndex, }: { readonly chunkIndex: number; },) {
  return {
    kind: 'translate-slice',
    schemaVersion: TRANSLATE_SLICE_CACHE_VERSION,
    chunkIndex,
    stageResult: {
      text: 'The cat naps on the windowsill.',
      origin: 'fresh',
      decision: 'judged',
      findings: [],
      slate: [],
      ballots: [],
      perCandidate: [],
    },
    outputText: 'The cat naps on the windowsill.',
    changed: true,
    disposition: 'stage-result',
    alignment: {
      kind: 'within-limit',
      sourceCodePoints: 9,
      incumbentCodePoints: 31,
      minProtectedIncumbent: 128,
      maxRatio: 16,
    },
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
        const first = await openSliceCache({ dir, generation: TEST_GENERATION, },);

        expect(first.resumed.size,).toBe(0,);
        await first.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        },);

        /**
         * Cache reopened, which is what a resumed run does.
         */
        const second = await openSliceCache({ dir, generation: TEST_GENERATION, },);

        expect(second.resumed.size,).toBe(1,);
        expect(second.resumed
          .get('slice-hash-aaa',)
          ?.repairedText,).toBe('The cat sleeps on the windowsill.',);
      },
    },),

    it({
      name: 'REFUSES a payload sitting under the wrong name, which is the check that replaced the '
        + 'slice-index one. A file name is what the loader derives a key from, so a record stored '
        + 'under some other key is otherwise resumed as though it answered this one, and the driver '
        + 'splices text into a slice it was never computed for',
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
         * Cache that stamps this pipeline's marker on a fresh directory.
         */
        const opened = await openSliceCache({ dir, generation: TEST_GENERATION, },);
        await opened.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        },);

        /**
         * That very file, rewritten so its envelope answers a different key
         * while its name still claims this one.
         */
        const foreign = JSON.stringify({
          cacheKey: 'slice-hash-bbb',
          record: catOutcome({ chunkIndex: 0, },),
        },);
        await writeFile(
          join(
            dir,
            'slice-hash-aaa.json',
          ),
          `${foreign}\n`,
        );

        /**
         * Cache reopened, which is what a resumed run does.
         */
        const reopened = await openSliceCache({ dir, generation: TEST_GENERATION, },);
        expect(reopened.resumed
          .size,).toBe(0,);
      },
    },),

    it({
      name: 'DISCARDS slices filled by another pipeline instead of resuming '
        + 'them. This is the one generation defect no reader can catch: the '
        + 'settled artifact records a single digest, so an entry built half '
        + 'from cached slices and half from current code looks like ordinary '
        + 'work to every filter downstream while being internally mixed',
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
         * Cache filled by the pipeline that is about to be replaced.
         */
        const before = await openSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);

        await before.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        },);

        /**
         * Same directory reopened by a different build, which is what a resume
         * after any behaviour change looks like.
         */
        const after = await openSliceCache({
          dir,
          generation: `sha256-tree-v1:${'b'.repeat(64,)}`,
        },);

        expect(after.resumed.size,).toBe(0,);

        /**
         * Reopening under the SAME new pipeline, which must now resume nothing
         * either: the discarded slices are gone rather than merely skipped.
         */
        const again = await openSliceCache({
          dir,
          generation: `sha256-tree-v1:${'b'.repeat(64,)}`,
        },);

        expect(again.resumed.size,).toBe(0,);
      },
    },),

    it({
      name: 'DISCARDS an UNSTAMPED cache for the same reason, since a cache '
        + 'that cannot prove which pipeline filled it is exactly the case the '
        + 'stamp exists to remove',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry cache directory, filled by hand without a marker.
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
            'slice-hash-aaa.json',
          ),
          `${JSON.stringify(catOutcome({ chunkIndex: 0, },),)}\n`,
        );

        expect((await openSliceCache({
          dir,
          generation: TEST_GENERATION,
        },)).resumed
          .size,).toBe(0,);
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
          generation: TEST_GENERATION,
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

        expect((await openSliceCache({ dir, generation: TEST_GENERATION, },)).resumed.size,).toBe(0,);
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

        expect((await openSliceCache({ dir, generation: TEST_GENERATION, },)).resumed.size,).toBe(0,);
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
        const cache = await openSliceCache({ dir, generation: TEST_GENERATION, },);
        await cache.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        },);
        await writeFile(
          join(
            dir,
            'notes.txt',
          ),
          'the cat naps here',
          'utf8',
        );

        expect((await openSliceCache({ dir, generation: TEST_GENERATION, },)).resumed.size,).toBe(1,);
      },
    },),
    it({
      name: 'REFUSES an outcome written before the judged rounds were recorded, '
        + 'so a slice settled under the older shape is recomputed rather than '
        + 'resumed with no ballots and no declared-name verdict on it',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry cache directory holding one outcome of the older shape.
         */
        const dir = join(
          scratch.path,
          'Mittens',
        );
        const cache = await openSliceCache({ dir, generation: TEST_GENERATION, },);

        /**
         * Complete outcome with exactly the two fields the newer shape added
         * taken back out, so a refusal here is attributable to them and to
         * nothing else about the record.
         */
        const {
          rounds,
          droppedDeclaredNames,
          ...older
        } = catOutcome({ chunkIndex: 0, },);
        expect(rounds,).toEqual([],);
        expect(droppedDeclaredNames,).toEqual([],);
        await cache.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(older,),
        },);

        expect((await openSliceCache({ dir, generation: TEST_GENERATION, },)).resumed.size,).toBe(0,);
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
          generation: TEST_GENERATION,
        },);
        await cache.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        },);

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
        const cache = await openSliceCache({ dir, generation: TEST_GENERATION, },);
        await cache.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        },);

        expect((await listResumableEntries({ dir: scratch.path, },)).size,).toBe(1,);

        await discardSliceCache({ dir, },);

        expect((await listResumableEntries({ dir: scratch.path, },)).size,).toBe(0,);
        expect((await openSliceCache({ dir, generation: TEST_GENERATION, },)).resumed.size,).toBe(0,);
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

await describe({
  name: openTranslateSliceCache.name,
  children: [
    it({
      name: 'ROUND-TRIPS a translate record, the same property the repair '
        + 'cache rests on: a persist and a loader that disagreed about file '
        + 'names would silently recompute every slice forever',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry directory both lanes share.
         */
        const dir = join(
          scratch.path,
          'whiskers',
        );

        /**
         * Cache this run writes into.
         */
        const first = await openTranslateSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);
        await first.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(catTranslateRecord({ chunkIndex: 0, },),),
        },);

        /**
         * Same cache reopened, as the next attempt does.
         */
        const second = await openTranslateSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);
        expect(second.resumed.get('slice-hash-aaa',)
          ?.chunkIndex,).toBe(0,);
      },
    },),

    it({
      name: 'NEVER resumes a repair outcome as a translation, however the file '
        + 'is named. The two lanes share one directory, and a repair outcome '
        + 'carries neither the lane discriminator nor the schema, so the guard '
        + 'refuses it rather than reading fields that mean something else',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry directory both lanes share.
         */
        const dir = join(
          scratch.path,
          'whiskers',
        );
        await mkdir(
          dir,
          { recursive: true, },
        );
        await writeFile(
          join(
            dir,
            'translate.slice-hash-aaa.json',
          ),
          JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        );
        await writeFile(
          join(
            dir,
            'translate-generation.txt',
          ),
          `${TEST_GENERATION}\n`,
        );

        /**
         * Cache opened over that misfiled outcome.
         */
        const cache = await openTranslateSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);
        expect(cache.resumed.size,).toBe(0,);
      },
    },),

    it({
      name: 'KEEPS THE OTHER LANE\'S SLICES when its own generation moves. One '
        + 'shared marker and a directory-wide delete, which is what this '
        + 'replaced, means a translate change throws away every settled repair '
        + 'slice in the corpus and nothing reports the loss',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry directory both lanes share.
         */
        const dir = join(
          scratch.path,
          'whiskers',
        );

        /**
         * Repair slice settled under the current pipeline.
         */
        const repair = await openSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);
        await repair.persist({
          key: 'slice-hash-aaa',
          serialized: JSON.stringify(catOutcome({ chunkIndex: 0, },),),
        },);

        /**
         * Translate slice settled under the same one.
         */
        const translate = await openTranslateSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);
        await translate.persist({
          key: 'slice-hash-bbb',
          serialized: JSON.stringify(catTranslateRecord({ chunkIndex: 0, },),),
        },);

        // The translate lane's pipeline moves and the repair lane's does not,
        // which is the ordinary shape of a change to one lane.
        const moved = await openTranslateSliceCache({
          dir,
          generation: `sha256-tree-v1:${'b'.repeat(64,)}`,
        },);
        expect(moved.resumed.size,).toBe(0,);

        /**
         * Repair cache reopened after that discard.
         */
        const survived = await openSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);
        expect(survived.resumed.get('slice-hash-aaa',)
          ?.chunkIndex,).toBe(0,);
      },
    },),

    it({
      name: 'does not adopt the other lane\'s files as its own: the repair '
        + 'lane owns unprefixed names and must not read a translate record, '
        + 'which would resume a translation as a repair outcome',
      fn: async () => {
        await using scratch = await scratchDir();

        /**
         * Entry directory both lanes share.
         */
        const dir = join(
          scratch.path,
          'whiskers',
        );

        /**
         * Translate slice settled first.
         */
        const translate = await openTranslateSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);
        await translate.persist({
          key: 'slice-hash-bbb',
          serialized: JSON.stringify(catTranslateRecord({ chunkIndex: 0, },),),
        },);

        /**
         * Repair cache opened over the same directory.
         */
        const repair = await openSliceCache({
          dir,
          generation: TEST_GENERATION,
        },);
        expect(repair.resumed.size,).toBe(0,);
        expect((await listResumableEntries({ dir: scratch.path, },)).size,).toBe(1,);
      },
    },),
  ],
},);
