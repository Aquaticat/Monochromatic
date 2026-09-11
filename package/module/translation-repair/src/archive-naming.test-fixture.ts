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
import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts/resolve-git.ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import spawn from 'nano-spawn';
import {
  type ArchiveUseKind,
  type CorpusPin,
  foldCarriageReturns,
  hashContent,
  type InitialArchiveUse,
  parseDocument,
  passArchiveText,
} from '../dist/final/node/index.mjs';

//region Disposable history fixtures
// Native Git writes only invented content inside individually owned repositories.

/**
 * Fixture logger used by the same archive normalizer as production.
 */
const l = tagged({ tag: 'archive-naming-fixture', },);
/**
 * Native executable, never the current repository's command-policy wrapper.
 */
const REAL_GIT = await resolveGit();
/**
 * Preparation electorate used to distinguish naming quorum from pair agreement.
 */
const ROSTER_SIZE = 11;
/**
 * Exact-half quorum rounded up for this fixture's configured electorate.
 */
const SUPPORTING_READERS = 6;
/**
 * Invented entry path shared by ordinary fixtures.
 */
export const ARCHIVE_PATH = 'people/starlit-cat/page.en.md';
/**
 * Invented prior reference, without any licensed corpus text.
 */
export const BEFORE_ARCHIVE = 'She joined 星猫亭.\n';
/**
 * Invented current reference whose entire markup is replaced in history.
 */
export const AFTER_ARCHIVE = 'She joined *Starlit Paws*.\n';
/**
 * Whole marked occurrence used by default controls.
 */
export const NAME_QUOTE = '*Starlit Paws*';

/**
 * Runs native Git hermetically inside a disposable fixture.
 *
 * @param cloneDir - owned fixture directory
 *
 * @param args - literal Git arguments
 *
 * @returns Captured metadata without Git's final output newline
 *
 * @example
 * ```ts
 * const sha = await namingFixtureGit({ cloneDir, args: ['rev-parse', 'HEAD'] });
 * ```
 */
export async function namingFixtureGit({
  cloneDir,
  args,
}: {
  readonly cloneDir: string;
  readonly args: readonly string[];
},): Promise<string> {
  /**
   * Metadata-only command result.
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
 * Commits one invented archive version at its literal path.
 *
 * @param cloneDir - owned fixture repository
 *
 * @param relPath - archive path inside the fixture
 *
 * @param text - next invented archive snapshot
 *
 * @returns Commit containing that snapshot
 *
 * @example
 * ```ts
 * const sha = await commitNamingArchive({ cloneDir, relPath: ARCHIVE_PATH, text: AFTER_ARCHIVE });
 * ```
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
   * Location of the fixture's next archive version.
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
 * Creates a pinned two-version archive and exposes its owned repository for controls.
 *
 * @param before - invented predecessor
 *
 * @param after - invented current snapshot
 *
 * @param relPath - literal path, including unusual-path controls
 *
 * @returns Fixture with complete cleanup and immutable current pin
 *
 * @example
 * ```ts
 * await using fixture = await makeNamingArchive({});
 * ```
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
   * Individually disposable repository; no user/shared Git state is mutated.
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
   * Sole predecessor of the naming revision.
   */
  const parentCommit = await commitNamingArchive({
    cloneDir,
    relPath,
    text: before,
  },);
  /**
   * Pinned current naming revision.
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

/**
 * Anchors an invented observation using production parsing and hashing.
 *
 * @param archiveText - immutable normalized fixture archive
 *
 * @param quotedText - exact occurrence to classify
 *
 * @param kind - chosen use, including non-reference controls
 *
 * @returns Observation supported by the configured preparation quorum
 *
 * @example
 * ```ts
 * const use = namingUse({ archiveText: AFTER_ARCHIVE });
 * ```
 */
export function namingUse({
  archiveText,
  quotedText = NAME_QUOTE,
  kind = 'group-reference-name',
}: {
  readonly archiveText: string;
  readonly quotedText?: string;
  readonly kind?: ArchiveUseKind;
},): InitialArchiveUse {
  /**
   * Full parsed initial archive carrying absolute offsets.
   */
  const document = parseDocument({ text: archiveText, },);
  /**
   * Exact fixture occurrence, which every ballot will classify.
   */
  const startOffset = archiveText.indexOf(quotedText,);
  /**
   * Exclusive end of the complete occurrence.
   */
  const endOffset = startOffset + quotedText.length;
  /**
   * Containing block makes the fixture satisfy production anchor identity.
   */
  const node = nonNullishOrThrow(document.nodes
    .find(function contains(candidate,): boolean {
    return (startOffset >= candidate.startOffset) && (endOffset <= candidate.endOffset);
  },),);
  /**
   * Original electorate, retaining silent reader identities.
   */
  const configuredModelIds = Array.from(
    { length: ROSTER_SIZE, },
    function reader(
      _value,
      index,
    ): string {
    return `reader-${String(index,)}`;
  },
  );
  return {
    archiveHash: hashContent({ content: archiveText, },),
    anchor: {
      nodeId: node.id,
      nodeHash: node.contentHash,
      startOffset,
      endOffset,
      quotedText,
    },
    configuredModelIds,
    ballots: configuredModelIds.slice(
      0,
      SUPPORTING_READERS,
    )
      .map(function ballot(modelId,) {
      return {
        modelId,
        kind,
      };
    },),
  };
}

//endregion Initial use fixtures
