/**
 * Trusted config loading, inspection, and recursive revocation. @module
 */
import {
  captureTrustCandidate,
  captureTrustSource,
} from './candidate.ts';
import {
  exactBytesEqual,
  loadStrictMjs,
  loadStrictTypeScript,
  TrustedConfigError,
} from './config-loader.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { readPrivateFile, } from './record-validation.ts';
import { listTrustRecords, } from './registry-catalog.ts';
import { recordDirectory, } from './registry-path.ts';
import { isMissingPath, } from './registry-io.ts';
import { loadRecord, } from './registry-storage.ts';
import { loadRelaxedConfig, } from './relaxed-loader.ts';
import { relaxedPathMatches, } from './relaxed-paths.ts';
import {
  autoEnrollRecursiveConfig,
  RECURSIVE_TRUST_ABSENT,
} from './recursive-enrollment.ts';
import {
  revokeRecursiveTrust,
  type RecursiveUntrustResult,
} from './recursive-revocation.ts';
import { recoverProvenanceTransactions, } from './registry-transaction.ts';
import { trustMjs as explicitMjsTrust, } from './explicit-trust.ts';
import { trustTypeScript as explicitTypeScriptTrust, } from './explicit-typescript-trust.ts';
import type {
  LoadedTrustedConfig,
  TrustConsentAdapters,
  TrustRecord,
  TrustStatus,
  TrustWarning,
} from './types.ts';

export { trustMjs, } from './explicit-trust.ts';
export { trustTypeScript, } from './explicit-typescript-trust.ts';
export type {
  TrustConsentAdapters,
  TrustConsentOutcome,
} from './types.ts';

/**
 * Explicitly trusts discovered MJS or TypeScript configuration.
 *
 * @param discovered - canonical discovered config
 *
 * @param registryRoot - injected or account-derived root
 *
 * @param yes - explicit noninteractive approval
 *
 * @param adapters - consent effects
 *
 * @returns installed trusted config
 *
 * @example
 * ```ts
 * await trustConfig({ discovered, registryRoot, yes: true, adapters });
 * ```
 */
export async function trustConfig({
  discovered,
  registryRoot,
  yes,
  adapters,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
  yes: boolean;
  adapters: TrustConsentAdapters;
}>,): Promise<LoadedTrustedConfig> {
  return discovered.format === 'mjs'
    ? await explicitMjsTrust({
      discovered,
      registryRoot,
      yes,
      adapters,
    },)
    : await explicitTypeScriptTrust({
      discovered,
      registryRoot,
      yes,
      adapters,
    },);
}

/**
 * Compares every tracked TypeScript source without execution.
 *
 * @param recordDirectoryPath - exact record directory
 *
 * @param candidateBytes - exact live entry bytes
 *
 * @param configPath - canonical entry path
 *
 * @param record - validated TypeScript record
 *
 * @returns whether every tracked source exactly matches
 */
async function typeScriptSourcesUnchanged({
  recordDirectoryPath,
  candidateBytes,
  configPath,
  record,
}: Readonly<{
  recordDirectoryPath: string;
  candidateBytes: Uint8Array;
  configPath: string;
  record: TrustRecord;
}>,): Promise<boolean> {
  /**
   * Per-source exact comparisons.
   */
  const comparisons = await Promise.all(record.sources
    .map(async function compareSource(source,) {
    /**
     * Exact live source bytes.
     */
    const liveBytes = source.canonicalPath === configPath
      ? candidateBytes
      : (await captureTrustSource(source.canonicalPath,)).bytes;
    /**
     * Exact private source snapshot.
     */
    const storedBytes = await readPrivateFile(`${recordDirectoryPath}/${source.snapshotFile}`,);
    return exactBytesEqual({
      left: liveBytes,
      right: storedBytes,
    });
  },),);
  return comparisons.every(function unchanged(value,) {
    return value;
  },);
}

/**
 * Ignores optional recursive untrust disclosure.
 *
 * @param text - disclosure intentionally omitted by internal caller
 */
function omitUntrustDisclosure(text: string,): void {
  void text;
}

/**
 * Emits stable prominent relaxed-mode warning JSONL.
 *
 * @param warning - stable safe warning
 */
function emitTrustWarning(warning: TrustWarning,): void {
  console.error(JSON.stringify({
    schemaVersion: 1,
    type: 'trust-warning',
    code: warning.code,
    message: warning.message,
  },),);
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
  relaxedValue = process.env
    .CLI_GIT_NO_PARANOID,
  warn = emitTrustWarning,
}: {
  readonly discovered: DiscoveredConfig;
  readonly registryRoot: string;
  readonly relaxedValue?: string;
  readonly warn?: (warning: TrustWarning,) => void;
},): Promise<LoadedTrustedConfig> {
  await recoverProvenanceTransactions({ registryRoot, },);
  /**
   * Fresh live candidate compared with exact stored bytes.
   */
  const candidate = await captureTrustCandidate(discovered,);
  /**
   * Exact environment grammar match, never an initial trust grant.
   */
  const relaxed = relaxedPathMatches({
    ...relaxedValue === undefined ? {} : { raw: relaxedValue, },
    identity: candidate.identity,
    warn,
  },);
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
    if (relaxed) {
      return await loadRelaxedConfig({
        registryRoot,
        recordDirectory: directory,
        candidate,
        record,
        recordedAt: new Date().toISOString(),
        warn,
      },);
    }
    return record.format === 'mjs'
      ? await loadStrictMjs({
        recordDirectory: directory,
        candidate,
        record,
      },)
      : await loadStrictTypeScript({
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
     * Exact strict source equality without stored execution.
     */
    const unchanged = record.format === 'mjs'
      ? exactBytesEqual({
        left: candidate.bytes,
        right: await readPrivateFile(`${directory}/${record.executableSnapshotFile}`,),
      },)
      : await typeScriptSourcesUnchanged({
        recordDirectoryPath: directory,
        candidateBytes: candidate.bytes,
        configPath: discovered.configPath,
        record,
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
}: {
  readonly discovered: DiscoveredConfig;
  readonly registryRoot: string;
  readonly disclose?: TrustConsentAdapters['disclose'];
},): Promise<RecursiveUntrustResult> {
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
}: {
  readonly repositoryRoot: string;
  readonly registryRoot: string;
  readonly disclose?: TrustConsentAdapters['disclose'];
},): Promise<RecursiveUntrustResult> {
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
