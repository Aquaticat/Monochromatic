/**
 * Installed trust-record catalog and ancestry queries. @module
 */
import type { Dirent, } from 'node:fs';
import {
  lstat,
  readdir,
} from 'node:fs/promises';
import {
  isAbsolute,
  join,
  relative,
} from 'node:path';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { readRecord, } from './record-validation.ts';
import {
  assertSafeRegistryDirectory,
  isMissingPath,
  TrustStorageError,
} from './registry-io.ts';
import type {
  TrustIdentity,
  TrustRecord,
} from './types.ts';

/**
 * One validated installed catalog entry.
 */
export type TrustCatalogEntry = Readonly<{
  /**
   * Exact record directory.
   */
  directory: string;
  /**
   * Runtime-validated record.
   */
  record: TrustRecord;
}>;

/**
 * Creates exact identity comparison key.
 *
 * @param identity - complete trust identity
 *
 * @returns collision-free in-memory comparison key
 *
 * @example
 * ```ts
 * trustIdentityKey(identity);
 * ```
 */
export function trustIdentityKey(identity: TrustIdentity,): string {
  return `${identity.filesystemId
    .length}:${identity.filesystemId}${identity.canonicalConfigPath}`;
}

/**
 * Reports strict component-aware repository ancestry.
 *
 * @param ancestor - candidate canonical ancestor root
 *
 * @param descendant - candidate canonical descendant root
 *
 * @returns whether descendant is strictly beneath ancestor
 *
 * @example
 * ```ts
 * isStrictRepositoryDescendant({ ancestor: '/repo', descendant: '/repo/child' });
 * ```
 */
export function isStrictRepositoryDescendant({
  ancestor,
  descendant,
}: Readonly<{
  ancestor: string;
  descendant: string;
}>,): boolean {
  /**
   * Native relative path from candidate root.
   */
  const relation = relative(
    ancestor,
    descendant,
  );
  return (relation !== '')
    && (!isAbsolute(relation,))
    && (relation !== '..')
    && (!relation.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`,));
}

/**
 * Walks registry-owned directories until installed record boundary.
 *
 * @param registryRoot - complete private registry root
 *
 * @param directory - current catalog directory
 *
 * @returns validated installed records
 */
async function walkCatalog({
  registryRoot,
  directory,
}: Readonly<{
  registryRoot: string;
  directory: string;
}>,): Promise<readonly TrustCatalogEntry[]> {
  await assertSafeRegistryDirectory({
    registryRoot,
    targetDirectory: directory,
  },);
  /**
   * Current directory children without following links.
   */
  const entries = await readdir(
    directory,
    { withFileTypes: true, },
  );
  if (entries.some(function isRecordFile(entry: ForeignBorrowed<Dirent>,) {
    return (entry.name === 'record.json') && entry.isFile();
  },)) {
    return [{
      directory,
      record: await readRecord({
        registryRoot,
        directory,
      },),
    },];
  }
  return (await Promise.all(entries
    .filter(function isCatalogDirectory(entry: ForeignBorrowed<Dirent>,) {
      return entry.isDirectory() && (!entry.isSymbolicLink())
        && (!entry.name
          .includes('.tmp-'))
        && (!entry.name
          .includes('.old-'))
        && (!entry.name
          .includes('.removed-'))
        && (!entry.name
          .endsWith('.lock'));
    },)
    .map(async function walkChild(entry: ForeignBorrowed<Dirent>,) {
      /**
       * Child path validated before recursive traversal.
       */
      const child = join(
        directory,
        entry.name,
      );
      /**
       * Final child metadata rejects reparse substitution after readdir.
       */
      const metadata = await lstat(child,);
      if ((!metadata.isDirectory()) || metadata.isSymbolicLink())
        throw new TrustStorageError(`Unsafe trust catalog component: ${child}`,);
      return await walkCatalog({
        registryRoot,
        directory: child,
      },);
    },)))
    .flat();
}

/**
 * Lists every validated installed trust record.
 *
 * @param registryRoot - complete private registry root
 *
 * @returns catalog entries in deterministic identity order
 *
 * @example
 * ```ts
 * await listTrustRecords({ registryRoot: '/private/trust/v1' });
 * ```
 */
export async function listTrustRecords({
  registryRoot,
}: Readonly<{
  registryRoot: string;
}>,): Promise<readonly TrustCatalogEntry[]> {
  /**
   * Registry record hierarchy root.
   */
  const recordsRoot = join(
    registryRoot,
    'records',
  );
  try {
    return (await walkCatalog({
      registryRoot,
      directory: recordsRoot,
    },))
      .toSorted(function byIdentity(
        left,
        right,
      ) {
        return trustIdentityKey(left.record
          .identity,)
          .localeCompare(
            trustIdentityKey(right.record
              .identity,),
            'en',
          );
      },);
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return [];
    throw error;
  }
}

/**
 * Finds recursive roots authorizing one strict descendant repository.
 *
 * @param entries - validated installed records
 *
 * @param repositoryRoot - descendant canonical repository root
 *
 * @returns authorizer identities in canonical path order
 *
 * @example
 * ```ts
 * recursiveAuthorizers({ entries, repositoryRoot: '/repo/child' });
 * ```
 */
export function recursiveAuthorizers({
  entries,
  repositoryRoot,
}: Readonly<{
  entries: readonly TrustCatalogEntry[];
  repositoryRoot: string;
}>,): readonly TrustIdentity[] {
  return entries
    .filter(function authorizesDescendant(entry,) {
      return entry.record
        .recursiveChildren
        && isStrictRepositoryDescendant({
        ancestor: entry.record
          .repositoryRoot,
        descendant: repositoryRoot,
      },);
    },)
    .map(function authorizerIdentity(entry,) {
      return entry.record
        .identity;
    },)
    .toSorted(function byCanonicalPath(
      left,
      right,
    ) {
      if (left.canonicalConfigPath < right.canonicalConfigPath)
        return -1;
      if (left.canonicalConfigPath > right.canonicalConfigPath)
        return 1;
      if (left.filesystemId < right.filesystemId)
        return -1;
      return left.filesystemId > right.filesystemId ? 1 : 0;
    },);
}
