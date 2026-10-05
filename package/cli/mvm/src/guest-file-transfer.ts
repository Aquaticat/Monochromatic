/**
 Moves one file between the host and a guest through the QEMU guest agent's
 file commands, for VMs that have no shared directory.

 The file travels in chunks, one agent command each, and the result is
 checked against the size the guest reports. A chunk whose command gets no
 answer is sent again after moving to the chunk's absolute position, so a
 chunk the guest did apply is not applied twice at the wrong place.

 @module
 */

import {
  open,
  stat,
} from 'node:fs/promises';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  GuestAgentReplyError,
  GuestAgentUnreachableError,
} from './agent-command.ts';
import {
  type GuestFile,
  type GuestFileChunk,
  openGuestFile,
} from './guest-file.ts';

/**
 Logger root for mvm after removing the package log shim.

 @example
 ```ts
 const rl = tagged({ tag: someFunction.name, l, },);
 ```
 */
const l = tagged({ tag: 'mvm', },);

//region Limits

/**
 Bytes of file data per write command.
 The base64 text of a chunk travels as part of one command-line argument of
 virsh, and Linux limits one argument to 131072 bytes; 96000 bytes encode to
 128000 characters, leaving room for the rest of the command.
 */
export const WRITE_CHUNK_BYTES = 96_000;

/**
 Bytes of file data requested per read command.
 The guest agent protocol reference allows 48 MB per read, but the answer also
 passes through libvirt, whose limits are lower. Measured on 2026-10-05 with
 libvirt 12.4.0: reads of 1 MiB and 2 MiB were answered, reads of 3 MiB and
 4 MiB failed with `Unable to encode message payload` (the base64 answer
 exceeds the 4194304 bytes libvirt allows one string), and a read of 8 MiB
 made libvirt give up on the agent of that domain until the domain is
 restarted. One read asks for 1 MiB, well inside the limit.
 */
export const READ_CHUNK_BYTES = 1_048_576;

/**
 Times one chunk is tried before the transfer gives up.
 */
const CHUNK_ATTEMPTS = 3;

/**
 Chunks between progress lines of a long transfer.
 */
const PROGRESS_EVERY_CHUNKS = 64;

//endregion Limits

//region Error

/**
 A file transfer through the guest agent did not complete.

 @example
 ```ts
 try {
   await pushThroughAgent({ domain: 'mvm-dev', guestPath: '/tmp/a.bin', hostPath: './a.bin' });
 }
 catch (error) {
   if (error instanceof GuestFileTransferError) console.error(error.bytesTransferred);
 }
 ```
 */
export class GuestFileTransferError extends Error {
  /**
   Bytes known to have been transferred before the failure.
   */
  readonly bytesTransferred: number;

  /**
   @param bytesTransferred - Bytes known to have been transferred before the failure

   @param cause - Underlying failure, kept for its details

   @param problem - What went wrong and what state it leaves, in full sentences
   */
  constructor({
    bytesTransferred,
    cause,
    problem,
  }: {
    readonly bytesTransferred: number;
    readonly cause?: unknown;
    readonly problem: string;
  },) {
    super(
      problem,
      { cause, },
    );
    this.name = 'GuestFileTransferError';
    this.bytesTransferred = bytesTransferred;
  }
}

//endregion Error

//region Attempts

/**
 Marks one attempt that got no answer from the guest agent and may be tried again.
 */
type Unanswered = {
  readonly unanswered: GuestAgentUnreachableError;
};

/**
 Runs one attempt and turns "no answer from the agent" into a value, so the caller can try again.
 Any other failure propagates.

 @param run - Attempt to make

 @returns The attempt's result, or the unanswered marker

 @example
 ```ts
 const outcome = await attempt(() => file.write(chunk));
 ```
 */
async function attempt<const Result,>(
  run: () => Promise<Result>,
): Promise<Result | Unanswered> {
  /**
   Logger scoped to the attempt so a retried chunk is attributable.
   */
  const rl = tagged({
    tag: attempt.name,
    l,
  },);
  try {
    return await run();
  }
  catch (error) {
    if (!(error instanceof GuestAgentUnreachableError))
      throw error;

    rl.info(`a file command got no answer from the guest agent and is tried again: ${error.message}`,);
    return { unanswered: error, };
  }
}

/**
 Series of attempts at one chunk, one at a time, at most {@link CHUNK_ATTEMPTS}.

 @param run - Attempt to make; told whether an earlier attempt went unanswered, so it can restore the file position first

 @returns Outcome of each attempt in order

 @example
 ```ts
 for await (const outcome of attempts((repeated) => writeAt({ data, file, offset, reposition: repeated }))) {
   if (!('unanswered' in outcome)) return outcome;
 }
 ```
 */
async function* attempts<const Result,>(
  run: (repeated: boolean,) => Promise<Result>,
): AsyncGenerator<Result | Unanswered> {
  for (let made = 0; made < CHUNK_ATTEMPTS; made += 1) {
    /**
     Whether an earlier attempt went unanswered, which leaves the file position unknown.
     */
    const repeated = made > 0;
    yield attempt(function runOnce() {
      return run(repeated,);
    },);
  }
}

/**
 Checks whether an attempt outcome is the unanswered marker.

 @param outcome - Outcome of one attempt

 @returns Whether the attempt got no answer

 @example
 ```ts
 isUnanswered({ unanswered: error }); // true
 ```
 */
function isUnanswered(outcome: unknown,): outcome is Unanswered {
  return ((typeof outcome) === 'object') && (outcome !== null)
    && ('unanswered' in outcome);
}

/**
 Sentinel for "no attempt has failed yet".
 A unique symbol models the empty state without a nullish union.
 */
const NO_FAILURE: unique symbol = Symbol('set before any attempt went unanswered',);

/**
 Makes a repeatable step until the guest agent answers, at most {@link CHUNK_ATTEMPTS} times.

 @param run - Step to make; told whether an earlier attempt went unanswered, so it can restore the file position first

 @returns The step's result

 @throws {@link GuestAgentUnreachableError} when no attempt got an answer

 @example
 ```ts
 const written = await answered((repeated) => writeAt({ data, file, offset, reposition: repeated }));
 ```
 */
async function answered<const Result,>(
  run: (repeated: boolean,) => Promise<Result>,
): Promise<Result> {
  /**
   Latest unanswered attempt, rethrown when every attempt went unanswered.
   */
  const last: { error: GuestAgentUnreachableError | typeof NO_FAILURE; } = { error: NO_FAILURE, };
  for await (const outcome of attempts(run,)) {
    if (!isUnanswered(outcome,)) {
      return outcome;
    }
    last.error = outcome.unanswered;
  }
  if (last.error === NO_FAILURE) {
    throw new Error('no attempt was made; the attempt limit is not positive',);
  }
  throw last.error;
}

//endregion Attempts

//region Push

/**
 Writes one chunk of the guest file.
 Chunks are written in order, so the file position is already right unless an
 earlier attempt went unanswered; then the position is restored first, which
 makes the repeat safe whether or not the guest applied the earlier write.

 @param data - Bytes of the chunk

 @param file - Open guest file

 @param offset - Position of the chunk from the start of the file

 @param reposition - Whether to move to `offset` before writing

 @returns Number of bytes written, always `data.length`

 @throws {@link GuestFileTransferError} when the agent wrote fewer bytes than given

 @example
 ```ts
 await writeAt({ data: Buffer.from('abc'), file, offset: 0, reposition: false });
 ```
 */
async function writeAt({
  data,
  file,
  offset,
  reposition,
}: {
  readonly data: Buffer;
  readonly file: GuestFile;
  readonly offset: number;
  readonly reposition: boolean;
},): Promise<number> {
  if (reposition) {
    await file.seek({
      offset,
      whence: 'set',
    },);
  }
  /**
   Bytes the agent reports written.
   */
  const written = await file.write(data,);
  if (written !== data.length) {
    throw new GuestFileTransferError({
      bytesTransferred: offset + written,
      problem: `The guest wrote ${String(written,)} of ${
        String(data.length,)
      } bytes at offset ${String(offset,)}; its disk may be full.`,
    },);
  }
  return written;
}

/**
 Series of chunk writes covering a host file from start to end, one at a time.

 @param file - Open guest file

 @param hostPath - Host file to read chunks from

 @param size - Size of the host file in bytes

 @returns End offset reached after each chunk

 @example
 ```ts
 for await (const reached of chunkWrites({ file, hostPath: './a.bin', size: 300_000 })) console.log(reached);
 ```
 */
async function* chunkWrites({
  file,
  hostPath,
  size,
}: {
  readonly file: GuestFile;
  readonly hostPath: string;
  readonly size: number;
},): AsyncGenerator<number> {
  /**
   Host file, read one chunk at a time so a large file is never held in memory whole.
   */
  await using source = await open(
    hostPath,
    'r',
  );
  /**
   Reads one chunk from the host file and writes it to the guest.

   @param offset - Position of the chunk

   @returns End offset of the chunk
   */
  async function transfer(offset: number,): Promise<number> {
    /**
     Chunk bytes; shorter than a full chunk only at the end of the file.
     */
    const data = Buffer.alloc(Math.min(
      WRITE_CHUNK_BYTES,
      size - offset,
    ),);
    /**
     Result of reading the chunk at its absolute position in the host file.
     */
    const { bytesRead, } = await source.read(
      data,
      0,
      data.length,
      offset,
    );
    if (bytesRead !== data.length) {
      throw new GuestFileTransferError({
        bytesTransferred: offset,
        problem: `${hostPath} changed while it was being pushed: ${String(bytesRead,)} of ${
          String(data.length,)
        } bytes could be read at offset ${String(offset,)}.`,
      },);
    }
    await answered(function writeChunk(repeated,) {
      return writeAt({
        data,
        file,
        offset,
        reposition: repeated,
      },);
    },);
    return offset + data.length;
  }
  for (let offset = 0; offset < size; offset += WRITE_CHUNK_BYTES) {
    yield transfer(offset,);
  }
}

/**
 Copies a host file to a path in the guest through the guest agent.

 @param domain - Prefixed libvirt domain name

 @param guestPath - Absolute path of the file to create or replace in the guest; its directory must exist

 @param hostPath - Host file to read

 @throws {@link GuestFileTransferError} when the copy does not complete; the message says what the guest file holds

 @example
 ```ts
 await pushThroughAgent({ domain: 'mvm-dev', guestPath: '/root/setup files/a.bin', hostPath: './a.bin' });
 ```
 */
export async function pushThroughAgent({
  domain,
  guestPath,
  hostPath,
}: {
  readonly domain: string;
  readonly guestPath: string;
  readonly hostPath: string;
},): Promise<void> {
  /**
   Logger scoped to this push so progress and failures are attributable.
   */
  const rl = tagged({
    tag: pushThroughAgent.name,
    l,
  },);
  /**
   Size of the host file; the guest file must end up this long.
   */
  const { size, } = await stat(hostPath,);
  /**
   Bytes confirmed written so far, reported when the push fails.
   */
  const progress = {
    chunks: 0,
    reached: 0,
  };
  rl.info(`pushing ${hostPath} (${String(size,)} bytes) to ${guestPath} in ${domain} through the guest agent`,);
  try {
    /**
     Guest file being written; created or emptied by opening it.
     */
    await using file = await openGuestFile({
      domain,
      mode: 'wb',
      path: guestPath,
    },);
    for await (
      const reached of chunkWrites({
        file,
        hostPath,
        size,
      },)
    ) {
      progress.reached = reached;
      progress.chunks += 1;
      if ((progress.chunks % PROGRESS_EVERY_CHUNKS) === 0) {
        rl.info(`pushed ${String(reached,)} of ${String(size,)} bytes`,);
      }
    }
    /**
     Length of the guest file as the guest reports it.
     */
    const guestSize = await answered(function measure() {
      return file.seek({
        offset: 0,
        whence: 'end',
      },);
    },);
    await file.close();
    if (guestSize !== size) {
      throw new GuestFileTransferError({
        bytesTransferred: progress.reached,
        problem: `${guestPath} in ${domain} is ${String(guestSize,)} bytes long after the push, but ${hostPath} has ${
          String(size,)
        } bytes. The guest file is not a copy of the host file.`,
      },);
    }
  }
  catch (error) {
    if (error instanceof GuestFileTransferError)
      throw error;
    if (!((error instanceof GuestAgentReplyError) || (error instanceof GuestAgentUnreachableError)))
      throw error;

    rl.debug(`push of ${hostPath} stopped after ${String(progress.reached,)} bytes`,);
    throw new GuestFileTransferError({
      bytesTransferred: progress.reached,
      cause: error,
      problem: [
        `Pushing ${hostPath} to ${guestPath} in ${domain} stopped after ${String(progress.reached,)} of ${
          String(size,)
        } bytes: ${error.message}`,
        progress.reached === 0
          ? `If ${guestPath} could not be opened, check that its directory exists in the guest; the guest agent does not create directories.`
          : `${guestPath} is incomplete in the guest. Push again to replace it, or remove it.`,
      ].join('\n',),
    },);
  }
  rl.info(`pushed ${String(size,)} bytes to ${guestPath} in ${domain}`,);
}

//endregion Push

//region Pull

/**
 Reads one chunk of the guest file.
 Chunks are read in order, so the file position is already right unless an
 earlier attempt went unanswered; then the position is restored first.

 @param file - Open guest file

 @param offset - Position to read at

 @param reposition - Whether to move to `offset` before reading

 @returns Bytes read and whether the file ended

 @example
 ```ts
 const chunk = await readAt({ file, offset: 0, reposition: false });
 ```
 */
async function readAt({
  file,
  offset,
  reposition,
}: {
  readonly file: GuestFile;
  readonly offset: number;
  readonly reposition: boolean;
},): Promise<GuestFileChunk> {
  if (reposition) {
    await file.seek({
      offset,
      whence: 'set',
    },);
  }
  return await file.read(READ_CHUNK_BYTES,);
}

/**
 Series of chunk reads from the start of a guest file, one at a time, without end;
 the consumer stops at the end of the file.

 @param file - Open guest file

 @param position - Position of the next read; the consumer advances it after each chunk

 @returns Chunks in order

 @example
 ```ts
 for await (const chunk of chunkReads({ file, position })) {
   if (chunk.eof) break;
 }
 ```
 */
async function* chunkReads({
  file,
  position,
}: {
  readonly file: GuestFile;
  readonly position: { readonly offset: number; };
},): AsyncGenerator<GuestFileChunk> {
  /**
   Reads the chunk at the consumer's current position, repeating an unanswered read.

   @returns Chunk at the current position
   */
  function readNextChunk(): Promise<GuestFileChunk> {
    /**
     Position fixed for this chunk, so a repeated attempt reads the same bytes.
     */
    const { offset, } = position;
    return answered(function readChunk(repeated,) {
      return readAt({
        file,
        offset,
        reposition: repeated,
      },);
    },);
  }
  // The consumer leaves the loop at the end of the file, which every file has.
  for (;;) {
    yield readNextChunk();
  }
}

/**
 Reads a file from the guest through the guest agent.
 The whole file is returned in memory.

 @param domain - Prefixed libvirt domain name

 @param guestPath - Absolute path of the file in the guest

 @returns File content

 @throws {@link GuestFileTransferError} when the read does not complete or the file changes while it is read

 @example
 ```ts
 const content = await pullThroughAgent({ domain: 'mvm-dev', guestPath: '/var/log/cloud-init.log' });
 ```
 */
export async function pullThroughAgent({
  domain,
  guestPath,
}: {
  readonly domain: string;
  readonly guestPath: string;
},): Promise<Buffer> {
  /**
   Logger scoped to this pull so progress and failures are attributable.
   */
  const rl = tagged({
    tag: pullThroughAgent.name,
    l,
  },);
  /**
   Chunks received so far, in order.
   */
  const chunks: Buffer[] = [];
  /**
   Position of the next read; equals the bytes received so far.
   */
  const position = { offset: 0, };
  rl.info(`pulling ${guestPath} from ${domain} through the guest agent`,);
  try {
    /**
     Guest file being read.
     */
    await using file = await openGuestFile({
      domain,
      mode: 'rb',
      path: guestPath,
    },);
    for await (
      const chunk of chunkReads({
        file,
        position,
      },)
    ) {
      chunks.push(chunk.data,);
      position.offset += chunk.data
        .length;
      if (chunk.eof || (chunk.data
        .length
        === 0)) {
        break;
      }
      if ((chunks.length % PROGRESS_EVERY_CHUNKS) === 0) {
        rl.info(`pulled ${String(position.offset,)} bytes so far`,);
      }
    }
    /**
     Length of the guest file as the guest reports it after the last read.
     */
    const guestSize = await answered(function measure() {
      return file.seek({
        offset: 0,
        whence: 'end',
      },);
    },);
    await file.close();
    if (guestSize !== position.offset) {
      throw new GuestFileTransferError({
        bytesTransferred: position.offset,
        problem: `${guestPath} in ${domain} is ${String(guestSize,)} bytes long, but ${
          String(position.offset,)
        } bytes were read; the file changed while it was being pulled. Pull again once it is no longer written.`,
      },);
    }
  }
  catch (error) {
    if (error instanceof GuestFileTransferError)
      throw error;
    if (!((error instanceof GuestAgentReplyError) || (error instanceof GuestAgentUnreachableError)))
      throw error;

    rl.debug(`pull of ${guestPath} stopped after ${String(position.offset,)} bytes`,);
    throw new GuestFileTransferError({
      bytesTransferred: position.offset,
      cause: error,
      problem: `Pulling ${guestPath} from ${domain} stopped after ${String(position.offset,)} bytes: ${error.message}`,
    },);
  }
  rl.info(`pulled ${String(position.offset,)} bytes from ${guestPath} in ${domain}`,);
  return Buffer.concat(chunks,);
}

//endregion Pull
