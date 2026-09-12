import { createHash, } from 'node:crypto';
import {
  constants,
  type BigIntStats,
} from 'node:fs';
import {
  lstat,
  open,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';
import { PreparationAttemptError, } from './preparation-attempt-error.ts';
import type { PreparationAttemptFile, } from './preparation-attempt-storage.ts';

//region Bounded verification of fixed namespace files

/**
 * Group and other mode bits are outside the private namespace contract.
 */
const SHARED_ACCESS_BITS = 0o077n;
/**
 * Stream memory stays bounded independently of serialized root-plan size.
 */
const NAMESPACE_HASH_CHUNK_BYTES = 65_536;

/**
 * Requires exact observed file identity and nanosecond metadata throughout one verification.
 * This is observed stability, not a lease against an adversarial concurrent writer.
 *
 * @param first - pathname observation before opening
 *
 * @param current - descriptor or later pathname observation
 *
 * @returns Whether the same regular file and private mode bits were observed
 *
 * @example
 * ```ts
 * const unchanged = sameNamespaceFile({ first, current });
 * ```
 */
function sameNamespaceFile({
  first,
  current,
}: {
  readonly first: BigIntStats;
  readonly current: BigIntStats
},): boolean {
  return first.isFile() && current.isFile()
    && ((first.mode & SHARED_ACCESS_BITS) === 0n)
    && ((current.mode & SHARED_ACCESS_BITS) === 0n)
    && (first.dev === current.dev)
    && (first.ino === current.ino)
    && (first.size === current.size)
    && (first.mtimeNs === current.mtimeNs)
    && (first.ctimeNs === current.ctimeNs);
}

/**
 * Hashes only an independently expected extent of a fixed namespace file, with bounded stream memory.
 * Symbolic file indirection and changed descriptor/path observations are refused.
 *
 * @param dir - independently selected attempt directory
 *
 * @param file - fixed namespace filename
 *
 * @param expectedBytes - independently measured extent, checked before any content read
 *
 * @returns Raw-byte digest and length for independent comparison
 *
 * @throws PreparationAttemptError when extent, mode bits, identity or reading disagrees
 *
 * @example
 * ```ts
 * const observed = await hashPreparationAttemptFile({ dir, file: 'root-plan.json', expectedBytes });
 * ```
 */
export async function hashPreparationAttemptFile({
  dir,
  file,
  expectedBytes,
}: {
  readonly dir: string;
  readonly file: PreparationAttemptFile;
  readonly expectedBytes: number;
},): Promise<{
  readonly digest: string;
  readonly bytes: number
}> {
  /**
   * Fixed filename selects a diagnostic family without arbitrary record access.
   */
  const operation = file === 'root-plan.json' ? 'read-plan' : 'read-identity';
  if ((file !== 'root-plan.json') && (file !== 'attempt.json'))
    throw new PreparationAttemptError({
      operation: 'file-name',
      dir,
    },);
  if ((!Number.isSafeInteger(expectedBytes,)) || (expectedBytes < 0))
    throw new PreparationAttemptError({
      operation,
      dir,
    },);
  try {
    /**
     * Absolute path is pinned before the first await.
     */
    const path = join(
      resolve(dir,),
      file,
    );
    /**
     * Exact inode and nanosecond values avoid lossy numeric metadata comparisons.
     */
    const before = await lstat(
      path,
      { bigint: true, },
    );
    if ((!before.isFile()) || ((before.mode & SHARED_ACCESS_BITS) !== 0n)
      || (before.size !== BigInt(expectedBytes,)))
      throw new PreparationAttemptError({
        operation,
        dir,
      },);
    /**
     * Native no-follow support augments descriptor/path checks where the flag exists.
     */
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
    /**
     * The descriptor remains owned through stream completion and final checks.
     */
    await using handle = await open(
      path,
      flags,
    );
    if (!sameNamespaceFile({
      first: before,
      current: await handle.stat({ bigint: true, },),
    },))
      throw new PreparationAttemptError({
        operation,
        dir,
      },);
    /**
     * Hash actual bytes without lossy text decoding or whole-plan allocation.
     */
    const digest = createHash('sha256',);
    /**
     * Stream consumption must equal the independently expected extent.
     */
    let bytes = 0;
    if (expectedBytes > 0) {
      /**
       * Appending cannot extend this stream beyond its registered extent.
       */
      const stream = handle.createReadStream({
        autoClose: false,
        start: 0,
        end: expectedBytes - 1,
        highWaterMark: NAMESPACE_HASH_CHUNK_BYTES,
      },);
      for await (const chunk of stream as AsyncIterable<unknown>) {
        if (!Buffer.isBuffer(chunk,))
          throw new PreparationAttemptError({
            operation,
            dir,
          },);
        bytes += chunk.length;
        digest.update(chunk,);
      }
    }
    if ((bytes !== expectedBytes)
      || (!sameNamespaceFile({
        first: before,
        current: await handle.stat({ bigint: true, },),
      },))
      || (!sameNamespaceFile({
        first: before,
        current: await lstat(
          path,
          { bigint: true, },
        ),
      },)))
      throw new PreparationAttemptError({
        operation,
        dir,
      },);
    return {
      digest: digest.digest('hex',),
      bytes,
    };
  }
  catch (error) {
    if (error instanceof PreparationAttemptError)
      throw error;
    throw new PreparationAttemptError({
      operation,
      dir,
      cause: error,
    },);
  }
}

//endregion Bounded verification of fixed namespace files
