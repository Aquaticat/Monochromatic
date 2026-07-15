/**
 * Recursive trust authorizer discovery and descendant enrollment. @module
 */
import {
  captureTrustCandidate,
  captureTrustSource,
} from './candidate.ts';
import {
  exactBytesEqual,
  TrustedConfigError,
} from './config-loader.ts';
import {
  isStrictRepositoryDescendant,
  listTrustRecords,
  trustIdentityKey,
  type TrustCatalogEntry,
} from './registry-catalog.ts';
import { readPrivateFile, } from './record-validation.ts';
import { recoverProvenanceTransactions, } from './registry-transaction.ts';
import type {
  TrustCandidate,
  TrustIdentity,
} from './types.ts';

/**
 * Deduplicates identities and sorts canonical path then filesystem ID.
 *
 * @param identities - complete identities
 *
 * @returns deterministic unique identities
 *
 * @example
 * ```ts
 * canonicalAuthorizers([identity]);
 * ```
 */
export function canonicalAuthorizers(identities: readonly TrustIdentity[],): readonly TrustIdentity[] {
  return [...new Map(identities.map(function keyedIdentity(identity,) {
    return [
      trustIdentityKey(identity,),
      identity,
    ] as const;
  },),).values(),]
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

/**
 * Verifies one recursive root remains exactly trusted without executing it.
 *
 * @param entry - recursive root catalog entry
 *
 * @returns unchanged authorizer identity
 */
async function validateRecursiveAuthorizer(entry: TrustCatalogEntry,): Promise<TrustIdentity> {
  /**
   * Fresh exact root candidate or stable changed-root failure.
   */
  const candidate = await (async function captureRootCandidate(): Promise<TrustCandidate> {
    try {
      return await captureTrustCandidate({
        configPath: entry.record
          .identity
          .canonicalConfigPath,
        repositoryRoot: entry.record
          .repositoryRoot,
        format: entry.record
          .format,
      },);
    }
    catch (error: unknown) {
      throw new TrustedConfigError(
        'config-changed',
        `Recursive root is unavailable or changed: ${entry.record
          .repositoryRoot}`,
        { cause: error, },
      );
    }
  })();
  /**
   * Exact source agreement for each record format.
   */
  const sourcesUnchanged = entry.record
    .format
    === 'mjs'
    ? exactBytesEqual({
      left: candidate.bytes,
      right: await readPrivateFile(`${entry.directory}/${entry.record
        .executableSnapshotFile}`,),
    },)
    : (await Promise.all(entry.record
      .sources
      .map(async function sourceUnchanged(source,) {
      /**
       * Exact live tracked source bytes.
       */
      const liveBytes = source.canonicalPath
        === candidate.discovered
        .configPath
        ? candidate.bytes
        : (await captureTrustSource(source.canonicalPath,)).bytes;
      /**
       * Exact private tracked source snapshot.
       */
      const snapshot = await readPrivateFile(`${entry.directory}/${source.snapshotFile}`,);
      return exactBytesEqual({
        left: liveBytes,
        right: snapshot,
      });
    },),)).every(function sourceMatches(matches,) { return matches; },);
  if ((trustIdentityKey(candidate.identity,) !== trustIdentityKey(entry.record
    .identity,)) || (!sourcesUnchanged)) {
    throw new TrustedConfigError(
      'config-changed',
      `Recursive root bytes changed: ${entry.record
        .repositoryRoot}`,
    );
  }
  return entry.record
    .identity;
}

/**
 * Finds only unchanged recursive roots covering descendant.
 *
 * @param entries - installed catalog
 *
 * @param repositoryRoot - candidate descendant root
 *
 * @returns exact active authorizer identities
 *
 * @example
 * ```ts
 * await activeRecursiveAuthorizers({ entries, repositoryRoot });
 * ```
 */
export async function activeRecursiveAuthorizers({
  entries,
  repositoryRoot,
}: Readonly<{
  entries: readonly TrustCatalogEntry[];
  repositoryRoot: string;
}>,): Promise<readonly TrustIdentity[]> {
  /**
   * Covering recursive roots before exact validation.
   */
  const authorizers = entries.filter(function coversDescendant(entry,) {
    return entry.record
      .recursiveChildren
      && isStrictRepositoryDescendant({
      ancestor: entry.record
        .repositoryRoot,
      descendant: repositoryRoot,
    },);
  },);
  return await Promise.all(authorizers.map(validateRecursiveAuthorizer,));
}

/**
 * Finds inherited roots plus explicit self-authorizer.
 *
 * @param registryRoot - complete private registry root
 *
 * @param candidate - exact explicit candidate
 *
 * @returns deterministic explicit and inherited provenance
 *
 * @example
 * ```ts
 * await explicitAuthorizers({ registryRoot, candidate });
 * ```
 */
export async function explicitAuthorizers({
  registryRoot,
  candidate,
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
}>,): Promise<readonly TrustIdentity[]> {
  await recoverProvenanceTransactions({ registryRoot, },);
  /**
   * Every currently installed record.
   */
  const entries = await listTrustRecords({ registryRoot, },);
  return canonicalAuthorizers([
    candidate.identity,
    ...await activeRecursiveAuthorizers({
      entries,
      repositoryRoot: candidate.discovered
        .repositoryRoot,
    },),
  ],);
}
