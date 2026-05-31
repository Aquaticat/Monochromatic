/**
 * `info/refs` advertisement builder for the smart-HTTP protocol.
 *
 * Split out of `iso-server.ts` for the max-lines budget.
 */

import {
  ensureRepoExists,
  listAllRefs,
  ZERO_OID,
} from './iso-server-refs.ts';
import {
  encodePkt,
  flushPkt,
} from './pkt-line.ts';

/**
 * Capabilities advertised in `info/refs?service=git-upload-pack`.
 */
const UPLOAD_PACK_CAPS: readonly string[] = [
  'multi_ack',
  'multi_ack_detailed',
  'side-band',
  'side-band-64k',
  'thin-pack',
  'ofs-delta',
  'agent=monochromatic-forge/0',
];

/**
 * Capabilities advertised in `info/refs?service=git-receive-pack`.
 */
const RECEIVE_PACK_CAPS: readonly string[] = [
  'report-status',
  'side-band-64k',
  'ofs-delta',
  'delete-refs',
  'agent=monochromatic-forge/0',
];

/**
 * Builds the smart-HTTP `info/refs` advertisement.
 *
 * Layout: `PKT-LINE("# service=<service>\n")`, flush-pkt, then either
 * the standard refs advertisement or the empty-repo placeholder when
 * the repo has no refs.
 *
 * @param row - inputs
 *
 * @returns concatenated bytes ready for the response body
 *
 * @example
 * ```ts
 * const body = await buildInfoRefsAdvertisement({
 *   owner: 'alice',
 *   repo: 'demo',
 *   service: 'git-upload-pack',
 * });
 * ```
 */
export async function buildInfoRefsAdvertisement(row: {
  readonly owner: string;
  readonly repo: string;
  readonly service: 'git-upload-pack' | 'git-receive-pack';
},): Promise<Uint8Array> {
  /**
   * On-disk repo path the advertisement is built against.
   */
  const gitdir = await ensureRepoExists({
    owner: row.owner,
    repo: row.repo,
  },);
  /**
   * Capability set advertised depends on which service the client requested.
   */
  const caps = row.service
    === 'git-upload-pack' ? UPLOAD_PACK_CAPS : RECEIVE_PACK_CAPS;
  /**
   * Existing refs decide between empty-repo placeholder and standard layout.
   */
  const refs = await listAllRefs({ gitdir, },);
  /**
   * Accumulator for the response body parts in protocol order.
   */
  const chunks: Uint8Array[] = [
    encodePkt(`# service=${row.service}\n`,),
    flushPkt(),
  ];
  if (refs.length
    === 0) {
    /**
     * Synthetic `capabilities^{}` pkt-line is required when no refs exist.
     */
    const head = `${ZERO_OID} capabilities^{}\0${caps.join(' ',)}\n`;
    chunks.push(encodePkt(head,),);
  }
  else {
    for (const [index, [refName, oid,],] of refs.entries()) {
      /**
       * First ref carries the capabilities suffix; subsequent refs do not.
       */
      const line = index === 0
        ? `${oid} ${refName}\0${caps.join(' ',)}\n`
        : `${oid} ${refName}\n`;
      chunks.push(encodePkt(line,),);
    }
  }
  chunks.push(flushPkt(),);
  return concatChunks(chunks,);
}

/**
 * Concatenates byte chunks into a single `Uint8Array`. Local-only because
 * `iso-server.ts` ships its own copy.
 *
 * @param chunks - ordered chunks
 *
 * @returns a single `Uint8Array` containing every chunk in order
 *
 * @example
 * ```ts
 * concatChunks([new Uint8Array([1]), new Uint8Array([2])]);
 * ```
 */
function concatChunks(chunks: readonly Uint8Array[],): Uint8Array {
  /**
   * Running sum of every chunk's byte length to size the output buffer.
   */
  let total = 0;
  for (const chunk of chunks)
    total += chunk.byteLength;
  /**
   * Destination buffer sized exactly to the total chunk length.
   */
  const out = new Uint8Array(total,);
  /**
   * Write position advancing through `out` as each chunk is copied.
   */
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(
      chunk,
      cursor,
    );
    cursor += chunk.byteLength;
  }
  return out;
}
