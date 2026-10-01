/**
 Throwaway directories for tests that write files, removed when their scope
 ends.

 ONE COPY. Test files that kept their own copy of this helper, under names
 such as `throwawayCacheDir` or `scratchDirectory`, with only the directory
 prefix and the field name on the returned handle differing, now import it
 from here. Helpers that make a directory and never remove it are a different
 behaviour and stay in their files until they gain a disposer of their own.

 @module
 */

import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

/**
 A directory removed with everything in it when its `await using` scope ends.

 @example
 ```ts
 await using scratch = await scratchDir({ prefix: 'whiskers-cache-', },);
 ```
 */
export type ScratchDir = {
  /**
   Absolute path of the fresh directory.
   */
  readonly path: string;

  /**
   Removes the directory and everything under it.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 Makes a fresh directory under the platform temp root.

 @param prefix - start of the directory's name, so a leftover shows which test
 made it

 @returns The directory, removed on scope exit

 @example
 ```ts
 await using scratch = await scratchDir({ prefix: 'whiskers-cache-', },);
 ```
 */
export async function scratchDir({ prefix, }: { readonly prefix: string; },): Promise<ScratchDir> {
  /**
   Fresh directory under the platform temp root.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    prefix,
  ),);
  return {
    path,
    [Symbol.asyncDispose]: async function removeScratch(): Promise<void> {
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
