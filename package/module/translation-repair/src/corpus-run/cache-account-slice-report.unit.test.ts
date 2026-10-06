/**
 Tests for the slice caches' part of the pre-launch cache check: the runs
 directories read, the records they hold, the directories the search could not
 list, and the newest record against the versions set after it.

 What is printed is read off `console.log` through a diverting capture, which
 is process-wide, so the suite runs one case at a time. Every runs directory is
 a scratch directory of invented records.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  chmod,
  mkdir,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  reportSliceCaches,
  type VersionSetting,
} from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { writeSliceRecord, } from './cache-account-repo.test-fixture.ts';
import { divertingConsoleLog, } from './console-log-capture.test-fixture.ts';

/**
 Time of the newest record the cases write, 2026-09-02T10:00:00Z.
 */
const NEWEST_SECONDS = 1_788_343_200;

/**
 One version's setting at a time.

 @param name - constant's name

 @param seconds - committer time of the commit that set it

 @returns The setting

 @example
 ```ts
 const setting = settingAt({ name: 'STAGE_CACHE_VERSION', seconds: 1_788_256_800, },);
 ```
 */
function settingAt({ name, seconds, }: { readonly name: string; readonly seconds: number; },): VersionSetting {
  return {
    version: {
      name,
      value: 1,
      path: 'src/stage-cache-version.ts',
      declaration: `${name} = 1`,
    },
    commit: {
      hash: 'b1f20a6e4aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      seconds,
      subject: 'set a cache version',
    },
    account: '',
  };
}

await describe({
  name: reportSliceCaches.name,
  concurrency: 1,
  children: [
    it({
      name: 'PRINTS THE RECORDS UNDER THE RUNS DIRECTORY A PASS WOULD USE, the newest one and how many versions '
        + 'were set after it',
      fn: async (ctx) => {
        using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
        await using root = await scratchDir({ prefix: 'cache-account-slice-root-', },);
        await using runs = await scratchDir({ prefix: 'cache-account-slice-runs-', },);
        const record = await writeSliceRecord({ runsDir: runs.path, seconds: NEWEST_SECONDS, },);

        await reportSliceCaches({
          root: root.path,
          runsDir: runs.path,
          searched: [],
          settings: [
            settingAt({ name: 'STAGE_CACHE_VERSION', seconds: NEWEST_SECONDS - 1, },),
            settingAt({ name: 'PAIRING_CACHE_VERSION', seconds: NEWEST_SECONDS + 1, },),
          ],
        },);

        expect(printed.lines,).toEqual([
          `slice-cache records under 1 runs directory found in ${join(root.path, 'node_modules', '.monochromatic',)}, `
          + `${runs.path}: 1`,
          'directories the search could not list, whose runs the count leaves out: 0',
          `newest slice-cache record: 2026-09-02T10:00Z ${record}`,
          'cache versions set after it: 1 of 2',
        ],);
      },
    },),
    it({
      name: 'SAYS NONE WAS FOUND where the runs hold no record, with the count as the control',
      fn: async (ctx) => {
        using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
        await using root = await scratchDir({ prefix: 'cache-account-slice-root-', },);
        await using runs = await scratchDir({ prefix: 'cache-account-slice-runs-', },);

        await reportSliceCaches({
          root: root.path,
          runsDir: runs.path,
          searched: [],
          settings: [],
        },);

        expect(printed.lines,).toEqual([
          `slice-cache records under 1 runs directory found in ${join(root.path, 'node_modules', '.monochromatic',)}, `
          + `${runs.path}: 0`,
          'directories the search could not list, whose runs the count leaves out: 0',
          'newest slice-cache record: none',
        ],);
      },
    },),
    it({
      name: 'READS EVERY RUNS DIRECTORY found under a searched directory and beside the default one, and names where '
        + 'it looked',
      fn: async (ctx) => {
        using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
        await using root = await scratchDir({ prefix: 'cache-account-slice-root-', },);
        await using runs = await scratchDir({ prefix: 'cache-account-slice-runs-', },);
        await using under = await scratchDir({ prefix: 'cache-account-slice-under-', },);
        await writeSliceRecord({ runsDir: runs.path, seconds: NEWEST_SECONDS - 100, },);

        /**
         A hand-set runs directory beside the default one, and one under a
         searched directory.
         */
        const beside = join(
          root.path,
          'node_modules',
          '.monochromatic',
          'translation-repair-runs-pass1',
        );
        await writeSliceRecord({ runsDir: beside, seconds: NEWEST_SECONDS - 50, },);
        const nested = join(
          under.path,
          'pass2',
        );
        const record = await writeSliceRecord({ runsDir: nested, seconds: NEWEST_SECONDS, },);

        await reportSliceCaches({
          root: root.path,
          runsDir: runs.path,
          searched: [under.path,],
          settings: [settingAt({ name: 'STAGE_CACHE_VERSION', seconds: NEWEST_SECONDS, },),],
        },);

        expect(printed.lines,).toEqual([
          `slice-cache records under 3 runs directories found in ${join(root.path, 'node_modules', '.monochromatic',)}, `
          + `${runs.path}, ${under.path}: 3`,
          'directories the search could not list, whose runs the count leaves out: 0',
          `newest slice-cache record: 2026-09-02T10:00Z ${record}`,
          'cache versions set after it: 0 of 1',
        ],);
      },
    },),
    it({
      name: 'LISTS EACH DIRECTORY THE SEARCH COULD NOT LIST with the reason, and still counts the records it could read',
      fn: async (ctx) => {
        using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
        await using root = await scratchDir({ prefix: 'cache-account-slice-root-', },);
        await using runs = await scratchDir({ prefix: 'cache-account-slice-runs-', },);
        await using under = await scratchDir({ prefix: 'cache-account-slice-under-', },);

        /**
         A directory nobody may list, under the searched one.
         */
        const sealed = join(
          under.path,
          'sealed',
        );
        await mkdir(sealed,);
        await chmod(
          sealed,
          0,
        );
        await using _reopened = {
          [Symbol.asyncDispose]: async function reopen(): Promise<void> {
            await chmod(
              sealed,
              0o700,
            );
          },
        };

        await reportSliceCaches({
          root: root.path,
          runsDir: runs.path,
          searched: [under.path,],
          settings: [],
        },);

        expect(printed.lines.slice(
          0,
          3,
        ),).toEqual([
          `slice-cache records under 1 runs directory found in ${join(root.path, 'node_modules', '.monochromatic',)}, `
          + `${runs.path}, ${under.path}: 0`,
          'directories the search could not list, whose runs the count leaves out: 1',
          `  ${sealed} (EACCES)`,
        ],);
      },
    },),
  ],
},);
