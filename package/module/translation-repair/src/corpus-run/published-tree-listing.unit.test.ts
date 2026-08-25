/**
 * Tests for whether a run left anything to verify, and how it says so.
 *
 * `#217` IS THE WHOLE POINT. `verify-published.ts` answered an absent
 * artifacts directory with an empty list and printed the absence on stderr, so
 * a directory that was never a run printed the same stdout summary as a run
 * whose every page agreed, and left the same exit code behind. Anything using
 * the check as a gate passed the run that was never examined.
 *
 * THREE POPULATIONS HAVE TO STAY APART, and no two of them may collapse: a run
 * that is not there, a run that settled nothing, and a run with entries to
 * check. The first two are both "nothing verified" and the third is not, but
 * the first two still differ in what an operator does next, so the reason
 * rides along in the verdict rather than being thrown away.
 *
 * THE REASON IS A FILESYSTEM CODE, NOT A CLASS NAME. `errorName` answers
 * `Error` for every filesystem failure, so the report used to separate
 * "pointed at the wrong directory" from "cannot read this directory" not at
 * all. Two cases here pin `ENOENT` against `ENOTDIR` for exactly that.
 *
 * AN ABSENT PUBLISHED TREE IS DELIBERATELY NOT SILENCE. Beside real artifacts
 * it means every settled entry was never published, which is this check's most
 * serious finding, so it stays checkable with an empty tree.
 *
 * DISPOSABLE FIXTURES ONLY: every case writes into its own `mkdtemp`
 * directory, and nothing here reads a real run.
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

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type DirectoryReading,
  filesystemReason,
  namesIn,
  publishedEntryIds,
  settledEntryIds,
  whatThereIsToVerify,
} from '../../dist/final/node/index.mjs';

/**
 * Fixed tree directory a run publishes under, as `publish-fixed.ts` names it.
 */
const FIXED_TREE = 'fixed';

/**
 * People directory inside that tree.
 */
const PEOPLE = 'people';

/**
 * Artifacts directory a run settles into.
 */
const ARTIFACTS = 'artifacts';

/**
 * Makes one disposable run directory for a case to populate.
 *
 * @returns Directory that no other case shares
 *
 * @example
 * ```ts
 * const runsDir = await disposableRun();
 * ```
 */
async function disposableRun(): Promise<string> {
  return await mkdtemp(join(
    tmpdir(),
    'published-tree-listing-',
  ),);
}

/**
 * Writes a run directory holding exactly these artifact file names.
 *
 * @param names - file names to write, verbatim, so a case can write something
 * that is not an artifact at all
 *
 * @returns Run directory holding them under its artifacts directory
 *
 * @example
 * ```ts
 * const runsDir = await runSettling({ names: ['Mittens.json',], },);
 * ```
 */
async function runSettling(
  { names, }: { readonly names: readonly string[]; },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const runsDir = await disposableRun();

  await mkdir(
    join(
      runsDir,
      ARTIFACTS,
    ),
    { recursive: true, },
  );
  await Promise.all(names.map(async function writeOne(name,): Promise<void> {
    await writeFile(
      join(
        runsDir,
        ARTIFACTS,
        name,
      ),
      '{}',
      'utf8',
    );
  },),);
  return runsDir;
}

/**
 * Writes a run directory whose published tree holds exactly these entries.
 *
 * @param runsDir - run directory to publish into
 *
 * @param entryIds - entry directories to create under the people directory
 *
 * @example
 * ```ts
 * await publishInto({ runsDir, entryIds: ['Mittens',], },);
 * ```
 */
async function publishInto(
  {
    runsDir,
    entryIds,
  }: {
    readonly runsDir: string;
    readonly entryIds: readonly string[];
  },
): Promise<void> {
  await Promise.all(entryIds.map(async function makeOne(entryId,): Promise<void> {
    await mkdir(
      join(
        runsDir,
        FIXED_TREE,
        PEOPLE,
        entryId,
      ),
      { recursive: true, },
    );
  },),);
}

/**
 * Names read off a listing, or a marker saying it was not readable.
 *
 * Keeps every case's assertion one line, and fails loudly rather than
 * silently reading `[]` off a refusal, which is the defect under test.
 *
 * @param reading - what a listing returned
 *
 * @returns Its names, or a marker naming the refusal
 *
 * @example
 * ```ts
 * expect(namesOf({ reading, },),).toEqual(['Mittens',],);
 * ```
 */
function namesOf(
  { reading, }: { readonly reading: DirectoryReading; },
): readonly string[] {
  if (reading.kind === 'unreadable')
    return [`UNREADABLE ${reading.reason}`,];
  return reading.names;
}

await describe({
  name: namesIn.name,
  children: [
    it({
      name: 'READS a directory that is there, which is the control every '
        + 'other case departs from',
      fn: async () => {
        const dir = await runSettling({ names: ['Mittens.json',], },);
        expect(namesOf({ reading: await namesIn({ dir: join(dir, ARTIFACTS,), },), },),)
          .toEqual(['Mittens.json',],);
      },
    },),

    it({
      name: 'REFUSES a directory that is not there, naming ENOENT rather than '
        + 'returning an empty listing a caller reads as a clean one',
      fn: async () => {
        const reading = await namesIn({ dir: join(await disposableRun(), 'nowhere',), },);
        expect(reading.kind,).toBe('unreadable',);
        expect((reading.kind === 'unreadable') ? reading.reason : '',).toBe('ENOENT',);
      },
    },),

    it({
      name: 'REFUSES a path that is a file with ENOTDIR, which is a different '
        + 'operator action from ENOENT and used to read as the same Error',
      fn: async () => {
        const dir = await disposableRun();
        const file = join(
          dir,
          'not-a-directory',
        );
        await writeFile(
          file,
          'the cat sat on the keyboard\n',
          'utf8',
        );
        const reading = await namesIn({ dir: file, },);
        expect((reading.kind === 'unreadable') ? reading.reason : '',).toBe('ENOTDIR',);
      },
    },),
  ],
},);

await describe({
  name: filesystemReason.name,
  children: [
    it({
      name: 'NAMES the filesystem code when the caught value carries one',
      fn: async () => {
        expect(filesystemReason({ error: Object.assign(
          new Error('unread',),
          { code: 'EACCES', },
        ), },),).toBe('EACCES',);
      },
    },),

    it({
      name: 'FALLS BACK to the class name when the caught value carries no code',
      fn: async () => {
        expect(filesystemReason({ error: new TypeError('no code here',), },),)
          .toBe('TypeError',);
      },
    },),

    it({
      name: 'FALLS BACK for a thrown value that is not an Error at all, since '
        + 'a catch binding may hold anything',
      fn: async () => {
        expect(filesystemReason({ error: 'a string nobody should have thrown', },),)
          .toContain('not an Error',);
      },
    },),
  ],
},);

await describe({
  name: settledEntryIds.name,
  children: [
    it({
      name: 'LISTS artifact ids sorted, dropping a file that is not one',
      fn: async () => {
        const runsDir = await runSettling({ names: [
          'Whiskers.json',
          'Mittens.json',
          'notes.txt',
        ], },);
        expect(namesOf({ reading: await settledEntryIds({ runsDir, },), },),)
          .toEqual([
            'Mittens',
            'Whiskers',
          ],);
      },
    },),

    it({
      name: 'REFUSES a run directory with no artifacts directory, rather than '
        + 'reporting a run that settled nothing',
      fn: async () => {
        const reading = await settledEntryIds({ runsDir: await disposableRun(), },);
        expect((reading.kind === 'unreadable') ? reading.reason : '',).toBe('ENOENT',);
      },
    },),
  ],
},);

await describe({
  name: publishedEntryIds.name,
  children: [
    it({
      name: 'LISTS published entries sorted',
      fn: async () => {
        const runsDir = await runSettling({ names: [], },);
        await publishInto({
          runsDir,
          entryIds: [
            'Whiskers',
            'Mittens',
          ],
        },);
        expect(namesOf({ reading: await publishedEntryIds({ runsDir, },), },),)
          .toEqual([
            'Mittens',
            'Whiskers',
          ],);
      },
    },),

    it({
      name: 'REFUSES a run directory that published nothing at all',
      fn: async () => {
        const reading = await publishedEntryIds({ runsDir: await disposableRun(), },);
        expect((reading.kind === 'unreadable') ? reading.reason : '',).toBe('ENOENT',);
      },
    },),
  ],
},);

await describe({
  name: whatThereIsToVerify.name,
  children: [
    it({
      name: 'REFUSES a directory that is not a run, carrying the reason into '
        + 'the verdict so the report can name ENOENT',
      fn: async () => {
        const verdict = whatThereIsToVerify({
          settled: {
            kind: 'unreadable',
            reason: 'ENOENT',
          },
          published: {
            kind: 'unreadable',
            reason: 'ENOENT',
          },
        },);
        expect(verdict.kind,).toBe('nothing-verified',);
        expect((verdict.kind === 'nothing-verified') ? verdict.why : '',)
          .toContain('ENOENT',);
      },
    },),

    it({
      name: 'REFUSES a run that settled no entry, which is `#217` itself: an '
        + 'empty run used to report exactly what a perfect run reports',
      fn: async () => {
        const verdict = whatThereIsToVerify({
          settled: {
            kind: 'read',
            names: [],
          },
          published: {
            kind: 'read',
            names: [],
          },
        },);
        expect(verdict.kind,).toBe('nothing-verified',);
      },
    },),

    it({
      name: 'ACCEPTS a run with entries to check, carrying both sides through',
      fn: async () => {
        const verdict = whatThereIsToVerify({
          settled: {
            kind: 'read',
            names: ['Mittens',],
          },
          published: {
            kind: 'read',
            names: ['Mittens',],
          },
        },);
        expect(verdict.kind,).toBe('checkable',);
        expect((verdict.kind === 'checkable') ? verdict.published : [],)
          .toEqual(['Mittens',],);
      },
    },),

    it({
      name: 'ACCEPTS real artifacts with no published tree as an empty tree, '
        + 'because every settled entry being unpublished is a finding rather '
        + 'than a silence',
      fn: async () => {
        const verdict = whatThereIsToVerify({
          settled: {
            kind: 'read',
            names: ['Mittens',],
          },
          published: {
            kind: 'unreadable',
            reason: 'ENOENT',
          },
        },);
        expect(verdict.kind,).toBe('checkable',);
        expect((verdict.kind === 'checkable') ? verdict.published : ['unset',],)
          .toEqual([],);
      },
    },),
  ],
},);
