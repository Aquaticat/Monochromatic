import type { BigIntStats, } from 'node:fs';
import { lstat, } from 'node:fs/promises';
import { resolve, } from 'node:path';
import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import type { PreparationAttemptLocation, } from './create-preparation-attempt.ts';
import { hashContent, } from './document-node.ts';
import { PreparationAttemptError, } from './preparation-attempt-error.ts';
import { validPreparationAttemptIdentity, } from './preparation-attempt-identity.ts';
import { hashPreparationAttemptFile, } from './preparation-attempt-read-file.ts';

//region Independent preparation namespace verification

/** Group and other mode bits are outside the private namespace contract. */
const SHARED_DIRECTORY_BITS = 0o077n;

/**
 * Checks observed directory identity without requiring that future phase files never be added.
 * @param first - initial directory observation
 * @param current - later pathname observation
 * @returns Whether exact inode/device identity and private mode bits still match
 * @example
 * ```ts
 * const stable = sameAttemptDirectory({ first, current });
 * ```
 */
function sameAttemptDirectory({ first, current, }: { readonly first: BigIntStats; readonly current: BigIntStats; },): boolean {
  return first.isDirectory() && current.isDirectory()
    && ((first.mode & SHARED_DIRECTORY_BITS) === 0n) && ((current.mode & SHARED_DIRECTORY_BITS) === 0n)
    && (first.ino === current.ino) && (first.dev === current.dev);
}

/**
 * Verifies namespace identity against independent expectations without loading the complete plan into memory.
 * Reads are bounded by the independently measured plan extent, not an arbitrary observed file size.
 * Checks establish observed integrity, not a lease against an adversarial concurrent writer or proof of original creation.
 * Root-plan semantics, review approval and acquisition authority remain separate.
 *
 * @param expected - independent directory, canonical identity, exact digest and measured root-plan byte extent
 * @param l - caller logger retaining preparation scope
 * @throws PreparationAttemptError when identity, extent, mode bits or fixed files do not match
 * @example
 * ```ts
 * await verifyPreparationAttempt({ expected: attempt, l });
 * ```
 */
export async function verifyPreparationAttempt({ expected, l, }: { readonly expected: PreparationAttemptLocation; readonly l: Logger; },): Promise<void> {
  /** Snapshot primitive expectations before any asynchronous read. */
  const { dir: requestedDir, attemptId, rootPlanDigest, rootPlanBytes, } = expected;
  /** Verification telemetry never quotes marker or root-plan contents. */
  const pl = tagged({ tag: verifyPreparationAttempt.name, l, },);
  if (((typeof requestedDir) !== 'string') || (requestedDir.trim().length === 0)
    || (!validPreparationAttemptIdentity({ attemptId, rootPlanDigest, rootPlanBytes, },)))
    throw new PreparationAttemptError({ operation: 'identity', dir: requestedDir, },);
  /** Relative caller input cannot drift if another task changes the process cwd. */
  const dir = resolve(requestedDir,);
  pl.debug('checking independent namespace identity and registered private file extents',);
  /** Marker encoding is reconstructed only from the independent expectation. */
  const marker = JSON.stringify({ version: 1, kind: 'preparation-attempt', attemptId, rootPlanDigest, rootPlanBytes, },);
  try {
    /** Final directory component cannot redirect the check to another namespace. */
    const before = await lstat(dir, { bigint: true, },);
    if (!sameAttemptDirectory({ first: before, current: before, },))
      throw new PreparationAttemptError({ operation: 'read-directory', dir, },);
    /** Expected marker size is known before opening its content stream. */
    const identity = await hashPreparationAttemptFile({ dir, file: 'attempt.json', expectedBytes: Buffer.byteLength(marker, 'utf8',), },);
    if ((identity.bytes !== Buffer.byteLength(marker, 'utf8',)) || (identity.digest !== hashContent({ content: marker, },)))
      throw new PreparationAttemptError({ operation: 'read-identity', dir, },);
    /** Exact independently supplied extent caps total root-plan I/O as well as stream memory. */
    const plan = await hashPreparationAttemptFile({ dir, file: 'root-plan.json', expectedBytes: rootPlanBytes, },);
    if (plan.digest !== rootPlanDigest)
      throw new PreparationAttemptError({ operation: 'read-plan', dir, },);
    if (!sameAttemptDirectory({ first: before, current: await lstat(dir, { bigint: true, },), },))
      throw new PreparationAttemptError({ operation: 'read-directory', dir, },);
  }
  catch (error) {
    if (error instanceof PreparationAttemptError)
      throw error;
    throw new PreparationAttemptError({ operation: 'read-directory', dir, cause: error, },);
  }
  pl.info(`verified preparation namespace ${attemptId} without granting phase approval`,);
}

//endregion Independent preparation namespace verification
