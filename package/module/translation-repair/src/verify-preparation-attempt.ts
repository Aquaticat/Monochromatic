import type { Stats, } from 'node:fs';
import { lstat, } from 'node:fs/promises';
import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import type { PreparationAttemptLocation, } from './create-preparation-attempt.ts';
import { hashContent, } from './document-node.ts';
import { PreparationAttemptError, } from './preparation-attempt-error.ts';
import { hashPreparationAttemptFile, } from './preparation-attempt-read-file.ts';

//region Independent preparation namespace verification

/** Group and other access are outside the private namespace contract. */
const SHARED_DIRECTORY_BITS = 0o077;

/**
 * Checks an owned directory identity without requiring that future phase files never be added.
 * @param first - initial directory observation
 * @param current - later pathname observation
 * @returns Whether the same private directory still occupies the expected location
 * @example
 * ```ts
 * const stable = sameAttemptDirectory({ first, current });
 * ```
 */
function sameAttemptDirectory({ first, current, }: { readonly first: Stats; readonly current: Stats; },): boolean {
  return first.isDirectory() && current.isDirectory()
    && ((first.mode & SHARED_DIRECTORY_BITS) === 0) && ((current.mode & SHARED_DIRECTORY_BITS) === 0)
    && (first.ino === current.ino) && (first.dev === current.dev);
}

/**
 * Verifies exact namespace bytes against independent expectations without loading arbitrary plan contents.
 * No values from the stored marker become their own expectations.
 * This checks identity and integrity only, not root-plan semantics, review approval, leases or acquisition authority.
 *
 * @param expected - independently supplied directory, attempt identity and exact root-plan digest
 * @param l - caller logger retaining the reviewed preparation scope
 * @throws PreparationAttemptError when expected identity or private fixed files do not match
 * @example
 * ```ts
 * await verifyPreparationAttempt({ expected: attempt, l });
 * ```
 */
export async function verifyPreparationAttempt({ expected, l, }: { readonly expected: PreparationAttemptLocation; readonly l: Logger; },): Promise<void> {
  /** Copy primitive expectations before asynchronous reads so caller mutation cannot change the check. */
  const { dir, attemptId, rootPlanDigest, } = expected;
  /** Verification telemetry never quotes marker or root-plan contents. */
  const pl = tagged({ tag: verifyPreparationAttempt.name, l, },);
  if ([dir, attemptId, rootPlanDigest].some(function absent(value,): boolean {
    return ((typeof value) !== 'string') || (value.trim().length === 0);
  },))
    throw new PreparationAttemptError({ operation: 'identity', dir, },);
  pl.debug('checking independent namespace identity and exact private plan bytes',);
  /** The stored marker must match this independently reconstructed encoding exactly. */
  const marker = JSON.stringify({ version: 1, kind: 'preparation-attempt', attemptId, rootPlanDigest, },);
  try {
    /** Final directory component cannot redirect the check to another namespace. */
    const before = await lstat(dir,);
    if (!sameAttemptDirectory({ first: before, current: before, },))
      throw new PreparationAttemptError({ operation: 'read-directory', dir, },);
    /** Marker data is hashed, not parsed or echoed on failure. */
    const identity = await hashPreparationAttemptFile({ dir, file: 'attempt.json', expectedBytes: Buffer.byteLength(marker, 'utf8',), },);
    if ((identity.bytes !== Buffer.byteLength(marker, 'utf8',)) || (identity.digest !== hashContent({ content: marker, },)))
      throw new PreparationAttemptError({ operation: 'read-identity', dir, },);
    /** Root-plan hash consumes a bounded stream over its observed file extent. */
    const plan = await hashPreparationAttemptFile({ dir, file: 'root-plan.json', },);
    if (plan.digest !== rootPlanDigest)
      throw new PreparationAttemptError({ operation: 'read-plan', dir, },);
    if (!sameAttemptDirectory({ first: before, current: await lstat(dir,), },))
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
