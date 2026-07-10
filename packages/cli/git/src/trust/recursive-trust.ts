/**
 * Recursive trust authorizer discovery and descendant enrollment. @module
 */
import { captureTrustCandidate, } from './candidate.ts';
import {
  executeStoredConfig,
  exactBytesEqual,
  TrustedConfigError,
} from './config-loader.ts';
import type { ValidatedConfig, } from './config-validation.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { validateMjs, } from './mjs-validator.ts';
import {
  isStrictRepositoryDescendant,
  listTrustRecords,
  trustIdentityKey,
  type TrustCatalogEntry,
} from './registry-catalog.ts';
import { readPrivateFile, } from './record-validation.ts';
import { acquireRecursiveRegistryLock, } from './registry-recursive-lock.ts';
import { prepareMjsRecord, } from './registry-storage.ts';
import { recoverProvenanceTransactions, } from './registry-transaction.ts';
import type {
  LoadedTrustedConfig,
  TrustCandidate,
  TrustIdentity,
} from './types.ts';

/**
 * No recursive root authorizes candidate.
 */
export const RECURSIVE_TRUST_ABSENT: unique symbol = Symbol('no RECURSIVE_ROOT authorizes candidate config',);

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
  if (entry.record
    .format
    !== 'mjs')
    throw new TrustedConfigError(
      'trust-failed',
      'TypeScript recursive trust requires issue #347.',
    );
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
        format: 'mjs',
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
   * Exact stored recursive-root snapshot.
   */
  const snapshot = await readPrivateFile(`${entry.directory}/${entry.record
    .executableSnapshotFile}`,);
  if ((trustIdentityKey(candidate.identity,) !== trustIdentityKey(entry.record
    .identity,))
    || (!exactBytesEqual({
      left: candidate.bytes,
      right: snapshot,
    }))) {
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
 */
async function activeRecursiveAuthorizers({
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

/**
 * Executes candidate from temporary private state without persistence.
 *
 * @param registryRoot - complete private registry root
 *
 * @param candidate - exact descendant candidate
 *
 * @param authorizingRoots - inherited roots
 *
 * @param recordedAt - audit timestamp
 *
 * @returns runtime-validated config
 */
async function validatePrivateCandidate({
  registryRoot,
  candidate,
  authorizingRoots,
  recordedAt,
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
  authorizingRoots: readonly TrustIdentity[];
  recordedAt: string;
}>,): Promise<ValidatedConfig> {
  /**
   * Disposable private validation record.
   */
  await using prepared = await prepareMjsRecord({
    registryRoot,
    candidate,
    recordedAt,
    authorizingRoots,
  },);
  return await executeStoredConfig(prepared.executablePath,);
}

/**
 * Auto-enrolls exact descendant under every current recursive root.
 *
 * @param discovered - canonical descendant config
 *
 * @param registryRoot - complete private registry root
 *
 * @param recordedAt - audit timestamp
 *
 * @returns loaded config or absence when no root authorizes it
 *
 * @example
 * ```ts
 * await autoEnrollRecursiveConfig({ discovered, registryRoot, recordedAt });
 * ```
 */
export async function autoEnrollRecursiveConfig({
  discovered,
  registryRoot,
  recordedAt,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
  recordedAt: string;
}>,): Promise<LoadedTrustedConfig | typeof RECURSIVE_TRUST_ABSENT> {
  if (discovered.format !== 'mjs')
    return RECURSIVE_TRUST_ABSENT;
  /**
   * Registry-wide lock serializes descendant enrollment and revocation.
   */
  await using recursiveLock = await acquireRecursiveRegistryLock({ registryRoot, },);
  await recoverProvenanceTransactions({ registryRoot, },);
  /**
   * Exact live descendant candidate.
   */
  const candidate = await captureTrustCandidate(discovered,);
  validateMjs({
    bytes: candidate.bytes,
    sourceName: discovered.configPath,
  },);
  /**
   * Every currently installed record.
   */
  const entries = await listTrustRecords({ registryRoot, },);
  /**
   * Every recursive root covering descendant across filesystems.
   */
  const authorizingRoots = canonicalAuthorizers(await activeRecursiveAuthorizers({
    entries,
    repositoryRoot: discovered.repositoryRoot,
  },),);
  if (authorizingRoots.length === 0)
    return RECURSIVE_TRUST_ABSENT;
  /**
   * Config validated from private candidate before record installation.
   */
  const validated = await validatePrivateCandidate({
    registryRoot,
    candidate,
    authorizingRoots,
    recordedAt,
  },);
  /**
   * Final exact descendant record with inherited provenance.
   */
  await using prepared = await prepareMjsRecord({
    registryRoot,
    candidate,
    recordedAt,
    recursiveChildren: validated.recursiveChildren,
    authorizingRoots,
  },);
  await prepared.commit();
  return {
    validated,
    record: prepared.record,
  };
}
