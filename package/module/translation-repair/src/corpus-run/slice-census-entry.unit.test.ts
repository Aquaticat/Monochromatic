/**
 * Tests for measuring one corpus entry after slicing.
 *
 * THE CENSUS IS THE INSTRUMENT EVERY SIZE CLAIM RESTS ON, and its most valuable
 * column is the one that used to read zero for the wrong reason.
 * `unpairedSourceSections` counts sections the aligner REFUSED to pair, and
 * those are absent from `alignment.pairs` entirely rather than present with an
 * empty side. An earlier counter walked the pairs, so it could only ever report
 * zero, and zero read as "nothing went unpaired" instead of "this cannot see
 * them". The case below gives the census a page whose sections genuinely do not
 * pair and requires a number greater than zero.
 *
 * THE PIN IS INJECTED, which is why any of this can be tested. `censusEntry`
 * read `RUN_CORPUS_PIN` directly, so exercising it meant having the unlicensed
 * corpus clone on disk and a suite that passed on one machine only. It now takes
 * the pin the way `readAuditArguments` takes `argv`, and the cases below point
 * it at a throwaway git repository built in a temp directory.
 *
 * FIXTURE CONTENT IS CAT-THEMED INVENTION mirroring corpus structure only:
 * Simplified Chinese against English, one entry, committed once.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  devNull,
  tmpdir,
} from 'node:os';
import { join, } from 'node:path';

import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts/resolve-git.ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  censusEntry,
  CorpusReadError,
} from '../../dist/final/node/index.mjs';

//region Slice census entry tests

/**
 * Real git binary for fixture setup and pinned reads.
 *
 * The repo PATH exposes a policy shim whose staging guards reject the staging
 * patterns a fixture needs.
 */
const REAL_GIT = await resolveGit();

/**
 * Entry the throwaway clone carries.
 */
const ENTRY_ID = 'whiskers';

/**
 * Original page: three sections, in the Simplified Chinese the corpus uses.
 */
const SOURCE_PAGE = [
  '---',
  'name: 小猫-whiskers',
  '---',
  '',
  '## 简介',
  '',
  '猫猫喜欢晒太阳。',
  '',
  '## 日常',
  '',
  '它每天在窗台上睡午觉，醒来就去找吃的。',
  '',
  '## 朋友们的话',
  '',
  '大家都说它是一只很温柔的猫。',
  '',
].join('\n',);

/**
 * Translation carrying every section of the original.
 */
const FULL_TARGET_PAGE = [
  '---',
  'name: Whiskers',
  '---',
  '',
  '## Introduction',
  '',
  'Whiskers likes to sun herself.',
  '',
  '## Daily life',
  '',
  'She naps on the windowsill every day, and goes looking for food when she wakes.',
  '',
  '## What her friends say',
  '',
  'Everyone says she is a very gentle cat.',
  '',
].join('\n',);

/**
 * Original page with one section of three blocks, so a block pairing that
 * declines the middle one changes what the slice carries.
 */
const BLOCKY_SOURCE_PAGE = [
  '---',
  'name: 小猫-whiskers',
  '---',
  '',
  '## 日常',
  '',
  '猫猫喜欢晒太阳。',
  '',
  '它每天在窗台上睡午觉。',
  '',
  '大家都说它是一只很温柔的猫。',
  '',
].join('\n',);

/**
 * Translation of the same three blocks.
 */
const BLOCKY_TARGET_PAGE = [
  '---',
  'name: Whiskers',
  '---',
  '',
  '## Daily life',
  '',
  'Whiskers likes to sun herself.',
  '',
  'She naps on the windowsill every day.',
  '',
  'Everyone says she is a very gentle cat.',
  '',
].join('\n',);

/**
 * Translation that stops after the first section, so two go unpaired.
 */
const SHORT_TARGET_PAGE = [
  '---',
  'name: Whiskers',
  '---',
  '',
  '## Introduction',
  '',
  'Whiskers likes to sun herself.',
  '',
].join('\n',);

/**
 * Runs one git command inside the throwaway clone.
 *
 * Hermetic against user and system git configuration, so a contributor's own
 * settings cannot change what the fixture commits.
 *
 * @param cloneDir - throwaway repository directory
 *
 * @param args - git argument vector
 *
 * @returns Captured stdout
 *
 * @example
 * ```ts
 * const sha = await fixtureGit({ cloneDir, args: ['rev-parse', 'HEAD',], },);
 * ```
 */
async function fixtureGit(
  {
    cloneDir,
    args,
  }: {
    readonly cloneDir: string;
    readonly args: readonly string[];
  },
): Promise<string> {
  /**
   * Subprocess result; only stdout is consumed.
   */
  const { stdout, } = await spawn(
    REAL_GIT,
    [
      '-C',
      cloneDir,
      ...args,
    ],
    {
      env: {
        GIT_CONFIG_GLOBAL: devNull,
        GIT_CONFIG_SYSTEM: devNull,
      },
    },
  );
  return stdout;
}

/**
 * Builds a throwaway corpus-shaped repository holding one entry.
 *
 * @param targetPage - translation to commit beside the original, which decides
 * how many sections pair
 *
 * @returns Pin naming the clone and its one commit, and an async disposer
 *
 * @example
 * ```ts
 * await using corpus = await throwawayCorpus({ targetPage: FULL_TARGET_PAGE, },);
 * ```
 */
async function throwawayCorpus(
  {
    targetPage,
    sourcePage = SOURCE_PAGE,
  }: {
    readonly targetPage: string;
    readonly sourcePage?: string;
  },
): Promise<
  AsyncDisposable & {
    readonly pin: {
      readonly cloneDir: string;
      readonly commitSha: string;
    };
  }
> {
  /**
   * Fresh temp directory holding the throwaway repository.
   */
  const cloneDir = await mkdtemp(join(
    tmpdir(),
    'whiskers-slice-census-',
  ),);

  await spawn(
    REAL_GIT,
    [
      'init',
      cloneDir,
    ],
    {
      env: {
        GIT_CONFIG_GLOBAL: devNull,
        GIT_CONFIG_SYSTEM: devNull,
      },
    },
  );
  await mkdir(
    join(
      cloneDir,
      'people',
      ENTRY_ID,
    ),
    { recursive: true, },
  );
  await writeFile(
    join(
      cloneDir,
      'people',
      ENTRY_ID,
      'page.md',
    ),
    sourcePage,
    'utf8',
  );
  await writeFile(
    join(
      cloneDir,
      'people',
      ENTRY_ID,
      'page.en.md',
    ),
    targetPage,
    'utf8',
  );
  await fixtureGit({
    cloneDir,
    args: [
      'add',
      `people/${ENTRY_ID}/page.md`,
      `people/${ENTRY_ID}/page.en.md`,
    ],
  },);
  await fixtureGit({
    cloneDir,
    args: [
      '-c',
      'user.name=cat',
      '-c',
      'user.email=cat@example.org',
      'commit',
      '--message',
      'add whiskers',
      '--no-gpg-sign',
    ],
  },);

  /**
   * Commit every read below pins to.
   */
  const commitSha = (await fixtureGit({
    cloneDir,
    args: [
      'rev-parse',
      'HEAD',
    ],
  },))
    .trim();

  return {
    pin: {
      cloneDir,
      commitSha,
    },
    [Symbol.asyncDispose]: async function removeClone() {
      await rm(
        cloneDir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

await describe({
  name: censusEntry.name,
  children: [
    it({
      name: 'MEASURES an entry whose translation carries every section',
      fn: async () => {
        await using corpus = await throwawayCorpus({ targetPage: FULL_TARGET_PAGE, },);

        /**
         * What the census made of that entry.
         */
        const row = await censusEntry({
          entryId: ENTRY_ID,
          pin: corpus.pin,
        },);

        expect(row.entryId,).toBe(ENTRY_ID,);
        expect(row.sliceSourceChars.length,).toBeGreaterThan(0,);
        expect(row.sliceSourceChars.length,).toBe(row.sliceTargetChars.length,);
      },
    },),
    it({
      name: 'COUNTS characters, not slices, so no slice is measured as empty',
      fn: async () => {
        await using corpus = await throwawayCorpus({ targetPage: FULL_TARGET_PAGE, },);

        /**
         * What the census made of that entry.
         */
        const row = await censusEntry({
          entryId: ENTRY_ID,
          pin: corpus.pin,
        },);

        for (const chars of row.sliceSourceChars) {
          expect(chars,).toBeGreaterThan(0,);
        }
        for (const chars of row.sliceTargetChars) {
          expect(chars,).toBeGreaterThan(0,);
        }
      },
    },),
    it({
      name: 'SEES the sections the aligner refused, which a walk over pairs cannot',
      fn: async () => {
        // The defect this column exists after: a counter that walked
        // `alignment.pairs` could only report zero, because a refused section is
        // absent from the pairs entirely. Zero then read as "nothing went
        // unpaired" rather than as "this cannot see them".
        await using corpus = await throwawayCorpus({ targetPage: SHORT_TARGET_PAGE, },);

        /**
         * What the census made of a half-translated entry.
         */
        const row = await censusEntry({
          entryId: ENTRY_ID,
          pin: corpus.pin,
        },);

        expect(row.unpairedSourceSections,).toBeGreaterThan(0,);
      },
    },),
    it({
      name: 'REPORTS no unpaired sections when the translation carries them all',
      fn: async () => {
        // The positive control for the case above: a column that always
        // reported a positive number would pass that one and fail this.
        await using corpus = await throwawayCorpus({ targetPage: FULL_TARGET_PAGE, },);

        expect((await censusEntry({
          entryId: ENTRY_ID,
          pin: corpus.pin,
        },)).unpairedSourceSections,).toBe(0,);
      },
    },),
    it({
      name:
        'CARVES the sections through a supplied recipe and labels the row settled, since the slice sizes '
        + 'then describe the slicing the lanes judged rather than the deterministic baseline',
      fn: async () => {
        await using corpus = await throwawayCorpus({ targetPage: FULL_TARGET_PAGE, },);

        /**
         * Deterministic carve, which pairs the three equal-shaped sections by
         * index and leaves nothing unpaired.
         */
        const baseline = await censusEntry({
          entryId: ENTRY_ID,
          pin: corpus.pin,
        },);
        expect(baseline.carve,).toBe('deterministic',);
        expect(baseline.unpairedSourceSections,).toBe(0,);

        /**
         * Carve through a recipe whose section round paired the outer two
         * sections and left the middle one unclaimed.
         */
        const settled = await censusEntry({
          entryId: ENTRY_ID,
          pin: corpus.pin,
          recipe: {
            sectionPairing: [
              {
                source: 0,
                target: 0,
              },
              {
                source: 2,
                target: 2,
              },
            ],
            unrecorded: [],
          },
        },);
        expect(settled.carve,).toBe('settled-complete',);
        // The recipe has to move the accounting, or this passes for the wrong
        // reason.
        expect(settled.unpairedSourceSections,).toBe(1,);
        expect(settled.unpairedTargetSections,).toBe(1,);
      },
    },),
    it({
      name:
        'CARVES the blocks through a supplied recipe, so a block the roster declined leaves the slice, '
        + 'and labels a recipe with a defaulted half as partial',
      fn: async () => {
        await using corpus = await throwawayCorpus({
          sourcePage: BLOCKY_SOURCE_PAGE,
          targetPage: BLOCKY_TARGET_PAGE,
        },);

        /**
         * Deterministic carve: one slice carrying all three blocks.
         */
        const baseline = await censusEntry({
          entryId: ENTRY_ID,
          pin: corpus.pin,
        },);

        /**
         * Carve through a recipe that declines the middle block, recorded
         * without a section decider.
         */
        const settled = await censusEntry({
          entryId: ENTRY_ID,
          pin: corpus.pin,
          recipe: {
            blockPairings: new Map([[
              0,
              [
                {
                  source: 0,
                  target: 0,
                },
                {
                  source: 2,
                  target: 2,
                },
              ],
            ],],),
            unrecorded: ['sectionPairing',],
          },
        },);
        expect(settled.carve,).toBe('settled-partial',);

        /**
         * Translation characters the two carves put into slices.
         */
        const [baselineChars, settledChars,] = [
          baseline,
          settled,
        ].map(function totalTarget(row,): number {
          return row.sliceTargetChars
            .reduce(function add(
              sum,
              chars,
            ): number {
              return sum + chars;
            }, 0,);
        },);
        // The declined block has to leave the slice, or the recipe reached
        // subdivision as nothing.
        expect(settledChars,).toBeLessThan(baselineChars ?? 0,);
      },
    },),
    it({
      name: 'REFUSES an entry the clone does not carry, rather than measuring nothing',
      fn: async () => {
        await using corpus = await throwawayCorpus({ targetPage: FULL_TARGET_PAGE, },);

        await expect(censusEntry({
          entryId: 'pepperbox',
          pin: corpus.pin,
        },),).rejects.toThrow(CorpusReadError,);
      },
    },),
  ],
},);

//endregion Slice census entry tests
