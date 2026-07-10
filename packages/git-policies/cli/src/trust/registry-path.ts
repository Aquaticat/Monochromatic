/**
 * Reversible unhashed trust registry paths.
 *
 * @module
 */
import { join, } from 'node:path';
import type { TrustIdentity, } from './types.ts';

/**
 * Fixed encoded canonical-path component width.
 */
const PATH_CHUNK_LENGTH = 120;

/**
 * Invalid reversible trust identity path.
 */
export class TrustPathError extends Error {
  /**
   * Creates path validation failure.
   *
   * @param message - safe failure explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'TrustPathError';
  }
}

/**
 * Encodes exact UTF-8 value as unpadded base64url.
 *
 * @param value - identity field
 *
 * @returns reversible filesystem-safe encoding
 *
 * @example
 * ```ts
 * encodeIdentityField('/repo/config.mjs');
 * ```
 */
export function encodeIdentityField(value: string,): string {
  if (value.length === 0)
    throw new TrustPathError('Trust identity fields must not be empty.',);
  /**
   * Canonical unpadded base64url bytes.
   */
  const encoded = Buffer.from(
    value,
    'utf8',
  )
    .toString('base64url',);
  if ((encoded.length === 0) || encoded.includes('=',))
    throw new TrustPathError('Trust identity encoding is invalid.',);
  return encoded;
}

/**
 * Decodes canonical unpadded base64url identity field.
 *
 * @param encoded - filesystem component encoding
 *
 * @returns exact decoded UTF-8 value
 *
 * @example
 * ```ts
 * decodeIdentityField('L3JlcG8');
 * ```
 */
export function decodeIdentityField(encoded: string,): string {
  if ((encoded.length === 0) || encoded.includes('=',))
    throw new TrustPathError('Encoded trust identity field is invalid.',);
  /**
   * Exact UTF-8 decoded field.
   */
  const decoded = Buffer.from(
    encoded,
    'base64url',
  )
    .toString('utf8',);
  if (encodeIdentityField(decoded,) !== encoded)
    throw new TrustPathError('Encoded trust identity field is not canonical.',);
  return decoded;
}

/**
 * Splits encoded canonical path into bounded components.
 *
 * @param encodedPath - complete base64url canonical path
 *
 * @returns fixed-width chunks preserving exact order
 *
 * @example
 * ```ts
 * chunkEncodedPath('abc');
 * ```
 */
export function chunkEncodedPath(encodedPath: string,): readonly string[] {
  if (encodedPath.length === 0)
    throw new TrustPathError('Encoded canonical path must not be empty.',);
  /**
   * Required bounded component count.
   */
  const chunkCount = Math.ceil(encodedPath.length / PATH_CHUNK_LENGTH,);
  return Array.from(
    { length: chunkCount, },
    function createChunk(
      _value,
      index,
    ) {
    /**
     * Byte-safe ASCII slice start.
     */
    const start = index * PATH_CHUNK_LENGTH;
    return encodedPath.slice(
      start,
      start + PATH_CHUNK_LENGTH,
    );
  },
  );
}

/**
 * Resolves exact per-identity record directory.
 *
 * @param registryRoot - complete injected or account-derived registry root
 *
 * @param identity - complete unhashed identity
 *
 * @returns record directory ending in encoded path chunks
 *
 * @example
 * ```ts
 * recordDirectory({ registryRoot: '/r', identity: { filesystemId: 'fs-uuid_x', canonicalConfigPath: '/repo/cli-git.config.mjs' } });
 * ```
 */
export function recordDirectory({
  registryRoot,
  identity,
}: Readonly<{
  registryRoot: string;
  identity: TrustIdentity;
}>,): string {
  /**
   * Reversible complete filesystem ID component.
   */
  const encodedFilesystemId = encodeIdentityField(identity.filesystemId,);
  /**
   * Reversible complete canonical-path components.
   */
  const encodedPath = encodeIdentityField(identity.canonicalConfigPath,);
  return join(
    registryRoot,
    'records',
    encodedFilesystemId,
    'path',
    ...chunkEncodedPath(encodedPath,),
  );
}

/**
 * Confirms record path encoding reproduces stored identity.
 *
 * @param registryRoot - registry root
 *
 * @param identity - stored identity
 *
 * @param directory - actual record directory
 *
 * @throws TrustPathError when path and record disagree
 *
 * @example
 * ```ts
 * assertRecordDirectoryIdentity({ registryRoot, identity, directory });
 * ```
 */
export function assertRecordDirectoryIdentity({
  registryRoot,
  identity,
  directory,
}: Readonly<{
  registryRoot: string;
  identity: TrustIdentity;
  directory: string;
}>,): void {
  if (recordDirectory({
    registryRoot,
    identity,
  },) !== directory)
    throw new TrustPathError('Trust record path does not reproduce stored identity.',);
}

/**
 * Validates safe slash-separated record-relative snapshot path.
 *
 * @param value - record metadata path
 *
 * @returns validated relative path unchanged
 *
 * @example
 * ```ts
 * validateSnapshotRelativePath('snapshots/config.mjs');
 * ```
 */
export function validateSnapshotRelativePath(value: unknown,): string {
  if (((typeof value) !== 'string') || (value.length === 0)
    || value.startsWith('/',)
    || value.includes('\\',))
    throw new TrustPathError('Snapshot path must be a non-empty slash-relative path.',);
  /**
   * Slash-separated record-relative components.
   */
  const segments = value.split('/',);
  if (segments.some(function isUnsafeSegment(segment,) {
    return (segment.length === 0) || (segment === '.')
      || (segment === '..');
  },) || (segments[0] !== 'snapshots'))
    throw new TrustPathError('Snapshot path escapes snapshots directory.',);
  return value;
}
