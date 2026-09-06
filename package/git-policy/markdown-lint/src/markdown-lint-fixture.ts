/**
 Test-only fixtures: a disposable repository with `.lfsconfig`,
 `.gitattributes`, one LFS-tracked image, and the path of the workspace
 markdown-lint CLI to drive it.

 @module
 */

import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

import type { CandidateFile, } from '@monochromatic-dev/git-policy-api/ts';

/**
 Disposable temp directory: `path` while in scope, removed on dispose.
 */
export type TempDir = Readonly<{
  /**
   Realpath of the directory.
   */
  path: string;
  /**
   Remove the directory and everything under it.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Candidate shape the fixtures produce. `revision` is always a string, so the
 value is assignable to the source contract and to the built package's
 declaration, whose absence sentinel is a distinct unique symbol.
 */
export type FixtureCandidate = Readonly<{
  /**
   Invocation-local candidate identity.
   */
  targetId: string;
  /**
   Repository-relative path.
   */
  path: string;
  /**
   Fixed blob identity.
   */
  revision: string;
  /**
   File mode.
   */
  mode: CandidateFile['mode'];
  /**
   Change kind.
   */
  change: CandidateFile['change'];
  /**
   Lazy bytes.
   */
  bytes: () => Promise<Uint8Array>;
}>;

/**
 Bytes of the tracked image fixture.
 */
export const FIXTURE_IMAGE_BYTES: Uint8Array = Buffer.from('image bytes',);

/**
 Object base the fixture `.lfsconfig` declares once its credential is stripped.
 */
export const FIXTURE_OBJECT_BASE = 'https://lfs.example';

/**
 Command that starts the workspace markdown-lint source entry, resolved from
 this file's location so the fixture repository can live anywhere.
 */
export const MARKDOWN_LINT_COMMAND: readonly string[] = [
  process.execPath,
  resolve(
    import.meta.dirname,
    '..',
    '..',
    '..',
    '..',
    'package',
    'cli',
    'markdown-lint',
    'src',
    'cli.ts',
  ),
];

/**
 Create a disposable repository fixture: `.lfsconfig` pointing at the fixture
 object base, `.gitattributes` routing `*.png` through LFS, and
 `pkg/asset/shot.png` as the tracked image.

 @returns disposable directory whose `path` is the repository root

 @example
 ```ts
 await using repo = await makeLfsRepo();
 ```
 */
export async function makeLfsRepo(): Promise<TempDir> {
  /**
   Fresh root as the OS reported it, possibly through a symlink.
   */
  const created = await mkdtemp(join(
    tmpdir(),
    'markdown-lint-policy-',
  ),);
  /**
   Realpath of the fresh root, so subprocess `cwd` and repo discovery agree.
   */
  const path = await realpath(created,);
  await writeFile(
    join(
      path,
      '.lfsconfig',
    ),
    `[lfs]\n\turl = https://lfs:token@${new URL(FIXTURE_OBJECT_BASE,).host}\n`,
  );
  await writeFile(
    join(
      path,
      '.gitattributes',
    ),
    '*.png filter=lfs diff=lfs merge=lfs -text\n',
  );
  await mkdir(
    join(
      path,
      'pkg',
      'asset',
    ),
    { recursive: true, },
  );
  await writeFile(
    join(
      path,
      'pkg',
      'asset',
      'shot.png',
    ),
    FIXTURE_IMAGE_BYTES,
  );
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 Parameters for {@link candidateOf}.
 */
export type CandidateOfParams = Readonly<{
  /**
   Repository-relative path.
   */
  path: string;
  /**
   Candidate bytes.
   */
  bytes: Uint8Array;
  /**
   Change kind; defaults to `added`.
   */
  change?: CandidateFile['change'];
  /**
   File mode; defaults to `regular`.
   */
  mode?: CandidateFile['mode'];
}>;

/**
 Build one lazy policy candidate.

 @param path - repository-relative path

 @param bytes - candidate bytes

 @param change - change kind

 @param mode - file mode

 @returns candidate fixture with a fixed revision

 @example
 ```ts
 candidateOf({ path: 'pkg/README.md', bytes: new TextEncoder().encode('# Hi\n') });
 ```
 */
export function candidateOf({
  path,
  bytes,
  change = 'added',
  mode = 'regular',
}: CandidateOfParams,): FixtureCandidate {
  return {
    targetId: `target:${path}`,
    path,
    revision: 'fixture0',
    mode,
    change,
    bytes: function loadBytes(): Promise<Uint8Array> {
      return Promise.resolve(bytes,);
    },
  };
}
