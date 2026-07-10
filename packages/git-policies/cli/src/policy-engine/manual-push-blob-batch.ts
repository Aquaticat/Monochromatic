/**
 * Batched Git blob loading for manual-push candidates.
 *
 * @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  arrayBuffer,
  text,
} from 'node:stream/consumers';
import { ManualPushProbeError, } from './manual-push-probe.ts';

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
 * @returns canonical object identity and size
 *
 * @example
 * ```ts
 * parseBatchHeader('abc blob 3');
 * ```
 */
function parseBatchHeader(header: string,): BatchHeader {
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
    throw new ManualPushProbeError(`Git blob batch returned malformed header: ${header}`,);
  if (objectType !== 'blob')
    throw new ManualPushProbeError(`Git blob batch returned ${objectType} for ${oid}.`,);
  /**
   * Parsed uncompressed byte length.
   */
  const size = Number(sizeText,);
  if ((!Number.isSafeInteger(size,)) || (size < 0)
    || (String(size,) !== sizeText))
    throw new ManualPushProbeError(`Git blob batch returned invalid size for ${oid}: ${sizeText}`,);
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
 * @returns exact blob bytes keyed by requested object ID
 *
 * @example
 * ```ts
 * parseBatchOutput({ output, requestedOids: ['abc'] });
 * ```
 */
function parseBatchOutput({
  output,
  requestedOids,
}: Readonly<{
  output: Uint8Array;
  requestedOids: readonly string[];
}>,): ReadonlyMap<string, Uint8Array> {
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
      throw new ManualPushProbeError(`Git blob batch omitted header for ${requestedOid}.`,);
    /**
     * Parsed successful batch header.
     */
    const header = parseBatchHeader(
      HEADER_DECODER.decode(output.subarray(
      offset,
      headerEnd,
    ),),
    );
    if (header.oid !== requestedOid)
      throw new ManualPushProbeError(`Git blob batch returned ${header.oid} while ${requestedOid} was requested.`,);
    /**
     * Exact content start after header newline.
     */
    const contentStart = headerEnd + 1;
    /**
     * Exact content end derived from trusted parsed size.
     */
    const contentEnd = contentStart + header.size;
    if ((contentEnd >= output.length) || (output[contentEnd] !== NEWLINE_BYTE))
      throw new ManualPushProbeError(`Git blob batch returned truncated content for ${requestedOid}.`,);
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
    throw new ManualPushProbeError('Git blob batch returned unexpected trailing bytes.',);
  return blobs;
}

/**
 * Loads every unique requested blob through one Git batch subprocess.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param oids - blob IDs in candidate encounter order
 *
 * @returns exact blob bytes keyed by object ID
 *
 * @example
 * ```ts
 * await loadManualPushBlobs({ gitPath: '/usr/bin/git', cwd: '/repo', oids: [] });
 * ```
 */
export async function loadManualPushBlobs({
  gitPath,
  cwd,
  oids,
}: Readonly<{
  gitPath: string;
  cwd: string;
  oids: readonly string[];
}>,): Promise<ReadonlyMap<string, Uint8Array>> {
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
    throw new ManualPushProbeError(`git cat-file --batch failed: ${stderr.trim()}`,);
  return parseBatchOutput({
    output: new Uint8Array(stdout,),
    requestedOids,
  },);
}
