/**
 File and pseudoref helpers shared by conclusion-state copying and cleanup.

 @module
 */
import {
  lstat,
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import type { RefStorageFormat, } from '../policy-engine/commit-transaction-capture.ts';
import { runTransactionGit, } from '../policy-engine/commit-transaction-git.ts';
import { isMissingPath, } from '../trust/registry-io.ts';
import { STORE_HELD_PSEUDOREFS, } from './shadow-conclusion-names.ts';

/**
 A conclusion entry or pseudoref does not exist.
 */
export const ENTRY_ABSENT: unique symbol = Symbol('conclusion state file or pseudoref was not present',);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Private directory holding the preparation-time copies.
 */
export const CONCLUSION_COPY_DIRECTORY = 'conclusion';

/**
 Record of the store-held pseudoref values copied at preparation.
 */
export const STORE_RECORD_FILENAME = 'store-held.json';

/**
 Private directory mode.
 */
export const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 Reports whether a path exists without following a final link.

 @param path - candidate path

 @returns whether it exists

 @example
 ```ts
 await pathExists('/repo/.git/sequencer');
 ```
 */
export async function pathExists(path: string,): Promise<boolean> {
  try {
    await lstat(path,);
    return true;
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
}

/**
 Reads a file, or the absence marker when absent.

 @param path - file path

 @returns bytes or absence

 @example
 ```ts
 await readOptional('/repo/.git/MERGE_MSG');
 ```
 */
export async function readOptional(path: string,): Promise<Uint8Array | typeof ENTRY_ABSENT> {
  try {
    return new Uint8Array(await readFile(path,),);
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return ENTRY_ABSENT;
    throw error;
  }
}

/**
 Compares two optional byte arrays.

 @param left - first bytes

 @param right - second bytes

 @returns whether both exist with equal bytes

 @example
 ```ts
 sameBytes({ left: new Uint8Array([1]), right: ENTRY_ABSENT }); // false
 ```
 */
export function sameBytes({
  left,
  right,
}: Readonly<{
  left: Uint8Array | typeof ENTRY_ABSENT;
  right: Uint8Array | typeof ENTRY_ABSENT;
}>,): boolean {
  return (left !== ENTRY_ABSENT) && (right !== ENTRY_ABSENT)
    && (Buffer.compare(
      left,
      right,
    ) === 0);
}

/**
 Resolves a pseudoref in the owning worktree, or the absence marker when absent.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param name - pseudoref

 @returns object ID or absence

 @example
 ```ts
 await resolvePseudoref({ gitPath: '/usr/bin/git', cwd: '/repo', name: 'CHERRY_PICK_HEAD' });
 ```
 */
export async function resolvePseudoref({
  gitPath,
  cwd,
  name,
}: Readonly<{
  gitPath: string;
  cwd: string;
  name: string;
}>,): Promise<string | typeof ENTRY_ABSENT> {
  /**
   Quiet resolution.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      '--quiet',
      name,
    ],
    allowFailure: true,
  },);
  return result.exitCode === 0 ? DECODER.decode(result.stdout,)
    .trim() : ENTRY_ABSENT;
}

/**
 Reports whether a file entry lives in the ref store of this backend.

 @param refFormat - ref storage backend

 @param name - conclusion entry

 @returns whether the entry is store-held

 @example
 ```ts
 isStoreHeld({ refFormat: 'reftable', name: 'AUTO_MERGE' }); // true
 ```
 */
export function isStoreHeld({
  refFormat,
  name,
}: Readonly<{
  refFormat: RefStorageFormat;
  name: string;
}>,): boolean {
  return (refFormat === 'reftable') && STORE_HELD_PSEUDOREFS.has(name,);
}


/**
 Lists regular files under a directory with their relative paths.

 @param root - directory

 @returns relative path to bytes; empty when absent
 */
async function readTree(root: string,): Promise<ReadonlyMap<string, Uint8Array>> {
  if (!(await pathExists(root,)))
    return new Map();
  /**
   Recursive listing.
   */
  const entries = await readdir(
    root,
    {
      recursive: true,
      withFileTypes: true,
    },
  );
  /**
   File entries only.
   */
  const files = entries.filter(function isFile(entry,): boolean {
    return entry.isFile();
  },);
  return new Map(
    await Promise.all(files.map(async function readEntry(entry,): Promise<readonly [
      string,
      Uint8Array
    ]> {
    /**
     Absolute file path.
     */
    const path = join(
      entry.parentPath,
      entry.name,
    );
    return [
      path.slice(root.length,),
      new Uint8Array(await readFile(path,),),
    ];
  },),),
  );
}

/**
 Reports whether two directory trees hold the same files and bytes.

 @param left - first directory

 @param right - second directory

 @returns whether both trees are equal and nonempty

 @example
 ```ts
 await sameTree({ left: '/tx/conclusion/sequencer', right: '/repo/.git/sequencer' });
 ```
 */
export async function sameTree({
  left,
  right,
}: Readonly<{
  left: string;
  right: string;
}>,): Promise<boolean> {
  /**
   Both trees.
   */
  const [leftFiles, rightFiles,] = await Promise.all([
    readTree(left,),
    readTree(right,),
  ],);
  return (leftFiles.size > 0)
    && (leftFiles.size === rightFiles.size)
    && [...leftFiles,].every(function sameEntry([path, bytes,],): boolean {
      return sameBytes({
        left: bytes,
        right: rightFiles.get(path,) ?? ENTRY_ABSENT,
      },);
    },);
}
