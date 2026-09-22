/**
 Index copies and installs that keep Git's racy-entry protection (#544).

 Git treats a cached stat entry as racily clean when its mtime is not older than the index file's mtime,
 and re-hashes it. A copied or rewritten index with a fresh mtime makes Git trust stat data captured in the
 same second as a later same-size edit, so `git add` or `git status` can miss that edit. Keeping the source
 index's timestamps preserves the protection at the cost of re-hashing such entries.

 @module
 */
import {
  copyFile,
  type FileHandle,
  stat,
  utimes,
} from 'node:fs/promises';

/**
 Copies an index file and gives the copy the source's access and modification times.

 @param sourcePath - index whose timestamps describe when its stat data was captured

 @param destinationPath - private copy Git will read

 @example
 ```ts
 await copyIndexFile({ sourcePath: '/repo/.git/index', destinationPath: '/repo/.git/cli-git-add-policy-x/index' });
 ```
 */
export async function copyIndexFile({
  sourcePath,
  destinationPath,
}: Readonly<{
  sourcePath: string;
  destinationPath: string;
}>,): Promise<void> {
  await copyFile(
    sourcePath,
    destinationPath,
  );
  /**
   Source timestamps to carry onto the copy.
   */
  const {
    atime,
    mtime,
  } = await stat(sourcePath,);
  await utimes(
    destinationPath,
    atime,
    mtime,
  );
}

/**
 Gives an open file the source index's access and modification times after its bytes were written.

 @param sourcePath - prepared index whose bytes were written into the handle

 @param handle - open file about to be installed as an index

 @example
 ```ts
 await lock.writeFile(bytes);
 await applyIndexTimestamps({ sourcePath: postIndexPath, handle: lock });
 ```
 */
export async function applyIndexTimestamps({
  sourcePath,
  handle,
}: Readonly<{
  sourcePath: string;
  handle: FileHandle;
}>,): Promise<void> {
  /**
   Source timestamps to carry onto the written file.
   */
  const {
    atime,
    mtime,
  } = await stat(sourcePath,);
  await handle.utimes(
    atime,
    mtime,
  );
}
