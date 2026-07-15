/**
 * Installed trust record reads and removals.
 *
 * @module
 */
import {
  mkdir,
  rename,
  rm,
} from 'node:fs/promises';
import { randomUUID, } from 'node:crypto';
import { dirname, } from 'node:path';
import { readRecord, } from './record-validation.ts';
import {
  assertSafeRegistryDirectory,
  DIRECTORY_MODE,
  isMissingPath,
  protectPath,
  syncDirectory,
} from './registry-io.ts';
import { recordDirectory, } from './registry-path.ts';
import type {
  TrustCandidate,
  TrustRecord,
} from './types.ts';

/**
 * Reads exact identity record after path and permission validation.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - live candidate identifying record
 *
 * @returns validated record
 *
 * @example
 * ```ts
 * await loadRecord({ registryRoot, candidate });
 * ```
 */
export async function loadRecord({
  registryRoot,
  candidate,
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
}>,): Promise<TrustRecord> {
  /**
   * Exact identity record directory.
   */
  const directory = recordDirectory({
    registryRoot,
    identity: candidate.identity,
  },);
  await assertSafeRegistryDirectory({
    registryRoot,
    targetDirectory: dirname(directory,),
  },);
  return await readRecord({
    registryRoot,
    directory,
  },);
}

/**
 * Removes exact identity record under exclusive writer lock.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - live candidate identifying record
 *
 * @returns whether a record was removed
 *
 * @example
 * ```ts
 * await removeRecord({ registryRoot, candidate });
 * ```
 */
export async function removeRecord({
  registryRoot,
  candidate,
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
}>,): Promise<boolean> {
  /**
   * Exact identity record directory.
   */
  const directory = recordDirectory({
    registryRoot,
    identity: candidate.identity,
  },);
  /**
   * Parent containing record and lock siblings.
   */
  const parentDirectory = dirname(directory,);
  try {
    await assertSafeRegistryDirectory({
      registryRoot,
      targetDirectory: parentDirectory,
    },);
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
  /**
   * Exclusive writer lock.
   */
  const lockDirectory = `${directory}.lock`;
  await mkdir(
    lockDirectory,
    { mode: DIRECTORY_MODE, },
  );
  await protectPath({
    path: lockDirectory,
    directory: true,
  },);
  /**
   * Atomic removal sibling before recursive deletion.
   */
  const removedDirectory = `${directory}.removed-${randomUUID()}`;
  try {
    await rename(
      directory,
      removedDirectory,
    );
  }
  catch (error: unknown) {
    await rm(
      lockDirectory,
      {
        recursive: true,
        force: true,
      },
    );
    if (isMissingPath(error,))
      return false;
    throw error;
  }
  await syncDirectory(parentDirectory,);
  await rm(
    removedDirectory,
    {
      recursive: true,
      force: true,
    },
  );
  await rm(
    lockDirectory,
    {
      recursive: true,
      force: true,
    },
  );
  return true;
}
