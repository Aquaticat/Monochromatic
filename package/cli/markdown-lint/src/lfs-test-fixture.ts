/**
 Test-only fixtures for the LFS helpers: a disposable temp directory and a
 disposable repository with `.lfsconfig`, `.gitattributes`, one tracked
 image, one plain file, and a nested Markdown file.

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
import { join, } from 'node:path';

/**
 Disposable temp directory: `path` while in scope, removed on dispose.
 */
export type TempDir = {
  /**
   Realpath of the directory, so relative-path assertions do not trip over
   symlinked temp roots.
   */
  readonly path: string;
  /**
   Remove the directory and everything under it.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 Create a disposable temp directory.

 @param prefix - name prefix for the directory

 @returns disposable directory

 @example
 ```ts
 await using dir = await makeTempDir('lfs-');
 ```
 */
export async function makeTempDir(prefix: string,): Promise<TempDir> {
  /**
   Realpath of the fresh directory.
   */
  const path = await realpath(
    await mkdtemp(join(
      tmpdir(),
      prefix,
    ),),
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
 Bytes of the tracked image fixture.
 */
export const FIXTURE_IMAGE_BYTES: Uint8Array = Buffer.from('image bytes',);

/**
 Object base the fixture `.lfsconfig` declares once its credential is
 stripped.
 */
export const FIXTURE_OBJECT_BASE = 'https://lfs.example';

/**
 Create a disposable repository fixture under a temp directory.

 @returns disposable directory whose `path` is the repository root

 @example
 ```ts
 await using repo = await makeLfsRepo();
 ```
 */
export async function makeLfsRepo(): Promise<TempDir> {
  /**
   Disposable root.
   */
  const dir = await makeTempDir('lfs-repo-',);
  await writeFile(
    join(
      dir.path,
      '.lfsconfig',
    ),
    `[lfs]\n\turl = https://lfs:token@${new URL(FIXTURE_OBJECT_BASE,).host}\n`,
  );
  await writeFile(
    join(
      dir.path,
      '.gitattributes',
    ),
    '*.png filter=lfs diff=lfs merge=lfs -text\n',
  );
  await mkdir(
    join(
      dir.path,
      'pkg',
      'asset',
    ),
    { recursive: true, },
  );
  await writeFile(
    join(
      dir.path,
      'pkg',
      'asset',
      'shot.png',
    ),
    FIXTURE_IMAGE_BYTES,
  );
  await writeFile(
    join(
      dir.path,
      'pkg',
      'asset',
      'plain.svg',
    ),
    '<svg/>',
  );
  await writeFile(
    join(
      dir.path,
      'pkg',
      'README.md',
    ),
    '![shot](asset/shot.png)\n',
  );
  return dir;
}
