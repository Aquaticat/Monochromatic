/**
 * Exact trust candidate capture without config execution.
 *
 * @module
 */
import {
  constants,
  lstat,
  open,
} from 'node:fs/promises';
import { resolveFsId, } from '@monochromatic-dev/module-fs-id/ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import type { TrustCandidate, } from './types.ts';

/**
 * Candidate capture failure.
 */
export class TrustCandidateError extends Error {
  /**
   * Creates candidate failure.
   *
   * @param message - safe failure explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'TrustCandidateError';
  }
}

/**
 * Captures exact bytes and same-handle metadata from non-symlink source.
 *
 * @param discovered - canonical configuration location
 *
 * @returns exact candidate plus complete filesystem identity
 *
 * @example
 * ```ts
 * await captureTrustCandidate(discovered);
 * ```
 */
export async function captureTrustCandidate(discovered: DiscoveredConfig,): Promise<TrustCandidate> {
  if (discovered.format !== 'mjs')
    throw new TrustCandidateError('TypeScript trust is not available until issue #347.',);
  /**
   * No-follow source handle opened before filesystem identity resolution.
   */
  const handle = await open(
    discovered.configPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  /**
   * Automatically closed source handle.
   */
  await using disposableHandle = handle;
  /**
   * Same-handle metadata before byte capture.
   */
  const beforeMetadata = await handle.stat({ bigint: true, },);
  if (!beforeMetadata.isFile())
    throw new TrustCandidateError('Configuration must remain a regular file during capture.',);
  /**
   * Exact bytes from opened source object.
   */
  const bytes = await handle.readFile();
  /**
   * Fresh source-qualified filesystem identity without logger stream pollution.
   */
  const filesystem = await resolveFsId({
    path: discovered.configPath,
    emitDegradedWarning: false,
  },);
  /**
   * Same-handle metadata after byte capture and identity resolution.
   */
  const metadata = await handle.stat({ bigint: true, },);
  /**
   * Live path metadata proving identity resolution still named opened object.
   */
  const pathMetadata = await lstat(
    discovered.configPath,
    { bigint: true, },
  );
  if ((!metadata.isFile())
    || (!pathMetadata.isFile())
    || (beforeMetadata.dev !== metadata.dev)
    || (beforeMetadata.ino !== metadata.ino)
    || (beforeMetadata.size !== metadata.size)
    || (beforeMetadata.mtimeNs !== metadata.mtimeNs)
    || (pathMetadata.dev !== metadata.dev)
    || (pathMetadata.ino !== metadata.ino)
    || (BigInt(bytes.byteLength,) !== metadata.size))
    throw new TrustCandidateError('Configuration changed identity or bytes during capture.',);
  return {
    discovered,
    identity: {
      filesystemId: filesystem.value,
      canonicalConfigPath: discovered.configPath,
    },
    bytes: Uint8Array.from(bytes,),
    size: metadata.size
      .toString(),
    mtimeNanoseconds: metadata.mtimeNs
      .toString(),
    filesystemStable: filesystem.stable,
    ...filesystem.reason === undefined
      ? {}
      : { filesystemStabilityReason: filesystem.reason, },
  };
}
