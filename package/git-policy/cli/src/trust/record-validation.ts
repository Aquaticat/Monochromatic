/**
 * Trust record schema and permission validation.
 *
 * @module
 */
import {
  constants,
  lstat,
  open,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  assertRecordDirectoryIdentity,
  validateSnapshotRelativePath,
} from './registry-path.ts';
import { assertPrivatePathProtection, } from './registry-io.ts';
import type {
  TrustIdentity,
  TrustRecord,
  TrustSourceRecord,
} from './types.ts';

/**
 * Group and other permission mask.
 */
const NON_OWNER_PERMISSION_MASK = 0o077;

/**
 * Corrupt or unsafe trust record.
 */
export class TrustRecordError extends Error {
  /**
   * Creates record validation failure.
   *
   * @param message - safe failure explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'TrustRecordError';
  }
}

/**
 * Asserts ordinary object record.
 *
 * @param value - unknown candidate
 *
 * @returns Nothing after narrowing candidate
 */
function assertRecord(value: unknown,): asserts value is Record<string, unknown> {
  if (((typeof value) !== 'object') || (value === null)
    || Array.isArray(value,))
    throw new TrustRecordError('Trust metadata value must be an object.',);
}

/**
 * Checks non-empty decimal string.
 *
 * @param value - unknown numeric metadata
 *
 * @returns whether value contains only ASCII decimal digits
 */
function isDecimalString(value: unknown,): value is string {
  if (((typeof value) !== 'string') || (value.length === 0))
    return false;
  for (let index = 0; index < value.length; index += 1) {
    if ((value.charAt(index,) < '0') || (value.charAt(index,) > '9'))
      return false;
  }
  return true;
}

/**
 * Validates complete trust identity.
 *
 * @param value - unknown identity
 *
 * @returns copied identity
 */
function validateIdentity(value: unknown,): TrustIdentity {
  assertRecord(value,);
  if (((typeof value.filesystemId) !== 'string')
    || (value.filesystemId
      .length
      === 0)
    || value.filesystemId
    .includes(':',)
    || ((typeof value.canonicalConfigPath) !== 'string')
    || (value.canonicalConfigPath
      .length
      === 0))
    throw new TrustRecordError('Trust identity fields are invalid.',);
  return {
    filesystemId: value.filesystemId,
    canonicalConfigPath: value.canonicalConfigPath,
  };
}

/**
 * Validates one source metadata entry.
 *
 * @param value - unknown source record
 *
 * @returns copied source metadata
 */
function validateSource(value: unknown,): TrustSourceRecord {
  assertRecord(value,);
  if (((typeof value.canonicalPath) !== 'string') || (value.canonicalPath
    .length
    === 0)
    || (!isDecimalString(value.size,))
    || (!isDecimalString(value.mtimeNanoseconds,)))
    throw new TrustRecordError('Trust source metadata is invalid.',);
  return {
    canonicalPath: value.canonicalPath,
    snapshotFile: validateSnapshotRelativePath(value.snapshotFile,),
    size: value.size,
    mtimeNanoseconds: value.mtimeNanoseconds,
  };
}

/**
 * Parses and validates schema-version-one trust record.
 *
 * @param value - unknown JSON value
 *
 * @returns copied validated record
 *
 * @example
 * ```ts
 * validateTrustRecord(JSON.parse(recordJson));
 * ```
 */
export function validateTrustRecord(value: unknown,): TrustRecord {
  assertRecord(value,);
  if ((value.schemaVersion !== 1)
    || ((typeof value.repositoryRoot) !== 'string')
    || (value.repositoryRoot
      .length
      === 0)
    || ((value.format !== 'mjs') && (value.format !== 'typescript'))
    || (!Array.isArray(value.sources,))
    || (value.sources
      .length
      === 0)
    || (!isDecimalString(value.executableSize,))
    || ((typeof value.recursiveChildren) !== 'boolean')
    || (!Array.isArray(value.authorizingRoots,))
    || ((typeof value.recordedAt) !== 'string')
    || Number.isNaN(Date.parse(value.recordedAt,)))
    throw new TrustRecordError('Trust record metadata is invalid.',);
  /**
   * Complete validated record identity.
   */
  const identity = validateIdentity(value.identity,);
  /**
   * Canonically ordered source metadata.
   */
  const sources = value.sources
    .map(validateSource,);
  /**
   * Recursive trust provenance identities.
   */
  const authorizingRoots = value.authorizingRoots
    .map(validateIdentity,);
  /**
   * Duplicate-detection keys for provenance identities.
   */
  const provenanceKeys = authorizingRoots.map(function identityKey(authorizer,) {
    return `${authorizer.filesystemId}:${authorizer.canonicalConfigPath}`;
  },);
  if (new Set(provenanceKeys,).size !== provenanceKeys.length)
    throw new TrustRecordError('Trust authorizing roots contain duplicates.',);
  return {
    schemaVersion: 1,
    identity,
    repositoryRoot: value.repositoryRoot,
    format: value.format,
    sources,
    executableSnapshotFile: validateSnapshotRelativePath(value.executableSnapshotFile,),
    executableSize: value.executableSize,
    recursiveChildren: value.recursiveChildren,
    authorizingRoots,
    recordedAt: value.recordedAt,
  };
}

/**
 * Asserts restrictive POSIX mode when platform exposes permission bits.
 *
 * @param mode - stat mode
 *
 * @param label - path diagnostic label
 */
function assertPrivateMode({
  mode,
  label,
}: Readonly<{
  mode: number;
  label: string;
}>,): void {
  if ((process.platform !== 'win32') && ((mode & NON_OWNER_PERMISSION_MASK) !== 0))
    throw new TrustRecordError(`${label} has unsafe group or other permissions.`,);
}

/**
 * Reads one file without following final symbolic link.
 *
 * @param path - absolute file path
 *
 * @returns exact file bytes
 *
 * @example
 * ```ts
 * await readPrivateFile('/private/record.json');
 * ```
 */
export async function readPrivateFile(path: string,): Promise<Uint8Array> {
  await assertPrivatePathProtection({
    path,
    directory: false,
  },);
  /**
   * No-follow handle for exact private file.
   */
  const handle = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  /**
   * Automatically closed private file handle.
   */
  await using disposableHandle = handle;
  /**
   * Same-handle metadata used for type and mode checks.
   */
  const metadata = await handle.stat();
  if (!metadata.isFile())
    throw new TrustRecordError(`Trust file is not regular: ${path}`,);
  if ((process.platform !== 'win32') && (process.getuid?.() !== metadata.uid))
    throw new TrustRecordError(`Trust file is not owned by current account: ${path}`,);
  assertPrivateMode({
    mode: metadata.mode,
    label: path,
  },);
  return Uint8Array.from(await handle.readFile(),);
}

/**
 * Reads and validates record plus identity/path agreement.
 *
 * @param registryRoot - complete registry root
 *
 * @param directory - expected record directory
 *
 * @returns validated trust record
 *
 * @example
 * ```ts
 * await readRecord({ registryRoot: '/r', directory: '/r/records/key' });
 * ```
 */
export async function readRecord({
  registryRoot,
  directory,
}: Readonly<{
  registryRoot: string;
  directory: string;
}>,): Promise<TrustRecord> {
  /**
   * Final record directory metadata, read before ACL verification so absence retains ENOENT classification.
   */
  const directoryMetadata = await lstat(directory,);
  if ((!directoryMetadata.isDirectory()) || directoryMetadata.isSymbolicLink())
    throw new TrustRecordError('Trust record directory is unsafe.',);
  await assertPrivatePathProtection({
    path: directory,
    directory: true,
  },);
  assertPrivateMode({
    mode: directoryMetadata.mode,
    label: directory,
  },);
  /**
   * Exact record JSON bytes.
   */
  const recordBytes = await readPrivateFile(join(
    directory,
    'record.json',
  ),);
  /**
   * Parsed JSON retained as unknown until schema validation.
   */
  const parsed: unknown = (function parseRecordJson() {
    try {
      /**
       * JSON parser output held as unknown.
       */
      const jsonValue: unknown = JSON.parse(new TextDecoder(
        'utf-8',
        { fatal: true, },
      ).decode(recordBytes,),);
      return jsonValue;
    }
    catch (error: unknown) {
      throw new TrustRecordError(`Trust record JSON is invalid: ${String(error,)}`,);
    }
  })();
  /**
   * Runtime-authoritative record.
   */
  const record = validateTrustRecord(parsed,);
  assertRecordDirectoryIdentity({
    registryRoot,
    identity: record.identity,
    directory,
  },);
  return record;
}
