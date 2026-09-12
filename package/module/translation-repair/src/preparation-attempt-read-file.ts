import { createHash, } from 'node:crypto';
import { constants, type Stats, } from 'node:fs';
import { lstat, open, } from 'node:fs/promises';
import { join, } from 'node:path';
import { PreparationAttemptError, } from './preparation-attempt-error.ts';
import type { PreparationAttemptFile, } from './preparation-attempt-storage.ts';

//region Bounded-memory verification of fixed namespace files

/** Group and other permission bits are outside the private namespace contract. */
const SHARED_ACCESS_BITS = 0o077;

/** Stream chunks stay bounded independently of serialized root-plan size. */
const NAMESPACE_HASH_CHUNK_BYTES = 65_536;

/**
 * Requires the same private regular file throughout one verification.
 * @param first - pathname observation before opening
 * @param current - descriptor or later pathname observation
 * @returns Whether file identity, metadata and private modes still match
 * @example
 * ```ts
 * const unchanged = sameNamespaceFile({ first, current });
 * ```
 */
function sameNamespaceFile({ first, current, }: { readonly first: Stats; readonly current: Stats; },): boolean {
  return first.isFile() && current.isFile()
    && ((first.mode & SHARED_ACCESS_BITS) === 0) && ((current.mode & SHARED_ACCESS_BITS) === 0)
    && (first.dev === current.dev) && (first.ino === current.ino)
    && (first.size === current.size) && (first.mtimeMs === current.mtimeMs) && (first.ctimeMs === current.ctimeMs);
}

/**
 * Hashes a fixed private namespace file without loading the plan or following a file symlink.
 * Descriptor and pathname observations must still agree after bounded stream reading.
 * @param dir - independently selected attempt directory
 * @param file - fixed namespace filename
 * @param expectedBytes - known marker length, checked before reading its contents
 * @returns Raw-byte digest and length for comparison with independent expectations
 * @throws PreparationAttemptError when the file is missing, indirect, public, changing or unreadable
 * @example
 * ```ts
 * const observed = await hashPreparationAttemptFile({ dir, file: 'root-plan.json' });
 * ```
 */
export async function hashPreparationAttemptFile({ dir, file, expectedBytes, }: {
  readonly dir: string;
  readonly file: PreparationAttemptFile;
  readonly expectedBytes?: number;
},): Promise<{ readonly digest: string; readonly bytes: number; }> {
  /** Fixed filename chooses only a diagnostic family, never arbitrary record access. */
  const operation = file === 'root-plan.json' ? 'read-plan' : 'read-identity';
  if ((file !== 'root-plan.json') && (file !== 'attempt.json'))
    throw new PreparationAttemptError({ operation: 'file-name', dir, },);
  try {
    /** Path remains scoped to one fixed namespace file. */
    const path = join(dir, file,);
    /** lstat rejects indirection before any content read, including platforms without O_NOFOLLOW. */
    const before = await lstat(path,);
    if ((!before.isFile()) || ((before.mode & SHARED_ACCESS_BITS) !== 0)
      || (!Number.isSafeInteger(before.size,)) || (before.size < 0)
      || ((expectedBytes !== undefined) && (before.size !== expectedBytes)))
      throw new PreparationAttemptError({ operation, dir, },);
    /** Native no-follow support augments pre/post descriptor identity checks where available. */
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
    /** The descriptor remains owned until stream completion and final identity checks. */
    await using handle = await open(path, flags,);
    if (!sameNamespaceFile({ first: before, current: await handle.stat(), },))
      throw new PreparationAttemptError({ operation, dir, },);
    /** Hashes actual bytes rather than a possibly lossy decoded string. */
    const digest = createHash('sha256',);
    /** Measured stream length must equal the initial finite file extent. */
    let bytes = 0;
    if (before.size > 0) {
      /** The end bound prevents a concurrently growing file from extending this read indefinitely. */
      const stream = handle.createReadStream({ autoClose: false, start: 0, end: before.size - 1, highWaterMark: NAMESPACE_HASH_CHUNK_BYTES, },);
      for await (const chunk of stream as AsyncIterable<unknown>) {
        if (!Buffer.isBuffer(chunk,))
          throw new PreparationAttemptError({ operation, dir, },);
        bytes += chunk.length;
        digest.update(chunk,);
      }
    }
    if ((bytes !== before.size)
      || (!sameNamespaceFile({ first: before, current: await handle.stat(), },))
      || (!sameNamespaceFile({ first: before, current: await lstat(path,), },)))
      throw new PreparationAttemptError({ operation, dir, },);
    return { digest: digest.digest('hex',), bytes, };
  }
  catch (error) {
    if (error instanceof PreparationAttemptError)
      throw error;
    throw new PreparationAttemptError({ operation, dir, cause: error, },);
  }
}

//endregion Bounded-memory verification of fixed namespace files
