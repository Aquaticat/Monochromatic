/**
 * Exact trust candidate capture without config execution.
 *
 * @module
 */
import {
  constants,
  lstat,
  open,
  realpath,
} from 'node:fs/promises';
import { resolveFsId, } from '@monochromatic-dev/module-fs-id/ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import type {
  CapturedTrustSource,
  TrustCandidate,
} from './types.ts';

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
 * Selects handle-backed identity target where operating system exposes one.
 *
 * @param configPath - canonical live config path
 *
 * @param fileDescriptor - opened source descriptor
 *
 * @returns identity target and whether resolver must preserve its spelling
 */
function filesystemIdentityTarget({
  configPath,
  fileDescriptor,
}: Readonly<{
  configPath: string;
  fileDescriptor: number;
}>,): Readonly<{
  path: string;
  preserveTargetPath: boolean;
}> {
  if (process.platform === 'linux') {
    return {
      path: `/proc/${String(process.pid,)}/fd/${String(fileDescriptor,)}`,
      preserveTargetPath: true,
    };
  }
  return {
    path: configPath,
    preserveTargetPath: false,
  };
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
   * Handle-backed identity target where host provides process descriptor paths.
   */
  const identityTarget = filesystemIdentityTarget({
    configPath: discovered.configPath,
    fileDescriptor: handle.fd,
  },);
  /**
   * Fresh source-qualified filesystem identity without logger stream pollution.
   */
  const filesystem = await resolveFsId({
    path: identityTarget.path,
    emitDiagnostics: false,
    preserveTargetPath: identityTarget.preserveTargetPath,
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

/**
 * Captures exact local source bytes through no-follow stable handle.
 *
 * @param path - resolved local source path
 *
 * @returns canonical exact source snapshot
 *
 * @example
 * ```ts
 * await captureTrustSource('/repo/policy.ts');
 * ```
 */
export async function captureTrustSource(path: string,): Promise<CapturedTrustSource> {
  /**
   * Canonical source path before no-follow open.
   */
  const canonicalPath = await realpath(path,);
  /**
   * No-follow exact source handle.
   */
  const handle = await open(
    canonicalPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  /**
   * Automatically closed tracked-source handle.
   */
  await using disposableHandle = handle;
  /**
   * Same-handle metadata before capture.
   */
  const beforeMetadata = await handle.stat({ bigint: true, },);
  if (!beforeMetadata.isFile())
    throw new TrustCandidateError(`Tracked source is not a regular file: ${canonicalPath}`,);
  /**
   * Exact bytes supplied to TypeScript builder.
   */
  const bytes = await handle.readFile();
  /**
   * Same-handle metadata after capture.
   */
  const metadata = await handle.stat({ bigint: true, },);
  /**
   * Live canonical-path metadata proving object agreement.
   */
  const pathMetadata = await lstat(
    canonicalPath,
    { bigint: true, },
  );
  if ((!metadata.isFile()) || (!pathMetadata.isFile())
    || (beforeMetadata.dev !== metadata.dev)
    || (beforeMetadata.ino !== metadata.ino)
    || (beforeMetadata.size !== metadata.size)
    || (beforeMetadata.mtimeNs !== metadata.mtimeNs)
    || (pathMetadata.dev !== metadata.dev)
    || (pathMetadata.ino !== metadata.ino)
    || (BigInt(bytes.byteLength,) !== metadata.size)) {
    throw new TrustCandidateError(`Tracked source changed identity or bytes during capture: ${canonicalPath}`,);
  }
  return {
    canonicalPath,
    bytes: Uint8Array.from(bytes,),
    size: metadata.size
      .toString(),
    mtimeNanoseconds: metadata.mtimeNs
      .toString(),
  };
}
