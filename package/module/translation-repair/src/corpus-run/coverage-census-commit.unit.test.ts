/**
 Tests what the coverage census asks git of the tree it reads (ledger T8),
 each against a throwaway repository with no global or system git
 configuration: the commit the package's files match, and which sources have
 changed since an earlier census's commit. Names are cat-themed invention.

 @module
 */

import {
  mkdir,
  mkdtempDisposable,
  writeFile,
} from 'node:fs/promises';
import {
  devNull,
  tmpdir,
} from 'node:os';
import { join, } from 'node:path';

import { resolveRealGit, } from '@monochromatic-dev/git-executable/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  packageCommit,
  sourcesEditedSince,
} from '../../dist/final/node/index.mjs';

/**
 Environment that keeps the operator's git configuration out of a throwaway
 repository.
 */
const HERMETIC = {
  env: {
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_SYSTEM: devNull,
  },
};

/**
 A fresh directory removed with its contents when the test's scope ends.

 @returns The directory
 */
async function throwawayRepository() {
  return mkdtempDisposable(join(
    tmpdir(),
    'translation-repair-census-commit-test-',
  ),);
}

/**
 Runs git in a throwaway repository.

 @param directory - repository directory

 @param args - git arguments after `-C <directory>`

 @returns What git printed
 */
async function gitIn({
  directory,
  args,
}: {
  readonly directory: string;
  readonly args: readonly string[];
},) {
  return spawn(
    await resolveRealGit(),
    [
      '-C',
      directory,
      ...args,
    ],
    HERMETIC,
  );
}

/**
 Writes a file under a directory, making its parents.

 @param directory - directory it goes under

 @param path - its path under that directory

 @param text - its contents
 */
async function writeUnder({
  directory,
  path,
  text,
}: {
  readonly directory: string;
  readonly path: string;
  readonly text: string;
},) {
  /**
   Where the file goes.
   */
  const target = join(
    directory,
    path,
  );
  await mkdir(
    join(
      target,
      '..',
    ),
    { recursive: true, },
  );
  await writeFile(
    target,
    text,
  );
}

/**
 Stages everything and commits it.

 @param directory - repository directory

 @param message - commit message
 */
async function commitAll({
  directory,
  message,
}: {
  readonly directory: string;
  readonly message: string;
},) {
  await gitIn({
    directory,
    args: [
      'add',
      '--all',
    ],
  },);
  await gitIn({
    directory,
    args: [
      '-c',
      'user.name=cat',
      '-c',
      'user.email=cat@example.org',
      'commit',
      '--message',
      message,
      '--no-gpg-sign',
    ],
  },);
}

await describe({
  name: packageCommit.name,
  children: [
    it({
      name: 'NAMES THE COMMIT BY NINE CHARACTERS, clean until a file under the package changes',
      fn: async () => {
        await using directory = await throwawayRepository();
        await gitIn({
          directory: directory.path,
          args: ['init',],
        },);
        await writeUnder({
          directory: directory.path,
          path: 'nap.txt',
          text: 'nap\n',
        },);
        await commitAll({
          directory: directory.path,
          message: 'nap',
        },);
        const { stdout: full, } = await gitIn({
          directory: directory.path,
          args: [
            'rev-parse',
            'HEAD',
          ],
        },);
        const committed = await packageCommit({ packageDirectory: directory.path, },);
        expect(committed.head,).toBe(full.slice(
          0,
          9,
        ),);
        expect(committed.clean,).toBe(true,);
        await writeUnder({
          directory: directory.path,
          path: 'nap.txt',
          text: 'purr\n',
        },);
        expect((await packageCommit({ packageDirectory: directory.path, },)).clean,).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: sourcesEditedSince.name,
  children: [
    it({
      name:
        'NAMES THE ASKED SOURCES THAT DIFFER FROM A COMMIT, relative to the package as a census names them: one '
        + 'edited and not committed, one added and committed since, and not one left as it was',
      fn: async () => {
        await using repository = await throwawayRepository();
        await gitIn({
          directory: repository.path,
          args: ['init',],
        },);
        /**
         Package directory, a subdirectory of the repository as in this one.
         */
        const packageDirectory = join(
          repository.path,
          'package',
          'cat',
        );
        await writeUnder({
          directory: packageDirectory,
          path: 'src/nap.ts',
          text: 'export const nap = 1;\n',
        },);
        await writeUnder({
          directory: packageDirectory,
          path: 'src/purr.ts',
          text: 'export const purr = 1;\n',
        },);
        await commitAll({
          directory: repository.path,
          message: 'nap and purr',
        },);
        /**
         Commit an earlier census would record.
         */
        const { head, } = await packageCommit({ packageDirectory, },);
        await writeUnder({
          directory: packageDirectory,
          path: 'src/knead.ts',
          text: 'export const knead = 1;\n',
        },);
        await commitAll({
          directory: repository.path,
          message: 'knead',
        },);
        await writeUnder({
          directory: packageDirectory,
          path: 'src/nap.ts',
          text: '// one more line renumbers the rest of the file\nexport const nap = 1;\n',
        },);
        expect([...await sourcesEditedSince({
          packageDirectory,
          head,
          sources: ['src/nap.ts', 'src/purr.ts', 'src/knead.ts',],
        },),].toSorted(),).toEqual(['src/knead.ts', 'src/nap.ts',],);
      },
    },),
    it({
      name:
        'NAMES EVERY CHANGED FILE UNDER THE PACKAGE when none is asked about, and none outside it, since a census '
        + 'reads the package alone',
      fn: async () => {
        await using repository = await throwawayRepository();
        await gitIn({
          directory: repository.path,
          args: ['init',],
        },);
        /**
         Package directory, a subdirectory of the repository.
         */
        const packageDirectory = join(
          repository.path,
          'package',
          'cat',
        );
        await writeUnder({
          directory: packageDirectory,
          path: 'src/nap.ts',
          text: 'export const nap = 1;\n',
        },);
        await writeUnder({
          directory: packageDirectory,
          path: 'doc/whiskers.md',
          text: '# Whiskers\n',
        },);
        await writeUnder({
          directory: repository.path,
          path: 'README.md',
          text: '# Litter\n',
        },);
        await commitAll({
          directory: repository.path,
          message: 'nap, whiskers and litter',
        },);
        /**
         Commit an earlier census would record.
         */
        const { head, } = await packageCommit({ packageDirectory, },);
        await writeUnder({
          directory: packageDirectory,
          path: 'doc/whiskers.md',
          text: '# Whiskers, groomed\n',
        },);
        await writeUnder({
          directory: repository.path,
          path: 'README.md',
          text: '# Litter, fresh\n',
        },);
        expect([...await sourcesEditedSince({
          packageDirectory,
          head,
          sources: [],
        },),],).toEqual(['doc/whiskers.md',],);
        expect([...await sourcesEditedSince({
          packageDirectory,
          head,
          sources: ['src/nap.ts',],
        },),],).toEqual([],);
      },
    },),
  ],
},);
