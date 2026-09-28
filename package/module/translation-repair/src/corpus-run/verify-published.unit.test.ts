/**
 Tests for `verify-published` as an operator runs it: the built CLI over a
 throwaway runs directory, read for what it prints and how it exits.

 A RUN ALWAYS SHIPS (the owner, 2026-09-27; ledger A16b): the verifier prints
 every finding and exits 0, keeping exit 2 for a run it could not read at
 all, which the last case holds as the control that the exit code is read.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { spawnSync, } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  prepareDocumentPair,
  republishSettledPages,
} from '../../dist/final/node/index.mjs';
import { settledArtifactText, } from './settled-artifact.test-fixture.ts';

/**
 Original with two sections.
 */
const SOURCE_DOC = '## 第一节\n\n猫猫在窗台上睡觉。\n\n## 第二节\n\n猫猫有自己的碗。\n';

/**
 Archive English of the same shape.
 */
const TARGET_DOC = '## Section one\n\nThe cat sleeps on the sill.\n\n## Section two\n\nThe cat has a bowl.\n';

/**
 Entry every case settles.
 */
const ENTRY = 'CatEntry1';

/**
 The built verifier.
 */
const VERIFIER = join(
  import.meta.dirname,
  '..',
  '..',
  'dist',
  'final',
  'node',
  'verify-published.mjs',
);

/**
 A throwaway runs directory holding one settled artifact and the page a pass
 publishes from it.

 @returns The directory and the page path

 @example
 ```ts
 const { runsDir, pagePath, } = await publishedRun();
 ```
 */
async function publishedRun(): Promise<{
  readonly runsDir: string;
  readonly pagePath: string;
}> {
  /**
   The runs directory.
   */
  const runsDir = await mkdtemp(join(
    tmpdir(),
    'verify-published-',
  ),);
  /**
   Where the artifact lives.
   */
  const artifactsDir = join(
    runsDir,
    'artifacts',
  );
  await mkdir(artifactsDir,);
  await writeFile(
    join(
      artifactsDir,
      `${ENTRY}.json`,
    ),
    settledArtifactText({
      prepared: prepareDocumentPair({
        sourceText: SOURCE_DOC,
        targetText: TARGET_DOC,
        includeFrontMatter: true,
        sealArchiveOriginal: true,
      },),
      entryId: ENTRY,
    },),
  );
  /**
   Root of the mirrored tree.
   */
  const publishDir = join(
    runsDir,
    'fixed',
  );
  await republishSettledPages({
    entryIds: [ENTRY,],
    artifactsDir,
    publishDir,
    readPair: async function readPair() {
      return {
        sourceText: SOURCE_DOC,
        targetText: TARGET_DOC,
      };
    },
    l: tagged({ tag: 'verify-published-test', },),
  },);
  return {
    runsDir,
    pagePath: join(
      publishDir,
      'people',
      ENTRY,
      'page.en.md',
    ),
  };
}

/**
 Runs the verifier over one runs directory.

 @param runsDir - directory to verify

 @returns Its exit code and what it printed

 @throws {@link Error} when a signal ended it, which leaves no exit code to read

 @example
 ```ts
 const { status, stdout, } = verify({ runsDir, },);
 ```
 */
function verify(
  { runsDir, }: { readonly runsDir: string; },
): {
  readonly status: number;
  readonly stdout: string;
} {
  /**
   The finished process.
   */
  const done = spawnSync(
    process.execPath,
    [VERIFIER,],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        TRANSLATION_REPAIR_RUNS_DIR: runsDir,
      },
    },
  );
  if (done.status === null)
    throw new Error(`verify-published ended on signal ${String(done.signal,)}`,);
  return {
    status: done.status,
    stdout: done.stdout,
  };
}

await describe({
  name: 'verify-published',
  children: [
    it({
      name: 'AGREES on the page a pass publishes and exits 0, the control the findings rest on',
      fn: async () => {
        const { runsDir, } = await publishedRun();

        /**
         What the verifier did.
         */
        const { status, stdout, } = verify({ runsDir, },);
        expect(stdout.includes('1 of 1 pages carry every wording',),).toBe(true,);
        expect(status,).toBe(0,);
      },
    },),
    it({
      name: 'PRINTS a page that disagrees with its artifact and still exits 0, since a run always ships',
      fn: async () => {
        const {
          runsDir,
          pagePath,
        } = await publishedRun();
        await writeFile(
          pagePath,
          (await readFile(
            pagePath,
            'utf8',
          )).replace(
            'The cat has a bowl.',
            'The cat has.',
          ),
        );

        /**
         What the verifier did.
         */
        const { status, stdout, } = verify({ runsDir, },);
        expect(stdout.includes('0 of 1 pages carry every wording',),).toBe(true,);
        expect(status,).toBe(0,);
      },
    },),
    it({
      name: 'PRINTS an artifact with no page and still exits 0, naming the pass that writes it',
      fn: async () => {
        const {
          runsDir,
          pagePath,
        } = await publishedRun();
        await rm(pagePath,);

        /**
         What the verifier did.
         */
        const { status, stdout, } = verify({ runsDir, },);
        expect(stdout.includes(`SETTLED AND NEVER PUBLISHED: ${ENTRY}`,),).toBe(true,);
        expect(stdout.includes('writes it from its artifact',),).toBe(true,);
        expect(status,).toBe(0,);
      },
    },),
    it({
      name: 'EXITS 2 on a run it cannot read at all, the control that the exit code is what is read',
      fn: async () => {
        /**
         A runs directory holding nothing.
         */
        const runsDir = await mkdtemp(join(
          tmpdir(),
          'verify-published-empty-',
        ),);

        expect(verify({ runsDir, },).status,).toBe(2,);
      },
    },),
  ],
},);
