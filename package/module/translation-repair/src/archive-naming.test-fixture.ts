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
import {
  dirname,
  join,
} from 'node:path';
import { resolveRealGit as resolveGit, } from '@monochromatic-dev/git-executable/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import spawn from 'nano-spawn';
import {
  type CorpusPin,
  foldCarriageReturns,
  passArchiveText,
} from '../dist/final/node/index.mjs';

//region Disposable history fixtures
// Native Git writes only invented content inside individually owned repositories.

/**
 Fixture logger used by the same archive normalizer as production.
 */
const l = tagged({ tag: 'archive-naming-fixture', },);
/**
 Native executable, never the current repository's command-policy wrapper.
 */
const REAL_GIT = await resolveGit();
/**
 Exact-half quorum rounded up for this fixture's configured electorate.
 */
const SUPPORTING_READERS = 6;
/**
 Invented entry path shared by ordinary fixtures.
 */
export const ARCHIVE_PATH = 'people/starlit-cat/page.en.md';
/**
 Invented prior reference, without any licensed corpus text.
 */
export const BEFORE_ARCHIVE = 'She joined 星猫亭.\n';
/**
 Invented current reference whose entire markup is replaced in history.
 */
export const AFTER_ARCHIVE = 'She joined *Starlit Paws*.\n';
/**
 Whole marked occurrence used by default controls.
 */
export const NAME_QUOTE = '*Starlit Paws*';

/**
 Runs native Git hermetically inside a disposable fixture.
 
 @param cloneDir - owned fixture directory
 
 @param args - literal Git arguments
 
 @returns Captured metadata without Git's final output newline
 
 @example
 ```ts
 const sha = await namingFixtureGit({ cloneDir, args: ['rev-parse', 'HEAD'] });
 ```
 */
export async function namingFixtureGit({
  cloneDir,
  args,
}: {
  readonly cloneDir: string;
  readonly args: readonly string[];
},): Promise<string> {
  /**
   Metadata-only command result.
   */
  const result = await spawn(
    REAL_GIT,
    [
      '--literal-pathspecs',
      '-C',
      cloneDir,
      '-c',
      `core.hooksPath=${devNull}`,
      '-c',
      'user.name=archive-fixture',
      '-c',
      'user.email=archive-fixture@example.invalid',
      '-c',
      'commit.gpgSign=false',
      ...args,
    ],
    { env: {
      GIT_CONFIG_GLOBAL: devNull,
      GIT_CONFIG_SYSTEM: devNull,
    }, },
  );
  return result.stdout;
}

/**
 Commits one invented archive version at its literal path.
 
 @param cloneDir - owned fixture repository
 
 @param relPath - archive path inside the fixture
 
 @param text - next invented archive snapshot
 
 @returns Commit containing that snapshot
 
 @example
 ```ts
 const sha = await commitNamingArchive({ cloneDir, relPath: ARCHIVE_PATH, text: AFTER_ARCHIVE });
 ```
 */
export async function commitNamingArchive({
  cloneDir,
  relPath,
  text,
}: {
  readonly cloneDir: string;
  readonly relPath: string;
  readonly text: string;
},): Promise<string> {
  /**
   Location of the fixture's next archive version.
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
  await namingFixtureGit({
    cloneDir,
    args: [
      'add',
      '--',
      relPath
    ],
  },);
  await namingFixtureGit({
    cloneDir,
    args: [
      'commit',
      '--message',
      'record invented archive'
    ],
  },);
  return await namingFixtureGit({
    cloneDir,
    args: [
      'rev-parse',
      'HEAD'
    ],
  },);
}

/**
 Creates a pinned two-version archive and exposes its owned repository for controls.
 
 @param before - invented predecessor
 
 @param after - invented current snapshot
 
 @param relPath - literal path, including unusual-path controls
 
 @returns Fixture with complete cleanup and immutable current pin
 
 @example
 ```ts
 await using fixture = await makeNamingArchive({});
 ```
 */
export async function makeNamingArchive({
  before = BEFORE_ARCHIVE,
  after = AFTER_ARCHIVE,
  relPath = ARCHIVE_PATH,
}: {
  readonly before?: string;
  readonly after?: string;
  readonly relPath?: string;
},): Promise<AsyncDisposable & {
  readonly pin: CorpusPin;
  readonly parentCommit: string;
  readonly relPath: string;
  readonly archiveText: string;
}> {
  /**
   Individually disposable repository; no user/shared Git state is mutated.
   */
  const cloneDir = await mkdtemp(join(
    tmpdir(),
    'translation-naming-',
  ),);
  await namingFixtureGit({
    cloneDir,
    args: ['init'],
  },);
  /**
   Sole predecessor of the naming revision.
   */
  const parentCommit = await commitNamingArchive({
    cloneDir,
    relPath,
    text: before,
  },);
  /**
   Pinned current naming revision.
   */
  const commitSha = await commitNamingArchive({
    cloneDir,
    relPath,
    text: after,
  },);
  return {
    pin: {
      cloneDir,
      commitSha,
      gitPath: REAL_GIT,
    },
    parentCommit,
    relPath,
    archiveText: passArchiveText({
      text: foldCarriageReturns({ text: after, },)
        .text,
      l,
    },),
    async [Symbol.asyncDispose](): Promise<void> {
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

//endregion Disposable history fixtures

//region Initial use fixtures
// Fixture observations declare syntactic use only, never correct naming or identity.
