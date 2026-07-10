/**
 * TypeScript bundle trust record preparation. @module
 */
import { prepareTrustRecord, } from './registry-record-preparation.ts';
import type { PreparedTrustRecord, } from './registry-prepared-record.ts';
import type {
  TrustRecord,
  TypeScriptTrustCandidate,
} from './types.ts';

/**
 * Stored executable bundle path.
 */
const TYPESCRIPT_EXECUTABLE_FILE = 'snapshots/config.mjs';

/**
 * Creates deterministic flat source snapshot name.
 *
 * @param index - canonical source index
 *
 * @returns record-relative private path
 */
function sourceSnapshotFile(index: number,): string {
  return `snapshots/source-${String(index,)}.bin`;
}

/**
 * Builds exact TypeScript persistent record.
 *
 * @param candidate - complete build candidate
 *
 * @param recordedAt - RFC 3339 audit timestamp
 *
 * @param recursiveChildren - persisted descendant authority
 *
 * @param authorizingRoots - explicit and inherited provenance
 *
 * @returns immutable record metadata
 */
function buildTypeScriptRecord({
  candidate,
  recordedAt,
  recursiveChildren,
  authorizingRoots,
}: Readonly<{
  candidate: TypeScriptTrustCandidate;
  recordedAt: string;
  recursiveChildren: boolean;
  authorizingRoots: readonly TrustRecord['identity'][];
}>,): TrustRecord {
  return {
    schemaVersion: 1,
    identity: candidate.entry
      .identity,
    repositoryRoot: candidate.entry
      .discovered
      .repositoryRoot,
    format: 'typescript',
    sources: candidate.sources
      .map(function sourceRecord(
        source,
        index,
      ) {
      return {
        canonicalPath: source.canonicalPath,
        snapshotFile: sourceSnapshotFile(index,),
        size: source.size,
        mtimeNanoseconds: source.mtimeNanoseconds,
      };
    },),
    executableSnapshotFile: TYPESCRIPT_EXECUTABLE_FILE,
    executableSize: candidate.executableBytes
      .byteLength
      .toString(),
    recursiveChildren,
    authorizingRoots,
    recordedAt,
  };
}

/**
 * Prepares complete private TypeScript source and bundle record.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - complete exact build candidate
 *
 * @param recordedAt - RFC 3339 audit timestamp
 *
 * @param recursiveChildren - persisted descendant authority
 *
 * @param authorizingRoots - explicit and inherited provenance
 *
 * @returns disposable candidate with explicit commit operation
 *
 * @example
 * ```ts
 * await using prepared = await prepareTypeScriptRecord({ registryRoot, candidate, recordedAt });
 * ```
 */
export async function prepareTypeScriptRecord({
  registryRoot,
  candidate,
  recordedAt,
  recursiveChildren = false,
  authorizingRoots = [],
}: Readonly<{
  registryRoot: string;
  candidate: TypeScriptTrustCandidate;
  recordedAt: string;
  recursiveChildren?: boolean;
  authorizingRoots?: readonly TrustRecord['identity'][];
}>,): Promise<PreparedTrustRecord> {
  /**
   * Exact persistent metadata.
   */
  const record = buildTypeScriptRecord({
    candidate,
    recordedAt,
    recursiveChildren,
    authorizingRoots,
  },);
  /**
   * Every record-relative exact snapshot.
   */
  const snapshots = new Map<string, Uint8Array>([
    [
      TYPESCRIPT_EXECUTABLE_FILE,
      candidate.executableBytes,
    ],
    ...candidate.sources
      .map(function sourceSnapshot(
        source,
        index,
      ) {
      return [
        sourceSnapshotFile(index,),
        source.bytes,
      ] as const;
    },),
  ],);
  return await prepareTrustRecord({
    registryRoot,
    record,
    snapshots,
  },);
}
