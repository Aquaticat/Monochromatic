/**
 * Exact trust candidate capture without config execution.
 *
 * @module
 */
import {
  constants,
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
   * Fresh source-qualified filesystem identity.
   */
  const filesystem = await resolveFsId({ path: discovered.configPath, },);
  /**
   * No-follow source handle.
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
   * Exact bytes and same-handle bigint metadata.
   */
  const [bytes, metadata,] = await Promise.all([
    handle.readFile(),
    handle.stat({ bigint: true, },),
  ],);
  if (!metadata.isFile())
    throw new TrustCandidateError('Configuration must remain a regular file during capture.',);
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
  };
}
