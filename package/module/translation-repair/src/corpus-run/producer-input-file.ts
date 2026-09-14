import { createHash, } from 'node:crypto';
import {
  constants,
  type BigIntStats,
} from 'node:fs';
import {
  lstat,
  open,
} from 'node:fs/promises';
import {
  ProducerInputRunError,
  type ProducerInputOperation,
} from './producer-input-error.ts';

//region Bounded file observation shared by the specialized host and child

/**
 Independently supplied extent bounds I/O before a file can allocate or stream its body.
 
 @example
 ```ts
 const expected: ProducerInputFileIdentity = { bytes: 123, sha256: recordedHash };
 ```
 */
export type ProducerInputFileIdentity = {
  /**
   Exact raw byte extent, not decoded character length.
   */
  readonly bytes: number;
  /**
   Independently recorded lowercase SHA-256.
   */
  readonly sha256: string;
};

/**
 A hashing read never retains its body; a byte read owns the chunks until concatenation.
 
 @example
 ```ts
 const observation: ProducerInputFileObservation = { identity, chunks: [], uid, gid, mode };
 ```
 */
type ProducerInputFileObservation = {
  /**
   Observed count and hash describe the same descriptor-backed stream.
   */
  readonly identity: ProducerInputFileIdentity;
  /**
   Empty for hash-only observations, not a claim that the file was empty.
   */
  readonly chunks: readonly Uint8Array[];
  /**
   Owner observed on the descriptor whose bytes were hashed.
   */
  readonly uid: bigint;
  /**
   Group belongs to the same descriptor observation, not a caller assumption.
   */
  readonly gid: bigint;
  /**
   Permissions belong to that same stable descriptor observation.
   */
  readonly mode: bigint;
};

/**
 Stream working storage stays independent of the caller-authorized total extent.
 */
const FILE_CHUNK_BYTES = 65_536;
/**
 Host-owned output metadata must not expose group or other permissions.
 */
const FILE_PERMISSION_MASK = 0o7777n;
/**
 Exact private output-file permissions declared by this runner.
 */
const PRIVATE_OUTPUT_PERMISSIONS = 0o600n;

/**
 Compares identity and mutation timestamps without millisecond rounding.
 
 @param before - descriptor observation before body access
 
 @param after - descriptor or final-path observation after body access
 
 @returns Whether the observed regular file remains the same
 
 @example
 ```ts
 const stable = sameProducerInputFile({ before, after });
 ```
 */
export function sameProducerInputFile({
  before,
  after,
}: {
  readonly before: BigIntStats;
  readonly after: BigIntStats;
},): boolean {
  return after.isFile() && (before.dev === after.dev)
    && (before.ino === after.ino)
    && (before.size === after.size)
    && (before.uid === after.uid)
    && (before.gid === after.gid)
    && (before.mode === after.mode)
    && (before.mtimeNs === after.mtimeNs)
    && (before.ctimeNs === after.ctimeNs);
}

/**
 Reads only the independently authorized extent and rejects path replacement or observed mutation.
 This establishes a point-in-time observation, not a hostile-host filesystem lease.
 
 @param path - already authorized absolute input locator
 
 @param expectedBytes - exact independently established extent
 
 @param operation - owning runner operation for privacy-safe refusal
 
 @param retainChunks - whether the caller needs owned body bytes rather than only identity
 
 @returns One checked stream observation
 
 @throws ProducerInputRunError when shape, extent, read or stability checks fail
 
 @example
 ```ts
 const observed = await observeProducerInputFile({ path, expectedBytes, operation: 'verify-runtime', retainChunks: false });
 ```
 */
async function observeProducerInputFile({
  path,
  expectedBytes,
  operation,
  retainChunks,
}: {
  readonly path: string;
  readonly expectedBytes: number;
  readonly operation: ProducerInputOperation;
  readonly retainChunks: boolean;
},): Promise<ProducerInputFileObservation> {
  if ((!Number.isSafeInteger(expectedBytes)) || (expectedBytes < 0))
    throw new ProducerInputRunError({
      operation,
      locator: path,
    });
  try {
    /**
     Known nonregular inputs are rejected without opening a device or waiting for a FIFO peer.
     */
    const initial = await lstat(
      path,
      { bigint: true, }
    );
    if ((!initial.isFile()) || (initial.size !== BigInt(expectedBytes)))
      throw new ProducerInputRunError({
        operation,
        locator: path,
      });
    /**
     No-follow rejects leaf symlinks; nonblocking open lets fstat reject a replacement FIFO before body reads.
     */
    await using handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    /**
     No body read occurs before the exact regular-file extent matches.
     */
    const before = await handle.stat({ bigint: true, },);
    if ((!before.isFile()) || (before.size !== BigInt(expectedBytes))
      || (!sameProducerInputFile({
        before: initial,
        after: before
      })))
      throw new ProducerInputRunError({
        operation,
        locator: path,
      });
    /**
     Hashing and counting observe the same chunks.
     */
    const hash = createHash('sha256',);
    /**
     This counter belongs solely to the bounded stream operation.
     */
    const observed = { bytes: 0, };
    /**
     Hash-only callers do not retain executable or native-library bodies.
     */
    const chunks: Uint8Array[] = [];
    if (expectedBytes > 0) {
      for await (const chunk of handle.createReadStream({
        start: 0,
        end: expectedBytes - 1,
        highWaterMark: FILE_CHUNK_BYTES,
        autoClose: false,
      },)) {
        if (!Buffer.isBuffer(chunk))
          throw new ProducerInputRunError({
            operation,
            locator: path,
          });
        observed.bytes += chunk.length;
        if (observed.bytes > expectedBytes)
          throw new ProducerInputRunError({
            operation,
            locator: path,
          });
        hash.update(chunk);
        if (retainChunks)
          chunks.push(new Uint8Array(chunk));
      }
    }
    /**
     Descriptor state is checked before observing the final pathname.
     */
    const after = await handle.stat({ bigint: true, },);
    /**
     The final pathname must still identify the observed file, not a replacement or symlink.
     */
    const current = await lstat(
      path,
      { bigint: true, },
    );
    if ((observed.bytes !== expectedBytes) || (!sameProducerInputFile({
      before,
      after,
    }))
      || (!sameProducerInputFile({
        before,
        after: current,
      })))
      throw new ProducerInputRunError({
        operation,
        locator: path,
      });
    return {
      identity: {
        bytes: observed.bytes,
        sha256: hash.digest('hex'),
      },
      chunks,
      uid: before.uid,
      gid: before.gid,
      mode: before.mode,
    };
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    // Native filesystem messages may contain more paths than the authorized locator.
    throw new ProducerInputRunError({
      operation,
      locator: path,
    });
  }
}

/**
 Verifies a file without retaining its body in memory.
 
 @param path - authorized executable, runtime or native-library locator
 
 @param expected - independently bound raw identity
 
 @param operation - owning runner operation
 
 @returns Exact verified identity
 
 @throws ProducerInputRunError when identity or file observation differs
 
 @example
 ```ts
 await verifyProducerInputFile({ path, expected, operation: 'verify-runtime' });
 ```
 */
export async function verifyProducerInputFile({
  path,
  expected,
  operation,
}: {
  readonly path: string;
  readonly expected: ProducerInputFileIdentity;
  readonly operation: ProducerInputOperation;
},): Promise<ProducerInputFileIdentity> {
  /**
   Primitive authority is fixed before descriptor I/O can yield.
   */
  const {
    bytes,
    sha256,
  } = expected;
  /**
   The observation owns no caller-modifiable byte buffer.
   */
  const observation = await observeProducerInputFile({
    path,
    expectedBytes: bytes,
    operation,
    retainChunks: false,
  });
  if (observation.identity
    .sha256
    !== sha256)
    throw new ProducerInputRunError({
      operation,
      locator: path,
    });
  return observation.identity;
}

/**
 Returns an owned exact-size body only after raw identity and descriptor stability checks.
 
 @param path - authorized launch, manifest, selection or supporting-file locator
 
 @param expected - independently bound raw identity and allocation allowance
 
 @param operation - owning runner operation
 
 @returns Owned raw bytes, with no text-decoding policy silently applied
 
 @throws ProducerInputRunError when identity or file observation differs
 
 @example
 ```ts
 const bytes = await readProducerInputFile({ path, expected, operation: 'read-selection' });
 ```
 */
export async function readProducerInputFile({
  path,
  expected,
  operation,
}: {
  readonly path: string;
  readonly expected: ProducerInputFileIdentity;
  readonly operation: ProducerInputOperation;
},): Promise<Uint8Array> {
  /**
   Primitive authority is fixed before descriptor I/O can yield.
   */
  const {
    bytes,
    sha256,
  } = expected;
  /**
   Only size-authorized body readers retain chunks.
   */
  const observation = await observeProducerInputFile({
    path,
    expectedBytes: bytes,
    operation,
    retainChunks: true,
  });
  if (observation.identity
    .sha256
    !== sha256)
    throw new ProducerInputRunError({
      operation,
      locator: path,
    });
  return Buffer.concat(
    observation.chunks,
    bytes
  );
}

/**
 Reads bounded private metadata produced by this host operation, without inventing independent approval.
 
 @param path - fixed native-stage or completion file inside the exclusive run
 
 @param maximumBytes - internal metadata allocation ceiling
 
 @param ownerUid - independently captured host owner
 
 @param ownerGid - independently captured host group
 
 @param operation - owning fixed diagnostic vocabulary
 
 @returns Strictly decoded text after extent, ownership and stable descriptor checks
 
 @throws ProducerInputRunError when metadata cannot be observed within its private bound
 
 @example
 ```ts
 const text = await readProducerInputMetadata({ path, maximumBytes, ownerUid, ownerGid, operation: 'read-output' });
 ```
 */
export async function readProducerInputMetadata({
  path,
  maximumBytes,
  ownerUid,
  ownerGid,
  operation,
}: {
  readonly path: string;
  readonly maximumBytes: number;
  readonly ownerUid: number;
  readonly ownerGid: number;
  readonly operation: 'launch-container' | 'read-output';
},): Promise<string> {
  try {
    /**
     Extent is observed before any body allocation; the descriptor reader rechecks it.
     */
    const state = await lstat(
      path,
      { bigint: true }
    );
    if ((!Number.isSafeInteger(maximumBytes)) || (maximumBytes < 0)
      || (!state.isFile())
      || (state.size > BigInt(maximumBytes)))
      throw new ProducerInputRunError({
        operation,
        locator: path,
      });
    /**
     Metadata is bounded by the observed extent, not read until filesystem EOF.
     */
    const observation = await observeProducerInputFile({
      path,
      expectedBytes: Number(state.size),
      operation,
      retainChunks: true
    });
    if ((observation.uid !== BigInt(ownerUid)) || (observation.gid !== BigInt(ownerGid))
      || ((observation.mode & FILE_PERMISSION_MASK) !== PRIVATE_OUTPUT_PERMISSIONS))
      throw new ProducerInputRunError({
        operation,
        locator: path,
      });
    return new TextDecoder(
      'utf-8',
      { fatal: true }
    ).decode(Buffer.concat(
      observation.chunks,
      observation.identity
        .bytes
    ));
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation,
      locator: path,
    });
  }
}

/**
 Streams the fixed private artifact while checking ownership on the same descriptor as its byte identity.
 
 @param path - fixed artifact file, never a completion-supplied locator
 
 @param expected - application-reported identity to check for internal consistency
 
 @param ownerUid - independently captured host owner
 
 @param ownerGid - independently captured host group
 
 @returns Observed artifact identity, not semantic or execution approval
 
 @throws ProducerInputRunError when private ownership or byte identity differs
 
 @example
 ```ts
 await verifyProducerInputOutputFile({ path, expected, ownerUid, ownerGid });
 ```
 */
export async function verifyProducerInputOutputFile({
  path,
  expected,
  ownerUid,
  ownerGid,
}: {
  readonly path: string;
  readonly expected: ProducerInputFileIdentity;
  readonly ownerUid: number;
  readonly ownerGid: number;
},): Promise<ProducerInputFileIdentity> {
  /**
   Snapshot primitive extent and digest before descriptor I/O.
   */
  const {
    bytes,
    sha256
  } = expected;
  /**
   Artifact content is hashed without retaining corpus-derived bytes on the host.
   */
  const observation = await observeProducerInputFile({
    path,
    expectedBytes: bytes,
    operation: 'read-output',
    retainChunks: false
  });
  if ((observation.identity
    .sha256
    !== sha256) || (observation.uid !== BigInt(ownerUid))
    || (observation.gid !== BigInt(ownerGid))
    || ((observation.mode & FILE_PERMISSION_MASK) !== PRIVATE_OUTPUT_PERMISSIONS))
    throw new ProducerInputRunError({
      operation: 'read-output',
      locator: path,
    });
  return observation.identity;
}

//endregion Bounded file observation shared by the specialized host and child
