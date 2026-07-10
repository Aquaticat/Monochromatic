/**
 * Trusted config loading, inspection, and recursive revocation. @module
 */
import { captureTrustCandidate, } from './candidate.ts';
import {
  exactBytesEqual,
  loadStrictMjs,
  TrustedConfigError,
} from './config-loader.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { readPrivateFile, } from './record-validation.ts';
import { listTrustRecords, } from './registry-catalog.ts';
import { recordDirectory, } from './registry-path.ts';
import { isMissingPath, } from './registry-io.ts';
import { loadRecord, } from './registry-storage.ts';
import {
  autoEnrollRecursiveConfig,
  RECURSIVE_TRUST_ABSENT,
} from './recursive-trust.ts';
import {
  revokeRecursiveTrust,
  type RecursiveUntrustResult,
} from './recursive-revocation.ts';
import { recoverProvenanceTransactions, } from './registry-transaction.ts';
import type {
  LoadedTrustedConfig,
  TrustConsentAdapters,
  TrustStatus,
} from './types.ts';

export { trustMjs, } from './explicit-trust.ts';
export type { TrustConsentAdapters, } from './types.ts';

/**
 * Ignores optional recursive untrust disclosure.
 *
 * @param text - disclosure intentionally omitted by internal caller
 */
function omitUntrustDisclosure(text: string,): void {
  void text;
}

/**
 * Loads exact trusted record or auto-enrolls authorized descendant.
 *
 * @param discovered - canonical discovered config
 *
 * @param registryRoot - injected or account-derived root
 *
 * @returns validated config executed from stored snapshot
 *
 * @example
 * ```ts
 * await loadTrustedConfig({ discovered, registryRoot });
 * ```
 */
export async function loadTrustedConfig({
  discovered,
  registryRoot,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
}>,): Promise<LoadedTrustedConfig> {
  await recoverProvenanceTransactions({ registryRoot, },);
  /**
   * Fresh live candidate compared with exact stored bytes.
   */
  const candidate = await captureTrustCandidate(discovered,);
  try {
    /**
     * Validated exact-identity record.
     */
    const record = await loadRecord({
      registryRoot,
      candidate,
    },);
    /**
     * Exact persistent record directory.
     */
    const directory = recordDirectory({
      registryRoot,
      identity: candidate.identity,
    },);
    return await loadStrictMjs({
      recordDirectory: directory,
      candidate,
      record,
    },);
  }
  catch (error: unknown) {
    if (!isMissingPath(error,)) {
      if (error instanceof TrustedConfigError)
        throw error;
      throw new TrustedConfigError(
        'trust-failed',
        `Trust record is invalid: ${String(error,)}`,
        { cause: error, },
      );
    }
  }
  /**
   * First descendant enrollment under every current recursive root.
   */
  const enrolled = await autoEnrollRecursiveConfig({
    discovered,
    registryRoot,
    recordedAt: new Date().toISOString(),
  },);
  if (enrolled !== RECURSIVE_TRUST_ABSENT)
    return enrolled;
  throw new TrustedConfigError(
    'config-untrusted',
    'cli-git configuration is not trusted; run `git cli-git trust` after reviewing it.',
  );
}

/**
 * Inspects exact current trust state without executing configuration.
 *
 * @param discovered - canonical discovered config
 *
 * @param registryRoot - injected or account-derived root
 *
 * @returns trust status
 *
 * @example
 * ```ts
 * await inspectTrust({ discovered, registryRoot });
 * ```
 */
export async function inspectTrust({
  discovered,
  registryRoot,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
}>,): Promise<TrustStatus> {
  if (discovered.format !== 'mjs') {
    return {
      configPresent: true,
      trusted: false,
      unchanged: false,
      configPath: discovered.configPath,
      reason: 'typescript-unsupported',
    };
  }
  /**
   * Fresh live candidate inspected without execution.
   */
  const candidate = await captureTrustCandidate(discovered,);
  try {
    await recoverProvenanceTransactions({ registryRoot, },);
    /**
     * Existing validated record.
     */
    const record = await loadRecord({
      registryRoot,
      candidate,
    },);
    /**
     * Exact existing record directory.
     */
    const directory = recordDirectory({
      registryRoot,
      identity: candidate.identity,
    },);
    /**
     * Exact stored executable bytes.
     */
    const snapshotBytes = await readPrivateFile(`${directory}/${record.executableSnapshotFile}`,);
    /**
     * Live-to-stored byte equality.
     */
    const unchanged = exactBytesEqual({
      left: candidate.bytes,
      right: snapshotBytes,
    },);
    return {
      configPresent: true,
      trusted: unchanged,
      unchanged,
      configPath: discovered.configPath,
      filesystemId: candidate.identity
        .filesystemId,
      reason: unchanged ? 'trusted' : 'changed',
    };
  }
  catch (error: unknown) {
    return {
      configPresent: true,
      trusted: false,
      unchanged: false,
      configPath: discovered.configPath,
      filesystemId: candidate.identity
        .filesystemId,
      reason: isMissingPath(error,) ? 'untrusted' : 'corrupt',
    };
  }
}

/**
 * Revokes exact explicit and inherited trust without executing configuration.
 *
 * @param discovered - canonical discovered config
 *
 * @param registryRoot - injected or account-derived root
 *
 * @param disclose - reports affected recursive roots before mutation
 *
 * @returns recursive revocation summary
 *
 * @example
 * ```ts
 * await untrustConfig({ discovered, registryRoot, disclose: console.error });
 * ```
 */
export async function untrustConfig({
  discovered,
  registryRoot,
  disclose = omitUntrustDisclosure,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
  disclose?: TrustConsentAdapters['disclose'];
}>,): Promise<RecursiveUntrustResult> {
  /**
   * Fresh identity candidate used without execution.
   */
  const candidate = await captureTrustCandidate(discovered,);
  return await revokeRecursiveTrust({
    registryRoot,
    identities: [candidate.identity,],
    disclose,
  },);
}

/**
 * Revokes a repository record after its config artifact was removed.
 *
 * @param repositoryRoot - canonical repository root
 *
 * @param registryRoot - complete registry root
 *
 * @param disclose - reports affected recursive roots before mutation
 *
 * @returns recursive revocation summary
 *
 * @example
 * ```ts
 * await untrustRepository({ repositoryRoot, registryRoot, disclose: console.error });
 * ```
 */
export async function untrustRepository({
  repositoryRoot,
  registryRoot,
  disclose = omitUntrustDisclosure,
}: Readonly<{
  repositoryRoot: string;
  registryRoot: string;
  disclose?: TrustConsentAdapters['disclose'];
}>,): Promise<RecursiveUntrustResult> {
  await recoverProvenanceTransactions({ registryRoot, },);
  /**
   * Exact records historically installed for repository root.
   */
  const matches = (await listTrustRecords({ registryRoot, },))
    .filter(function matchesRepository(entry,) {
      return entry.record
        .repositoryRoot
        === repositoryRoot;
    },);
  if (matches.length === 0)
    return {
      removed: false,
      affectedRoots: [],
    };
  return await revokeRecursiveTrust({
    registryRoot,
    identities: matches.map(function matchingIdentity(entry,) {
      return entry.record
        .identity;
    },),
    disclose,
  },);
}
