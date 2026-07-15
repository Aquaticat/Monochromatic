/**
 * Batched Git blob loading shared by landed and pushed candidates.
 *
 * @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  arrayBuffer,
  text,
} from 'node:stream/consumers';

/**
 * Byte terminating Git batch protocol records.
 */
const NEWLINE_BYTE = 0x0A;
/**
 * Strict decoder for ASCII-compatible Git batch headers.
 */
const HEADER_DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 * Encoder for complete object-ID request lines.
 */
const REQUEST_ENCODER = new TextEncoder();
/**
 * Field count in successful default batch header.
 */
const BATCH_HEADER_FIELD_COUNT = 3;

/**
 * Parsed Git batch object header.
 */
type BatchHeader = Readonly<{
  /**
   * Canonical object ID returned by Git.
   */
  oid: string;
  /**
   * Uncompressed object byte length.
   */
  size: number;
}>;

/**
 * Parses one successful `git cat-file --batch` header.
 *
 * @param header - decoded header without newline
 *
 * @param createError - domain error factory for malformed output
 *
 * @returns canonical object identity and size
 *
 * @throws caller-domain error when header is malformed or names a non-blob
 *
 * @example
 * ```ts
 * parseBatchHeader({ header: 'abc blob 3', createError: function toError(message,) { return new Error(message,); } });
 * ```
 */
function parseBatchHeader({
  header,
  createError,
}: {
  readonly header: string;
  readonly createError: (message: string) => Error;
},): BatchHeader {
  /**
   * Space-delimited default batch fields.
   */
  const fields = header.split(' ',);
  /**
   * Required object identity,
   * type,
   * and size.
   */
  const [oid, objectType, sizeText,] = fields;
  if ((oid === undefined) || (objectType === undefined)
    || (sizeText === undefined)
    || (fields.length !== BATCH_HEADER_FIELD_COUNT))
    throw createError(`Git blob batch returned malformed header: ${header}`,);
  if (objectType !== 'blob')
    throw createError(`Git blob batch returned ${objectType} for ${oid}.`,);
  /**
   * Parsed uncompressed byte length.
   */
  const size = Number(sizeText,);
  if ((!Number.isSafeInteger(size,)) || (size < 0)
    || (String(size,) !== sizeText))
    throw createError(`Git blob batch returned invalid size for ${oid}: ${sizeText}`,);
  return {
    oid,
    size,
  };
}

/**
 * Parses ordered Git batch output without interpreting blob bytes as delimiters.
 *
 * @param output - complete binary batch output
 *
 * @param requestedOids - unique requested object IDs in protocol order
 *
 * @param createError - domain error factory for malformed output
 *
 * @returns exact blob bytes keyed by requested object ID
 *
 * @throws caller-domain error when output is malformed, misordered, or truncated
 *
 * @example
 * ```ts
 * parseBatchOutput({ output, requestedOids: ['abc'], createError: function toError(message,) { return new Error(message,); } });
 * ```
 */
function parseBatchOutput({
  output,
  requestedOids,
  createError,
}: {
  readonly output: Uint8Array;
  readonly requestedOids: readonly string[];
  readonly createError: (message: string) => Error;
},): ReadonlyMap<string, Uint8Array> {
  /**
   * Parsed bytes retaining views into complete batch output.
   */
  const blobs = new Map<string, Uint8Array>();
  /**
   * Current unread output offset.
   */
  let offset = 0;
  requestedOids.forEach(function parseRequestedBlob(requestedOid,) {
    /**
     * Header terminator before exact-size content.
     */
    const headerEnd = output.indexOf(
      NEWLINE_BYTE,
      offset,
    );
    if (headerEnd === (-1))
      throw createError(`Git blob batch omitted header for ${requestedOid}.`,);
    /**
     * Parsed successful batch header.
     */
    const header = parseBatchHeader({
      header: HEADER_DECODER.decode(output.subarray(
        offset,
        headerEnd,
      ),),
      createError,
    },);
    if (header.oid !== requestedOid)
      throw createError(`Git blob batch returned ${header.oid} while ${requestedOid} was requested.`,);
    /**
     * Exact content start after header newline.
     */
    const contentStart = headerEnd + 1;
    /**
     * Exact content end derived from trusted parsed size.
     */
    const contentEnd = contentStart + header.size;
    if ((contentEnd >= output.length) || (output[contentEnd] !== NEWLINE_BYTE))
      throw createError(`Git blob batch returned truncated content for ${requestedOid}.`,);
    blobs.set(
      requestedOid,
      output.subarray(
        contentStart,
        contentEnd,
      ),
    );
    offset = contentEnd + 1;
  },);
  if (offset !== output.length)
    throw createError('Git blob batch returned unexpected trailing bytes.',);
  return blobs;
}

/**
 * Loads every unique requested blob through one Git batch subprocess.
 *
 * One persistent reader replaces per-candidate `cat-file blob` spawns, whose
 * fork and exec cost dominates mechanical commits touching thousands of paths.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param oids - blob IDs in candidate encounter order
 *
 * @param createError - domain error factory for batch failure and malformed output
 *
 * @returns exact blob bytes keyed by object ID
 *
 * @throws caller-domain error when Git exits nonzero or output is malformed
 *
 * @example
 * ```ts
 * await loadBlobBatch({ gitPath: '/usr/bin/git', cwd: '/repo', oids: [], createError: function toError(message,) { return new Error(message,); } });
 * ```
 */
export async function loadBlobBatch({
  gitPath,
  cwd,
  oids,
  createError,
}: {
  readonly gitPath: string;
  readonly cwd: string;
  readonly oids: readonly string[];
  readonly createError: (message: string) => Error;
},): Promise<ReadonlyMap<string, Uint8Array>> {
  /**
   * Unique request order avoids re-reading unchanged blobs across commit trees.
   */
  const requestedOids = [...new Set(oids,),];
  if (requestedOids.length === 0)
    return new Map();
  /**
   * One persistent Git object reader for complete request set.
   */
  const child = spawn(
    gitPath,
    [
      'cat-file',
      '--batch',
    ],
    {
      cwd,
      stdio: [
        'pipe',
        'pipe',
        'pipe',
      ],
    },
  );
  /**
   * Concurrent output consumers prevent either pipe from blocking Git.
   */
  const output = Promise.all([
    arrayBuffer(child.stdout,),
    text(child.stderr,),
  ],);
  child.stdin
    .end(REQUEST_ENCODER.encode(`${requestedOids.join('\n',)}\n`,),);
  await once(
    child,
    'close',
  );
  /**
   * Settled binary output and private diagnostic.
   */
  const [stdout, stderr,] = await output;
  if (child.exitCode !== 0)
    throw createError(`git cat-file --batch failed: ${stderr.trim()}`,);
  return parseBatchOutput({
    output: new Uint8Array(stdout,),
    requestedOids,
    createError,
  },);
}
