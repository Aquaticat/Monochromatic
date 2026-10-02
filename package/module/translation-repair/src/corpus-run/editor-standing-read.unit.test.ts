/**
 Tests for which files `editor-standing-read` counts as artifacts.

 RUN AS AN OPERATOR RUNS IT, since the module exports nothing to call
 directly: every case writes a throwaway archive, runs the built command over
 it, and reads the summary line.

 AN ARTIFACT IS A REGULAR FILE. The census and the scheduler list only regular
 files named `*.json`, and this reader took every such NAME, so a directory
 called `Tabby.json` was read as JSON and reported refused, and a symlink was
 followed to whatever it named and counted a second time (ledger B64). The
 command lists two layouts, an archive's own `artifacts/` directory and an
 archive that is itself the artifacts directory, so each layout has a case.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { spawnSync, } from 'node:child_process';
import {
  mkdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { scratchDirWith, } from '../scratch-dir.test-fixture.ts';

//region Editor standing read listing tests

/**
 Command under test.
 */
const STANDING_COMMAND = 'editor-standing-read';

/**
 Built entry point for {@link STANDING_COMMAND}.
 */
const STANDING_ENTRY = join(
  import.meta.dirname,
  '..',
  '..',
  'dist',
  'final',
  'node',
  `${STANDING_COMMAND}.mjs`,
);

/**
 What the command left on its two streams.
 */
type StandingStreams = {
  /**
   Everything the command wrote to stdout, where the summary line goes.
   */
  readonly stdout: string;

  /**
   Everything the command wrote to stderr, where refusals go.
   */
  readonly stderr: string;
};

/**
 Writes one throwaway archive holding a real artifact, a directory named like
 one, and a symlink named like one.

 @param nested - whether the artifacts sit in the archive's `artifacts/`
 directory, which is what a pass writes, rather than in the archive itself

 @returns Archive path, removed on dispose

 @example
 ```ts
 await using fixture = await throwawayArchive({ nested: true, },);
 ```
 */
async function throwawayArchive(
  { nested, }: { readonly nested: boolean; },
): Promise<AsyncDisposable & { readonly archive: string; }> {
  // Throwaway archive, never a real runs directory.
  return await scratchDirWith({
    prefix: 'editor-standing-read-',
    setup: async function seeded({ path: archive, },): Promise<{ readonly archive: string; }> {
      /**
       Directory the fixture artifacts go into.
       */
      const artifactsDir = nested
        ? join(
          archive,
          'artifacts',
        )
        : archive;

      await mkdir(
        artifactsDir,
        { recursive: true, },
      );
      await writeFile(
        join(
          artifactsDir,
          'Mittens.json',
        ),
        '{}',
        'utf8',
      );
      await mkdir(join(
        artifactsDir,
        'Tabby.json',
      ),);
      await symlink(
        'Mittens.json',
        join(
          artifactsDir,
          'Siamese.json',
        ),
      );

      return { archive, };
    },
  },);
}

/**
 Runs the command over one archive.

 A NON-ZERO EXIT IS THE COMMAND'S OWN VERDICT HERE: it exits 1 when nothing it
 read recorded a judged round, which this fixture never does. `spawnSync`
 reports that status rather than throwing on it.

 @param archive - archive the command reads

 @returns Both streams as the command left them

 @throws Error where the command never started, so no case reads two empty
 streams as a clean report

 @example
 ```ts
 const { stdout, } = standingOver({ archive: fixture.archive, },);
 ```
 */
function standingOver(
  { archive, }: { readonly archive: string; },
): StandingStreams {
  /**
   Command as it finished, or why it never started.
   */
  const finished = spawnSync(
    process.execPath,
    [
      STANDING_ENTRY,
      archive,
    ],
    { encoding: 'utf8', },
  );

  if (finished.error !== undefined)
    throw new Error(
      `the command never started, so nothing here was exercised (${finished.error.name})`,
    );

  return {
    stdout: finished.stdout,
    stderr: finished.stderr,
  };
}

await describe({
  name: STANDING_COMMAND,
  children: [
    it({
      name: 'COUNTS only the regular file in an archive\'s artifacts directory, skipping a directory and a '
        + 'symlink named like an artifact (ledger B64)',
      fn: async () => {
        await using fixture = await throwawayArchive({ nested: true, },);
        const { stdout, stderr, } = standingOver({ archive: fixture.archive, },);
        expect(stdout.includes('archives=1 artifacts=1 ',),).toBe(true,);
        expect(stderr.includes('Tabby.json',),).toBe(false,);
      },
    },),

    it({
      name: 'COUNTS only the regular file in an archive that is itself the artifacts directory (ledger B64)',
      fn: async () => {
        await using fixture = await throwawayArchive({ nested: false, },);
        const { stdout, stderr, } = standingOver({ archive: fixture.archive, },);
        expect(stdout.includes('archives=1 artifacts=1 ',),).toBe(true,);
        expect(stderr.includes('Tabby.json',),).toBe(false,);
      },
    },),
  ],
},);

//endregion Editor standing read listing tests
