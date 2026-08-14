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
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { mkdtemp, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  censusByTip,
  selectEligible,
} from '../../dist/final/node/index.mjs';

/**
 * Writes a throwaway artifacts directory.
 *
 * Written to a fresh temporary directory every time rather than to the real
 * runs directory, which holds hours of ungraded work.
 *
 * @param entries - one record per artifact; omitting `tip` writes an artifact
 * that carries no pipeline commit at all
 *
 * @returns Path of the artifacts directory
 *
 * @example
 * ```ts
 * const dir = await writeArtifacts({ entries: [{ entryId: 'Mittens', tip: 'abc', },], },);
 * ```
 */
async function writeArtifacts(
  { entries, }: {
    readonly entries: readonly Readonly<{
      entryId: string;
      tip?: string;
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
       * Artifact body, carrying a pipeline commit only when one was given.
       */
      const body = 'tip' in entry
        ? {
          tip: entry.tip,
          status: 'repaired',
        }
        : { status: 'repaired', };

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
  name: censusByTip.name,
  children: [
    it({
      name: 'partitions settled entries by the commit each recorded, largest '
        + 'group first, which is the reading that was impossible before: the '
        + 'field was written into every artifact and read by nothing',
      fn: async () => {
        const dir = await writeArtifacts({
          entries: [
            {
              entryId: 'Mittens',
              tip: 'aaaaaaaaa',
            },
            {
              entryId: 'Pepper',
              tip: 'aaaaaaaaa',
            },
            {
              entryId: 'Biscuit',
              tip: 'bbbbbbbbb',
            },
          ],
        },);

        const census = await censusByTip({ artifactsDir: dir, },);

        expect(census.total,).toBe(3,);
        expect(census.groups.length,).toBe(2,);
        expect(census.groups[0]?.tip,).toBe('aaaaaaaaa',);
        expect(census.groups[0]?.entryIds,).toEqual(['Mittens', 'Pepper',],);
        expect(census.groups[1]?.entryIds,).toEqual(['Biscuit',],);
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
              tip: 'aaaaaaaaa',
            },
            { entryId: 'Biscuit', },
          ],
        },);

        const census = await censusByTip({ artifactsDir: dir, },);

        expect(census.total,).toBe(1,);
        expect(census.untaggedIds,).toEqual(['Biscuit',],);
        expect(census.malformedIds.length,).toBe(0,);

        const eligible = await selectEligible({ census, },);

        expect(eligible.entryIds,).toEqual(['Mittens',],);
        expect(
          eligible.report
            .some(function names(line: string,) {
              return line.includes('Biscuit',)
                && line.includes('recording no pipeline commit',);
            },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'reports an empty directory as zero rather than throwing, since a '
        + 'run that has settled nothing yet is an ordinary state',
      fn: async () => {
        const dir = await writeArtifacts({ entries: [], },);
        const census = await censusByTip({ artifactsDir: dir, },);

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
              tip: 'aaaaaaaaa',
            },
            {
              entryId: 'Biscuit',
              tip: 'bbbbbbbbb',
            },
          ],
        },);

        await expect(
          selectEligible({ census: await censusByTip({ artifactsDir: dir, },), },),
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
              tip: 'aaaaaaaaa',
            },
            {
              entryId: 'Pepper',
              tip: 'aaaaaaaaa',
            },
          ],
        },);

        const eligible = await selectEligible({
          census: await censusByTip({ artifactsDir: dir, },),
        },);

        expect(eligible.entryIds,).toEqual(['Mittens', 'Pepper',],);
        expect(eligible.excludedIds.length,).toBe(0,);
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
              tip: 'aaaaaaaaa',
            },
            {
              entryId: 'Biscuit',
              tip: 'bbbbbbbbb',
            },
          ],
        },);

        const eligible = await selectEligible({
          census: await censusByTip({ artifactsDir: dir, },),
          pooledDeliberately: true,
        },);

        expect(eligible.entryIds.length,).toBe(2,);
        expect(
          eligible.report
            .some(function admits(line: string,) {
              return line.includes('DELIBERATELY',);
            },),
        ).toBe(true,);
      },
    },),
  ],
},);
