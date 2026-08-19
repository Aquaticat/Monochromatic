/**
 * Tests for gathering one entry's pictures off the pinned corpus.
 *
 * WHAT THESE PIN is the boundary between text and disk. `gatherEntryPictures`
 * reads every slice's source text for photo references, dedupes the named
 * assets into a set, and reads each one at the pinned commit through
 * `readCorpusBytes`, skipping any that git cannot produce rather than
 * failing the whole gather. Exercised against a throwaway git repository
 * built in a temp directory, mirroring `corpus-source.unit.test.ts`'s own
 * fixture; nothing here reads the real corpus.
 *
 * CHILDREN RUN SEQUENTIALLY (`concurrency: 1`), matching
 * `synthetic-transport.unit.test.ts`'s own reasoning: two tests here spy on
 * the shared module-level logger, and an interleaved concurrent run could
 * let one test's log calls land inside another test's spy window.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
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
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  type ChunkPair,
  type CorpusPin,
  gatherEntryPictures,
} from '../../dist/final/node/index.mjs';

/**
 * Real git binary for fixture setup and pinned reads, mirroring
 * `corpus-source.unit.test.ts`: the repo PATH exposes a policy shim whose
 * staging guards reject fixture staging patterns.
 */
const REAL_GIT = await resolveGit();

/**
 * Logger every gather in this file writes its progress to.
 */
const l = tagged({ tag: 'entry-pictures-test', },);

/**
 * Placeholder corpus pages write for an entry's own directory.
 *
 * AN ESCAPED TEMPLATE LITERAL, so characters landing in a slice's text are
 * what corpus text carries rather than an interpolation this file performs
 * by accident. Mirrors `photo-reference.unit.test.ts`.
 */
const ENTRY_PLACEHOLDER = `\${path}`;

/**
 * One picture fixture committed into a throwaway corpus clone.
 */
type PictureFixture = {
  /**
   * Person entry the picture sits under.
   */
  readonly entryId: string;

  /**
   * File name within that entry's photos directory.
   */
  readonly assetName: string;

  /**
   * Bytes committed for that asset.
   */
  readonly bytes: Uint8Array;
};

/**
 * Bytes standing in for a picture, whose content no assertion here reads
 * beyond exact equality.
 *
 * @param seed - byte every position carries, so two calls differ by content
 *
 * @returns Small buffer of that byte
 *
 * @example
 * ```ts
 * const bytes = bytesOf({ seed: 7, },);
 * ```
 */
function bytesOf({ seed, }: { readonly seed: number; },): Uint8Array {
  return new Uint8Array(32,).fill(seed,);
}

/**
 * Builds one photo element naming given assets, in the corpus's only form.
 *
 * @param assetNames - file names within the entry's photos directory
 *
 * @returns Element as a page writes it
 *
 * @example
 * ```ts
 * const element = photoElement({ assetNames: ['sunbeam.webp',], },);
 * ```
 */
function photoElement({ assetNames, }: { readonly assetNames: readonly string[]; },): string {
  return `<PhotoScroll photos={[ ${
    assetNames.map(function quoted(assetName,): string {
      return `'${ENTRY_PLACEHOLDER}/photos/${assetName}'`;
    },)
      .join(', ',)
  } ]} />`;
}

/**
 * Builds one slice pair carrying given original text, target side empty.
 *
 * Offsets and nodes are named directly rather than parsed, mirroring
 * `slice-pictures.unit.test.ts`: what is under test here is which pictures a
 * gather reads off a pinned corpus, not how a slice was carved.
 *
 * @param text - original-side text this slice covers
 *
 * @param chunkIndex - position of this slice in its document
 *
 * @returns Pair whose original side carries that text
 *
 * @example
 * ```ts
 * const pair = sliceOf({ text: 'Mittens naps.\n', chunkIndex: 0, },);
 * ```
 */
function sliceOf(
  {
    text,
    chunkIndex,
  }: {
    readonly text: string;
    readonly chunkIndex: number;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: text.length,
      text,
    },
    target: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: '',
    },
  };
}

/**
 * Runs one git command inside a throwaway clone, hermetic against user and
 * system git configuration.
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
 * Builds a throwaway corpus-shaped git repository committing given
 * pictures, removed on dispose.
 *
 * ON A THROWAWAY, per `THR`: this writes files and runs git, so it gets its
 * own directory rather than any path the repository cares about.
 *
 * @param pictures - assets to commit, one file per entry's photos directory
 *
 * @returns Pin resolving reads against the committed clone, and an async disposer
 *
 * @example
 * ```ts
 * await using fixture = await makeThrowawayCorpus({ pictures: [oneAsset,], },);
 * ```
 */
async function makeThrowawayCorpus(
  { pictures, }: { readonly pictures: readonly PictureFixture[]; },
): Promise<
  AsyncDisposable & {
    readonly pin: CorpusPin;
  }
> {
  /**
   * Fresh directory holding the throwaway repository.
   */
  const cloneDir = await mkdtemp(join(
    tmpdir(),
    'entry-pictures-corpus-',
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

  await Promise.all(pictures.map(async function writePicture(picture,): Promise<void> {
    /**
     * Directory this asset's entry keeps its photos under.
     */
    const photosDir = join(
      cloneDir,
      'people',
      picture.entryId,
      'photos',
    );
    await mkdir(
      photosDir,
      { recursive: true, },
    );
    await writeFile(
      join(
        photosDir,
        picture.assetName,
      ),
      picture.bytes,
    );
  },),);

  await fixtureGit({
    cloneDir,
    args: [
      'add',
      'people',
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
      'add pictures',
      '--no-gpg-sign',
    ],
  },);

  /**
   * Commit every test read pins to.
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
      gitPath: REAL_GIT,
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
  name: gatherEntryPictures.name,
  concurrency: 1,
  children: [
    it({
      name: 'RETURNS AN EMPTY MAP WITHOUT TOUCHING THE CORPUS WHEN THERE ARE NO SLICES, since '
        + 'nothing named means nothing to read, and a pin that cannot resolve must not matter '
        + 'when no read is ever attempted against it',
      fn: async () => {
        /**
         * Deliberately unreadable pin: no read against it must succeed
         * silently, so this only passes if the gather never touches it.
         */
        const brokenPin: CorpusPin = {
          cloneDir: join(
            tmpdir(),
            'entry-pictures-no-such-clone',
          ),
          commitSha: 'deadbeef',
        };

        expect((await gatherEntryPictures({
          pin: brokenPin,
          entryId: 'mittens',
          slices: [],
          l,
        },)).size,).toBe(0,);
      },
    },),

    it({
      name: 'RETURNS AN EMPTY MAP WHEN NO SLICE NAMES A PICTURE, leaving an unresolvable pin '
        + 'untouched exactly as an empty slice list does',
      fn: async () => {
        /**
         * Same deliberately unreadable pin as the no-slices case.
         */
        const brokenPin: CorpusPin = {
          cloneDir: join(
            tmpdir(),
            'entry-pictures-no-such-clone',
          ),
          commitSha: 'deadbeef',
        };

        /**
         * Two slices of plain prose, naming no picture between them.
         */
        const quietSlices: readonly ChunkPair[] = [
          sliceOf({
            text: 'Mittens naps all afternoon, showing nothing.\n',
            chunkIndex: 0,
          },),
          sliceOf({
            text: 'She stretches once and settles again.\n',
            chunkIndex: 1,
          },),
        ];

        expect((await gatherEntryPictures({
          pin: brokenPin,
          entryId: 'mittens',
          slices: quietSlices,
          l,
        },)).size,).toBe(0,);
      },
    },),

    it({
      name: 'READS THE NAMED ENTRY’S OWN PICTURE, NOT A SAME-NAMED PICTURE COMMITTED UNDER '
        + 'ANOTHER ENTRY, since the corpus keys a picture by entry and file name together',
      fn: async () => {
        await using fixture = await makeThrowawayCorpus({
          pictures: [
            {
              entryId: 'mittens',
              assetName: 'nap.webp',
              bytes: bytesOf({ seed: 11, },),
            },
            {
              entryId: 'marmalade',
              assetName: 'nap.webp',
              bytes: bytesOf({ seed: 99, },),
            },
          ],
        },);

        /**
         * What the gather resolved for `mittens` alone.
         */
        const gathered = await gatherEntryPictures({
          pin: fixture.pin,
          entryId: 'mittens',
          slices: [sliceOf({
            text: `Mittens dozes by the radiator.\n\n${
              photoElement({ assetNames: ['nap.webp',], },)
            }\n`,
            chunkIndex: 0,
          },),],
          l,
        },);

        expect(gathered.size,).toBe(1,);
        expect(gathered.get('nap.webp',),).toEqual(bytesOf({ seed: 11, },),);
      },
    },),

    it({
      name: 'GATHERS EVERY DISTINCT PICTURE MULTIPLE SLICES NAME, EACH UNDER ITS OWN KEY, so a '
        + 'document showing three different pictures across three slices comes back with all '
        + 'three',
      fn: async () => {
        await using fixture = await makeThrowawayCorpus({
          pictures: [
            {
              entryId: 'mittens',
              assetName: 'sunbeam.webp',
              bytes: bytesOf({ seed: 1, },),
            },
            {
              entryId: 'mittens',
              assetName: 'stretch.webp',
              bytes: bytesOf({ seed: 2, },),
            },
            {
              entryId: 'mittens',
              assetName: 'nap.webp',
              bytes: bytesOf({ seed: 3, },),
            },
          ],
        },);

        /**
         * Three slices, each naming a different picture.
         */
        const threeSlices: readonly ChunkPair[] = [
          sliceOf({
            text: `Mittens suns herself on the sill.\n\n${
              photoElement({ assetNames: ['sunbeam.webp',], },)
            }\n`,
            chunkIndex: 0,
          },),
          sliceOf({
            text: `She stretches and yawns.\n\n${
              photoElement({ assetNames: ['stretch.webp',], },)
            }\n`,
            chunkIndex: 1,
          },),
          sliceOf({
            text: `Then she naps by the door.\n\n${
              photoElement({ assetNames: ['nap.webp',], },)
            }\n`,
            chunkIndex: 2,
          },),
        ];

        /**
         * What the gather resolved across all three slices.
         */
        const gathered = await gatherEntryPictures({
          pin: fixture.pin,
          entryId: 'mittens',
          slices: threeSlices,
          l,
        },);

        expect(gathered.size,).toBe(3,);
        expect(gathered.get('sunbeam.webp',),).toEqual(bytesOf({ seed: 1, },),);
        expect(gathered.get('stretch.webp',),).toEqual(bytesOf({ seed: 2, },),);
        expect(gathered.get('nap.webp',),).toEqual(bytesOf({ seed: 3, },),);
      },
    },),

    it({
      name: 'NAMES A PICTURE ONCE EVEN WHEN TWO SLICES SHOW IT, not twice, since the same asset '
        + 'referenced by two slices is one file to read rather than two',
      fn: async () => {
        await using fixture = await makeThrowawayCorpus({
          pictures: [{
            entryId: 'mittens',
            assetName: 'perch.webp',
            bytes: bytesOf({ seed: 5, },),
          },],
        },);

        /**
         * Cursor counting how many times `gitPath` was read, which happens
         * once per `readCorpusBytes` invocation: a Map ending with one entry
         * would also result from reading the same picture twice and letting
         * the second write overwrite the first, so only a read count proves
         * the accumulation into `named` deduped before any read ran.
         */
        const reads = { count: 0, };

        /**
         * Same clone and commit the fixture committed, with `gitPath`
         * counted on each access rather than named once as a plain string.
         */
        const countedPin: CorpusPin = {
          cloneDir: fixture.pin.cloneDir,
          commitSha: fixture.pin.commitSha,
          get gitPath(): string {
            reads.count += 1;
            return REAL_GIT;
          },
        };

        /**
         * Two slices, both naming the same picture.
         */
        const dupingSlices: readonly ChunkPair[] = [
          sliceOf({
            text: `Mittens watches from the sill.\n\n${
              photoElement({ assetNames: ['perch.webp',], },)
            }\n`,
            chunkIndex: 0,
          },),
          sliceOf({
            text: `By evening she returns to the sill.\n\n${
              photoElement({ assetNames: ['perch.webp',], },)
            }\n`,
            chunkIndex: 1,
          },),
        ];

        /**
         * What the gather resolved across both slices.
         */
        const gathered = await gatherEntryPictures({
          pin: countedPin,
          entryId: 'mittens',
          slices: dupingSlices,
          l,
        },);

        expect(gathered.size,).toBe(1,);
        expect(gathered.get('perch.webp',),).toEqual(bytesOf({ seed: 5, },),);
        expect(reads.count,).toBe(1,);
      },
    },),

    it({
      name: 'OMITS A PICTURE MISSING FROM THE CORPUS WHILE KEEPING THE ONES PRESENT, resolving '
        + 'rather than rejecting, since one unread asset among fifty must not cost the rest',
      fn: async () => {
        await using fixture = await makeThrowawayCorpus({
          pictures: [{
            entryId: 'mittens',
            assetName: 'windowsill.webp',
            bytes: bytesOf({ seed: 21, },),
          },],
        },);

        /**
         * One slice naming a committed picture and an uncommitted one.
         */
        const mixedSlice: ChunkPair = sliceOf({
          text: `Mittens suns herself, then vanishes behind the curtain.\n\n${
            photoElement({ assetNames: ['windowsill.webp', 'phantom.webp',], },)
          }\n`,
          chunkIndex: 0,
        },);

        /**
         * What the gather resolved: the present picture only.
         */
        const gathered = await gatherEntryPictures({
          pin: fixture.pin,
          entryId: 'mittens',
          slices: [mixedSlice,],
          l,
        },);

        expect(gathered.size,).toBe(1,);
        expect(gathered.has('phantom.webp',),).toBe(false,);
        expect(gathered.get('windowsill.webp',),).toEqual(bytesOf({ seed: 21, },),);
      },
    },),

    it({
      name: 'WARNS NAMING THE ENTRY AND ASSET FOR A MISSING PICTURE, AND LOGS THE FINAL '
        + 'GATHERED-VERSUS-NAMED TALLY, so a run that skipped an asset leaves a trace of what '
        + 'and how much rather than only a silently smaller map',
      fn: async ctx => {
        /**
         * Spy observing every warning this gather logs.
         */
        const warnSpy = ctx.sinon.spy(
          l,
          'warn',
        );
        /**
         * Spy observing every info line this gather logs.
         */
        const infoSpy = ctx.sinon.spy(
          l,
          'info',
        );

        await using fixture = await makeThrowawayCorpus({
          pictures: [{
            entryId: 'mittens',
            assetName: 'windowsill.webp',
            bytes: bytesOf({ seed: 21, },),
          },],
        },);

        await gatherEntryPictures({
          pin: fixture.pin,
          entryId: 'mittens',
          slices: [sliceOf({
            text: `Mittens suns herself, then vanishes behind the curtain.\n\n${
              photoElement({ assetNames: ['windowsill.webp', 'phantom.webp',], },)
            }\n`,
            chunkIndex: 0,
          },),],
          l,
        },);

        expect(warnSpy.callCount,).toBe(1,);
        expect(warnSpy,).toHaveBeenCalledWith(
          expect.stringContaining('mittens/phantom.webp: not in the corpus at this pin',),
        );
        expect(infoSpy.callCount,).toBe(1,);
        expect(infoSpy,).toHaveBeenCalledWith(
          expect.stringContaining('gathered 1 of 2 pictures for mittens',),
        );
      },
    },),

    it({
      name: 'FORWARDS AN ERROR THAT IS NOT A CORPUS READ FAULT INSTEAD OF SWALLOWING IT AS A '
        + 'MISSING PICTURE, since only a `CorpusReadError` means the corpus itself lacks the '
        + 'asset, and any other failure is a different problem a caller must see',
      fn: async () => {
        /**
         * Planted failure this test proves escapes unwrapped. Identity is
         * checked below rather than a message, so no accidental string
         * overlap with a real `CorpusReadError` could pass this test by
         * coincidence.
         */
        const planted = new Error('a hairball interrupts the read',);

        /**
         * Pin whose `gitPath` throws before `readCorpusBytes` ever spawns
         * git: `readCorpusBytes` reads `pin.gitPath` ahead of its own try
         * block, so a throw here is the one seam that reaches
         * `gatherEntryPictures` NOT wrapped in `CorpusReadError`. Were that
         * read ever moved inside the try, this branch would go dead, and
         * this test failing is the signal that it did.
         */
        const trappedPin: CorpusPin = {
          cloneDir: join(
            tmpdir(),
            'entry-pictures-never-read',
          ),
          commitSha: 'deadbeef',
          get gitPath(): string {
            throw planted;
          },
        };

        /**
         * Value caught from a gather whose only named picture cannot be
         * read for a reason that is not a missing corpus entry.
         */
        let caught: unknown;
        try {
          await gatherEntryPictures({
            pin: trappedPin,
            entryId: 'mittens',
            slices: [sliceOf({
              text: `Mittens hides from the vacuum.\n\n${
                photoElement({ assetNames: ['vacuum.webp',], },)
              }\n`,
              chunkIndex: 0,
            },),],
            l,
          },);
        }
        catch (error) {
          caught = error;
        }

        expect(caught,).toBe(planted,);
      },
    },),
  ],
},);
