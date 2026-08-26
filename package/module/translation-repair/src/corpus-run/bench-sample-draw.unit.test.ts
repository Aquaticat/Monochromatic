/**
 * Tests that the bench draw REFUSES a corpus it found no slice in.
 *
 * WHY REFUSE RATHER THAN RETURN NOTHING. The bench exists to compare roster
 * widths on the same slices. Handed an empty sample it would run every width
 * over no work, find no difference between them, and print that as a result;
 * the widths would be reported indistinguishable on evidence that never
 * existed. `#188` settled a width question on 231 rounds, and a silent empty
 * draw is exactly how that kind of answer goes wrong.
 *
 * WHAT WAS MEASURED. On 2026-08-25, inverting this guard so a corpus that DID
 * yield slices is the one refused failed no test in this package.
 *
 * READ AGAINST A THROWAWAY CLONE, never the pinned one. The draw now takes its
 * pin as a defaulted parameter, exactly as `censusEntry` already does and for
 * the reason stated there: passed rather than read so it is testable against a
 * throwaway clone instead of the unlicensed one. Each case here builds a git
 * repository in a temporary directory, commits into it, and reads it back at
 * that commit.
 *
 * THE SECOND CASE IS THE CONTROL, and it does two jobs: it separates a guard
 * that reads its input from one that refuses everything, and it proves the pin
 * is actually threaded, since a draw still reading the run pin would come back
 * with the real corpus rather than with one invented cat.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { spawnSync, } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type CorpusPin,
  sampleBenchSlices,
} from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * Entry the control clone holds.
 */
const ENTRY_ID = 'mittens';

/**
 * Original page of that entry.
 */
const SOURCE_PAGE = '## 窗台\n\n小猫在窗台上打盹。它的尾巴垂在地板上。\n';

/**
 * English page of that entry, one section against one.
 */
const TARGET_PAGE = '## The windowsill\n\nThe kitten dozes on the windowsill. '
  + 'Its tail hangs to the floor.\n';

/**
 * Runs git in a directory and refuses if it did not succeed.
 *
 * @param cwd - directory to run in
 *
 * @param args - arguments after the binary
 *
 * @returns Standard output, trimmed
 *
 * @throws Error naming the arguments when git exits non-zero
 *
 * @example
 * ```ts
 * const sha = git({ cwd, args: ['rev-parse', 'HEAD',], },);
 * ```
 */
function git(
  {
    cwd,
    args,
  }: {
    readonly cwd: string;
    readonly args: readonly string[];
  },
): string {
  /**
   * What git did, with its output captured rather than printed.
   */
  const done = spawnSync(
    'git',
    args,
    {
      cwd,
      encoding: 'utf8',
    },
  );

  if (done.status !== 0)
    throw new Error(`git ${args.join(' ',)} exited ${String(done.status,)}: ${done.stderr}`,);

  return done.stdout
    .trim();
}

/**
 * Builds a throwaway git repository holding the named files, and pins it at the
 * one commit it carries.
 *
 * @param files - repository-relative paths mapped to their whole contents
 *
 * @returns Pin naming that clone and that commit
 *
 * @example
 * ```ts
 * const pin = await clonedCorpusHolding({ files: { 'README.md': 'nothing', }, },);
 * ```
 */
async function clonedCorpusHolding(
  { files, }: { readonly files: Readonly<Record<string, string>>; },
): Promise<CorpusPin> {
  /**
   * Throwaway clone standing in for the corpus.
   */
  const cloneDir = await mkdtemp(join(
    tmpdir(),
    'translation-repair-bench-corpus-',
  ),);

  git({
    cwd: cloneDir,
    args: [
      'init',
      '--quiet',
      '--initial-branch',
      'main',
    ],
  },);

  await Promise.all(Object.entries(files,)
    .map(async function writeOne([relPath, text,],): Promise<void> {
      /**
       * Whole path of this file inside the clone.
       */
      const path = join(
        cloneDir,
        relPath,
      );

      await mkdir(
        dirname(path,),
        { recursive: true, },
      );
      await writeFile(
        path,
        text,
        'utf8',
      );
    },),);

  /**
   * Every path this fixture wrote, named explicitly.
   *
   * NAMED RATHER THAN STAGED IN BULK, because the repository's own git guard
   * rejects `--all` and pathspec-less commits, and it guards a throwaway clone
   * exactly as it guards the real one. Naming them is what the guard asks for
   * and is cheap here, since this helper wrote them.
   */
  const paths = Object.keys(files,);

  git({
    cwd: cloneDir,
    args: [
      'add',
      '--',
      ...paths,
    ],
  },);
  git({
    cwd: cloneDir,
    args: [
      '-c',
      'user.name=Bench Fixture',
      '-c',
      'user.email=bench@example.invalid',
      'commit',
      '--quiet',
      '--message',
      'fixture',
      '--',
      ...paths,
    ],
  },);

  return {
    cloneDir,
    commitSha: git({
      cwd: cloneDir,
      args: [
        'rev-parse',
        'HEAD',
      ],
    },),
  };
}

/**
 * Runs a call that must refuse and hands back what it threw.
 *
 * @param act - call expected to reject
 *
 * @returns Whatever it rejected with, unchanged
 *
 * @throws Error when the call resolved instead of rejecting
 *
 * @example
 * ```ts
 * const refusal = await refusalOf(async function overNothing() { ... },);
 * ```
 */
async function refusalOf(act: () => Promise<unknown>,): Promise<unknown> {
  try {
    await act();
  }
  catch (error) {
    return error;
  }
  throw new Error(
    `Expected ${(act.name === '') ? 'the call' : act.name} to refuse, but it returned`,
  );
}

//endregion Fixtures

await describe({
  name: sampleBenchSlices.name,
  children: [
    it({
      name: 'REFUSES a pinned corpus holding no entry at all, since a bench drawn over nothing would '
        + 'find every width indistinguishable and print that as a result',
      fn: async () => {
        /**
         * Clone carrying a commit and no `people/` directory.
         */
        const pin = await clonedCorpusHolding({ files: { 'README.md': 'no entries here\n', }, },);

        /**
         * What the draw said about it.
         */
        const refusal = await refusalOf(async function overAnEmptyCorpus() {
          await sampleBenchSlices({
            count: 1,
            pin,
          },);
        },);

        await rm(
          pin.cloneDir,
          {
            recursive: true,
            force: true,
          },
        );

        expect(refusal,).toBeInstanceOf(Error,);
        expect((refusal as Error).message,).toContain('bench sample found no slices in the pinned corpus',);
      },
    },),

    it({
      name: 'DRAWS from a pinned corpus that does hold one, which separates a guard reading its input '
        + 'from one refusing everything, and shows the pin reaching the reader rather than being ignored',
      fn: async () => {
        /**
         * Clone carrying one entry with both sides present.
         */
        const pin = await clonedCorpusHolding({
          files: {
            [`people/${ENTRY_ID}/page.md`]: SOURCE_PAGE,
            [`people/${ENTRY_ID}/page.en.md`]: TARGET_PAGE,
          },
        },);

        /**
         * Slices drawn out of that one entry.
         */
        const sample = await sampleBenchSlices({
          count: 1,
          pin,
        },);

        await rm(
          pin.cloneDir,
          {
            recursive: true,
            force: true,
          },
        );

        expect(sample.length,).toBe(1,);
        expect(sample[0]?.entryId,).toBe(ENTRY_ID,);
        expect(sample[0]?.sourceText,).toContain('小猫',);
      },
    },),
  ],
},);
