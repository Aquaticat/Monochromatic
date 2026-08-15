/**
 * Tests for pipeline-generation partitioning of settled artifacts.
 *
 * The failure these exist for is not hypothetical. On 2026-08-13 the
 * accumulation directory held 21 settled entries across three recorded tips,
 * and every one of the three lacked both behaviour fixes that had landed that
 * evening, so the pool of entries settled under the current pipeline was zero
 * while the directory looked full. Six readers globbed that directory and none
 * of them read the `tip` the artifacts already carried.
 *
 * A generation is now the BUILT PIPELINE, recorded as `pipelineDigest`, because
 * the commit answered the question wrongly in both directions: it moves for a
 * documentation commit that changes nothing that runs, and stays put across an
 * uncommitted edit that changes everything.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import spawn from 'nano-spawn';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  censusByGeneration,
  selectEligible,
} from '../../dist/final/node/index.mjs';

/**
 * One built pipeline, as a digest-shaped invention.
 */
const DIGEST_A = 'a'.repeat(64,);

/**
 * A second built pipeline, differing from {@link DIGEST_A} everywhere.
 */
const DIGEST_B = 'b'.repeat(64,);

/**
 * One repo commit, as an object-id-shaped invention.
 */
const TIP_A = '1'.repeat(40,);

/**
 * A second repo commit, for the case where one pipeline carries two of them.
 */
const TIP_B = '2'.repeat(40,);

/**
 * The two commits of this repository ancestry can be asked about safely.
 *
 * Real commits, because `tipContains` asks git and an invented sha is an
 * UNRESOLVABLE commit rather than an excluded one. The root cannot contain
 * HEAD, so requiring HEAD excludes anything settled at the root.
 *
 * @returns Root commit first, HEAD second
 *
 * @example
 * ```ts
 * const [root, head,] = await gitBounds();
 * ```
 */
async function gitBounds(): Promise<readonly [string, string,]> {
  /**
   * First commit of this history, which contains nothing but itself.
   */
  const root = (await spawn(
    '/usr/bin/git',
    [
      '-C',
      import.meta.dirname,
      'rev-list',
      '--max-parents=0',
      'HEAD',
    ],
  )).stdout
    .trim()
    .split('\n',)[0] ?? '';

  /**
   * Current commit, which contains the root.
   */
  const head = (await spawn(
    '/usr/bin/git',
    [
      '-C',
      import.meta.dirname,
      'rev-parse',
      'HEAD',
    ],
  )).stdout
    .trim();

  return [
    root,
    head,
  ];
}

/**
 * Writes a throwaway artifacts directory.
 *
 * Written to a fresh temporary directory every time rather than to the real
 * runs directory, which holds hours of ungraded work.
 *
 * @param entries - one record per artifact; omitting `tip` writes an artifact
 * carrying no provenance at all, and omitting `digest` writes one from before
 * artifacts recorded which build produced them
 *
 * @returns Path of the artifacts directory
 *
 * @example
 * ```ts
 * const dir = await writeArtifacts({ entries: [{ entryId: 'Mittens', tip: TIP_A, digest: DIGEST_A, },], },);
 * ```
 */
async function writeArtifacts(
  { entries, }: {
    readonly entries: readonly Readonly<{
      entryId: string;
      tip?: string;
      digest?: string;
    }>[];
  },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'artifact-generation-',
  ),);

  await Promise.all(
    entries.map(async function writeOne(entry,) {
      /**
       * Artifact body, carrying each identity only when one was given.
       */
      const body = {
        id: entry.entryId,
        status: 'repaired',
        ...('tip' in entry ? { tip: entry.tip, } : {}),
        ...('digest' in entry ? { pipelineDigest: entry.digest, } : {}),
      };

      await writeFile(
        join(
          dir,
          `${entry.entryId}.json`,
        ),
        JSON.stringify(body,),
        'utf8',
      );
    },),
  );

  return dir;
}

await describe({
  name: censusByGeneration.name,
  children: [
    it({
      name: 'partitions settled entries by the BUILD each recorded, largest '
        + 'group first, which is the reading that was impossible before: the '
        + 'field was written into every artifact and read by nothing',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: DIGEST_A,
            },
            {
              entryId: 'Pepper',
              tip: TIP_A,
              digest: DIGEST_A,
            },
            {
              entryId: 'Biscuit',
              tip: TIP_B,
              digest: DIGEST_B,
            },
          ],
        },);

        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.total,).toBe(3,);
        expect(census.groups.length,).toBe(2,);
        expect(census.groups[0]?.digest,).toBe(DIGEST_A,);
        expect(census.groups[0]?.entryIds,).toEqual(['Mittens', 'Pepper',],);
        expect(census.groups[1]?.entryIds,).toEqual(['Biscuit',],);
      },
    },),

    it({
      name: 'pools two DIFFERENT COMMITS as one generation when they ran the '
        + 'same build, which is the case the commit could never get right: a '
        + 'documentation commit moves the tip while every byte that runs stays '
        + 'identical, and splitting those entries refuses a pool that is sound',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: DIGEST_A,
            },
            {
              entryId: 'Pepper',
              tip: TIP_B,
              digest: DIGEST_A,
            },
          ],
        },);

        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.groups.length,).toBe(1,);
        expect(census.tipByEntry.get('Mittens',),).toBe(TIP_A,);
        expect(census.tipByEntry.get('Pepper',),).toBe(TIP_B,);

        const eligible = await selectEligible({ census, },);

        expect(eligible.entryIds,).toEqual(['Mittens', 'Pepper',],);
        expect(eligible.selection.kind,).toBe('single-generation',);
      },
    },),

    it({
      name: 'EXCLUDES an artifact carrying no tip and names it, rather than '
        + 'either pooling it blind or aborting the whole census. This package '
        + 'already decided a corrupt artifact costs its own row and not the run, '
        + 'because a pass killed at its hard cap leaves truncated files; an '
        + 'exclusion that goes unmentioned is the silently smaller denominator '
        + 'this guard exists to prevent, so it is reported instead',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: DIGEST_A,
            },
            { entryId: 'Biscuit', },
          ],
        },);

        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.total,).toBe(1,);
        expect(census.untaggedIds,).toEqual(['Biscuit',],);
        expect(census.malformedIds.length,).toBe(0,);

        const eligible = await selectEligible({ census, },);

        expect(eligible.entryIds,).toEqual(['Mittens',],);
        expect(
          eligible.report
            .some(function names(line: string,) {
              return line.includes('Biscuit',)
                && line.includes('recording no usable pipeline',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'keeps an artifact that records a commit but no BUILD out of every '
        + 'generation, and apart from the unreadable ones. It is a sound result '
        + 'whose pipeline can no longer be named, so deleting it buys nothing '
        + 'and pooling it is the silent mixing this module exists to stop',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: DIGEST_A,
            },
            {
              entryId: 'Biscuit',
              tip: TIP_A,
            },
          ],
        },);

        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.total,).toBe(1,);
        expect(census.preDigestIds,).toEqual(['Biscuit',],);
        expect(census.untaggedIds.length,).toBe(0,);
        expect(census.malformedIds.length,).toBe(0,);

        const eligible = await selectEligible({ census, },);

        expect(eligible.entryIds,).toEqual(['Mittens',],);
        expect(
          eligible.report
            .some(function names(line: string,) {
              return line.includes('Biscuit',)
                && line.includes('before artifacts recorded which build',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'refuses a digest that is PRESENT and unusable, which is not the '
        + 'same as one that is absent: absence means old, while a malformed '
        + 'value means something wrote a field this package owns, and pooling '
        + 'on it would pool on a value no build ever produced',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: 'not-a-digest',
            },
          ],
        },);

        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.total,).toBe(0,);
        expect(census.untaggedIds,).toEqual(['Mittens',],);
        expect(census.preDigestIds.length,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES an artifact that records no id of its own. Presence is '
        + 'required rather than merely agreement: guarding the comparison on '
        + 'the field being there meant an artifact claiming no identity was '
        + 'placed on its file name alone, which is exactly the reading the '
        + 'check exists to refuse, since the pool would then admit it under a '
        + 'name the bytes never claimed',
      fn: async () => {
        const dir = await writeArtifacts({ entries: [], },);
        await writeFile(
          join(
            dir,
            'Mittens.json',
          ),
          JSON.stringify({
            tip: TIP_A,
            pipelineDigest: DIGEST_A,
            status: 'repaired',
          },),
          'utf8',
        );

        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.total,).toBe(0,);
        expect(census.untaggedIds,).toEqual(['Mittens',],);
      },
    },),

    it({
      name: 'refuses a SYMBOLIC tip such as HEAD or a branch name, which is not '
        + 'an identity at all: it resolves against the READER\'s checkout at '
        + 'read time rather than against whatever produced the artifact, so it '
        + 'silently answers a different question, and a branch name answers one '
        + 'whose answer changes',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: 'HEAD',
              digest: DIGEST_A,
            },
            {
              entryId: 'Pepper',
              tip: 'main',
              digest: DIGEST_A,
            },
          ],
        },);

        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.total,).toBe(0,);
        expect(census.untaggedIds,).toEqual(['Mittens', 'Pepper',],);
      },
    },),

    it({
      name: 'names what is PRESENT when nothing could be placed, rather than '
        + 'saying nothing has settled yet. A directory of unplaceable artifacts '
        + 'reports zero placed entries, and the bare empty-directory line would '
        + 'be false in the one case an operator most needs the truth: the files '
        + 'are there and every one was excluded, each with its own remedy',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            { entryId: 'Mittens', },
            {
              entryId: 'Pepper',
              tip: TIP_A,
            },
          ],
        },);

        await expect(
          selectEligible({
            census: await censusByGeneration({ artifactsDir: dir, },),
          },),
        )
          .rejects
          .toThrow('No entry could be placed',);
      },
    },),

    it({
      name: 'reports an empty directory as zero rather than throwing, since a '
        + 'run that has settled nothing yet is an ordinary state',
      fn: async () => {
        const dir = await writeArtifacts({ entries: [], },);
        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.total,).toBe(0,);
        expect(census.groups.length,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: selectEligible.name,
  children: [
    it({
      name: 'REFUSES a pool spanning generations when no commit was named, '
        + 'which is the whole guard: the failure is a draw that does not know '
        + 'it spans versions, so the default has to be the loud one',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: DIGEST_A,
            },
            {
              entryId: 'Biscuit',
              tip: TIP_B,
              digest: DIGEST_B,
            },
          ],
        },);

        await expect(
          selectEligible({
            census: await censusByGeneration({ artifactsDir: dir, },),
          },),
        )
          .rejects
          .toThrow('pipeline generations',);
      },
    },),

    it({
      name: 'allows a single-generation pool with no commit named, so the '
        + 'guard costs nothing on a clean directory and cannot train anyone to '
        + 'route around it',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: DIGEST_A,
            },
            {
              entryId: 'Pepper',
              tip: TIP_A,
              digest: DIGEST_A,
            },
          ],
        },);

        const eligible = await selectEligible({
          census: await censusByGeneration({ artifactsDir: dir, },),
        },);

        expect(eligible.entryIds,).toEqual(['Mittens', 'Pepper',],);
        expect(eligible.excludedIds.length,).toBe(0,);
        expect(eligible.digestByEntry.get('Mittens',),).toBe(DIGEST_A,);
      },
    },),

    it({
      name: 'permits a MIXED pool only when asked deliberately, and says so in '
        + 'the report, so a number spanning versions can never be printed '
        + 'without the line that admits it',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: DIGEST_A,
            },
            {
              entryId: 'Biscuit',
              tip: TIP_B,
              digest: DIGEST_B,
            },
          ],
        },);

        const eligible = await selectEligible({
          census: await censusByGeneration({ artifactsDir: dir, },),
          pooledDeliberately: true,
        },);

        expect(eligible.entryIds.length,).toBe(2,);
        expect(eligible.selection.kind,).toBe('all-generations',);
        expect(
          eligible.report
            .some(function admits(line: string,) {
              return line.includes('DELIBERATELY',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'splits ONE generation by commit when a required commit is named, '
        + 'because ancestry belongs to commits and a generation can carry '
        + 'several. Asking it per generation would take the whole group on one '
        + 'entry\'s verdict, admitting or excluding entries by association',
      fn: async () => {
        const [root, head,] = await gitBounds();

        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: head,
              digest: DIGEST_A,
            },
            {
              entryId: 'Biscuit',
              tip: root,
              digest: DIGEST_A,
            },
          ],
        },);

        const eligible = await selectEligible({
          census: await censusByGeneration({ artifactsDir: dir, },),
          requiredCommit: head,
        },);

        expect(eligible.entryIds,).toEqual(['Mittens',],);
        expect(eligible.excludedIds,).toEqual(['Biscuit',],);
        expect(
          eligible.report
            .some(function counts(line: string,) {
              return line.includes('1 ELIGIBLE',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'WARNS that a required-commit pool is a post-baseline cohort when '
        + 'two generations both satisfy it. Ancestry is a compatibility floor: '
        + 'every descendant qualifies and descendants differ from each other '
        + 'arbitrarily, so a rate over them belongs to no single pipeline, and '
        + 'an earlier wording invited exactly the opposite reading',
      fn: async () => {
        const [root, head,] = await gitBounds();

        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: head,
              digest: DIGEST_A,
            },
            {
              entryId: 'Biscuit',
              tip: root,
              digest: DIGEST_B,
            },
          ],
        },);

        const eligible = await selectEligible({
          census: await censusByGeneration({ artifactsDir: dir, },),
          requiredCommit: root,
        },);

        expect(eligible.entryIds,).toEqual(['Biscuit', 'Mittens',],);
        expect(eligible.selection.kind,).toBe('required-commit',);
        expect(
          eligible.report
            .some(function warns(line: string,) {
              return line.includes('post-baseline COHORT',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'THROWS rather than returning an empty pool when a required commit '
        + 'excludes every settled entry. This is the whole module\'s failure '
        + 'mode taken to its limit: the caller goes on to compute a rate, and a '
        + 'rate over zero entries is a denominator shrunk all the way to '
        + 'nothing while the number above it still renders',
      fn: async () => {
        const [root, head,] = await gitBounds();

        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: root,
              digest: DIGEST_A,
            },
          ],
        },);

        await expect(
          selectEligible({
            census: await censusByGeneration({ artifactsDir: dir, },),
            requiredCommit: head,
          },),
        )
          .rejects
          .toThrow('excluded by generation filtering',);
      },
    },),

    it({
      name: 'THROWS on a directory that has settled nothing, for the same '
        + 'reason: counting zero is fine, but pooling zero for a rate is not',
      fn: async () => {
        const dir = await writeArtifacts({ entries: [], },);

        await expect(
          selectEligible({
            census: await censusByGeneration({ artifactsDir: dir, },),
          },),
        )
          .rejects
          .toThrow('nothing to pool',);
      },
    },),

    it({
      name: 'SKIPS directory entries that are not regular files, and refuses '
        + 'an artifact whose recorded id is not its file name. A directory '
        + 'called backup.json used to reach readFile and abort the whole '
        + 'census with EISDIR, and a copied artifact used to become a SECOND '
        + 'settled entry under a name no reader would ever ask for',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: TIP_A,
              digest: DIGEST_A,
            },
          ],
        },);
        await mkdir(join(
          dir,
          'backup.json',
        ),);
        await writeFile(
          join(
            dir,
            'Mittens-copy.json',
          ),
          JSON.stringify({
            id: 'Mittens',
            tip: TIP_A,
            pipelineDigest: DIGEST_A,
          },),
          'utf8',
        );

        const census = await censusByGeneration({ artifactsDir: dir, },);

        expect(census.total,).toBe(1,);
        expect(census.untaggedIds,).toEqual(['Mittens-copy',],);
      },
    },),
  ],
},);
