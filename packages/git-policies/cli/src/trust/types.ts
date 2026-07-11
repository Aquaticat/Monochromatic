/**
 * Trust registry schema and service contracts.
 *
 * @module
 */
import type { ValidatedConfig, } from './config-validation.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';

/**
 * Complete unhashed trust identity.
 */
export type TrustIdentity = Readonly<{
  /**
   * Source-qualified filesystem identity.
   */
  filesystemId: string;
  /**
   * Canonical configuration path.
   */
  canonicalConfigPath: string;
}>;
/**
 * Exact source snapshot metadata.
 */
export type TrustSourceRecord = Readonly<{
  /**
   * Canonical live source path.
   */
  canonicalPath: string;
  /**
   * Record-relative source snapshot path.
   */
  snapshotFile: string;
  /**
   * Exact byte length as decimal string.
   */
  size: string;
  /**
   * Source modification time in nanoseconds as decimal string.
   */
  mtimeNanoseconds: string;
}>;
/**
 * Persistent trust record schema version one.
 */
export type TrustRecord = Readonly<{
  /**
   * Registry schema version.
   */
  schemaVersion: 1;
  /**
   * Complete identity encoded by record path.
   */
  identity: TrustIdentity;
  /**
   * Canonical repository root.
   */
  repositoryRoot: string;
  /**
   * Stored executable format.
   */
  format: 'mjs' | 'typescript';
  /**
   * Canonically ordered exact sources.
   */
  sources: readonly TrustSourceRecord[];
  /**
   * Record-relative executable snapshot path.
   */
  executableSnapshotFile: string;
  /**
   * Exact executable byte length as decimal string.
   */
  executableSize: string;
  /**
   * Whether descendant repositories inherit authority.
   */
  recursiveChildren: boolean;
  /**
   * Recursive provenance identities.
   */
  authorizingRoots: readonly TrustIdentity[];
  /**
   * RFC 3339 UTC audit timestamp.
   */
  recordedAt: string;
}>;
/**
 * Live source bytes and metadata collected without execution.
 */
export type TrustCandidate = Readonly<{
  /**
   * Discovered canonical config.
   */
  discovered: DiscoveredConfig;
  /**
   * Complete trust identity.
   */
  identity: TrustIdentity;
  /**
   * Exact source bytes.
   */
  bytes: Uint8Array;
  /**
   * Decimal source byte length.
   */
  size: string;
  /**
   * Decimal nanosecond modification time.
   */
  mtimeNanoseconds: string;
  /**
   * Whether filesystem identity survives host reboot.
   */
  filesystemStable: boolean;
  /**
   * Why only runtime-lifetime identity was available.
   */
  filesystemStabilityReason?: string;
}>;
/**
 * Exact captured TypeScript source.
 */
export type CapturedTrustSource = Readonly<{
  /**
   * Canonical live source path.
   */
  canonicalPath: string;
  /**
   * Exact bytes supplied to builder.
   */
  bytes: Uint8Array;
  /**
   * Decimal byte length.
   */
  size: string;
  /**
   * Decimal nanosecond modification time.
   */
  mtimeNanoseconds: string;
}>;
/**
 * Complete TypeScript bundle candidate before persistence.
 */
export type TypeScriptTrustCandidate = Readonly<{
  /**
   * Entry candidate carrying filesystem identity.
   */
  entry: TrustCandidate;
  /**
   * Canonically ordered exact local source graph.
   */
  sources: readonly CapturedTrustSource[];
  /**
   * One immutable Node ESM bundle.
   */
  executableBytes: Uint8Array;
  /**
   * Bare package specifiers excluded from invalidation.
   */
  barePackageImports: readonly string[];
}>;
/**
 * Stable trust warning code.
 */
export type TrustWarningCode =
  | 'relaxed-entry-malformed'
  | 'relaxed-entry-filesystem-mismatch'
  | 'typescript-package-import-not-invalidated';
/**
 * Prominent trust warning event.
 */
export type TrustWarning = Readonly<{
  /**
   * Stable warning code.
   */
  code: TrustWarningCode;
  /**
   * Safe human-readable warning.
   */
  message: string;
}>;
/**
 * Trust consent and output adapters.
 */
export type TrustConsentAdapters = Readonly<{
  /**
   * Writes human-readable disclosure to stderr boundary.
   */
  disclose: (text: string,) => void;
  /**
   * Requests explicit interactive affirmative response.
   */
  prompt: () => Promise<boolean>;
  /**
   * Supplies audit timestamp.
   */
  now: () => Date;
}>;
/**
 * Loaded trusted configuration ready for policy execution.
 */
export type LoadedTrustedConfig = Readonly<{
  /**
   * Runtime-authoritative validated config.
   */
  validated: ValidatedConfig;
  /**
   * Persistent record used for execution.
   */
  record: TrustRecord;
}>;
/**
 * Trust inspection state.
 */
export type TrustStatus = Readonly<{
  /**
   * Whether repository has a supported config.
   */
  configPresent: boolean;
  /**
   * Whether exact identity has a valid record.
   */
  trusted: boolean;
  /**
   * Whether live bytes equal stored executable snapshot.
   */
  unchanged: boolean;
  /**
   * Canonical config path when present.
   */
  configPath?: string;
  /**
   * Complete filesystem identity when present.
   */
  filesystemId?: string;
  /**
   * Stable status reason.
   */
  reason: 'no-config' | 'untrusted' | 'trusted' | 'changed' | 'corrupt';
}>;
