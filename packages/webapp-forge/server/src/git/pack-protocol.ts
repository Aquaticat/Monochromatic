/**
 * Smart-HTTP wire protocol parsers vendored from the gaps in
 * `isomorphic-git`'s server-side surface.
 *
 * isomorphic-git ships `parseUploadPackRequest` and `writeRefsAdResponse`
 * but does **not** ship server-side `parseReceivePackRequest`,
 * `writeReceivePackResponse`, `writeUploadPackResponse`, or sideband
 * multiplex (`mux` is commented out in `src/models/GitSideBand.js`).
 *
 * This file holds the parsers and shared types. Writers and the sideband
 * multiplexer live in `pack-protocol-writers.ts`.
 *
 * Spec references:
 *
 * - Documentation/gitprotocol-pack.txt in the git source tree
 * - https://git-scm.com/docs/protocol-v0
 * - isomorphic-git's `src/wire/parseUploadPackRequest.js` and
 *   `src/wire/writeRefsAdResponse.js` for the analogous client/server shapes
 */

import { decodePktLines, } from './pkt-line.ts';

export {
  multiplexSideband,
  type RefUpdateResult,
  SidebandChannels,
  writeReceivePackResponse,
  writeUploadPackResponse,
} from './pack-protocol-writers.ts';

/** Pkt-line header is 4 hex digits (length-as-hex). */
const PKT_HEADER_BYTES = 4;

/** Hex radix shared by all pkt-len conversions. */
const PKT_HEX_RADIX = 16;

/** Minimum number of whitespace-separated tokens in a receive-pack triplet (`old new ref`). */
const TRIPLET_MIN_TOKENS = 3;

/** ASCII line-feed used as optional trailing terminator on pkt-line text payloads. */
const ASCII_LF = 0x0A;

/**
 * One ref-update triplet sent by the client (`oldOid newOid refName`).
 */
export type RefUpdateTriplet = {
  readonly oldOid: string;
  readonly newOid: string;
  readonly refName: string;
};

/**
 * Parsed `git-receive-pack` request body. The packfile bytes are
 * everything after the trailing flush-pkt; they may be empty if all
 * triplets are deletions.
 */
export type ReceivePackRequest = {
  /** Capabilities advertised by the client (parsed from the first triplet). */
  readonly capabilities: readonly string[];
  /** Ordered ref-update triplets `(old, new, refname)`. */
  readonly triplets: readonly RefUpdateTriplet[];
  /** Raw pack data following the flush-pkt; empty when the request is delete-only. */
  readonly packfile: Uint8Array;
};

/**
 * Parsed `git-upload-pack` request body.
 *
 * @example
 * ```ts
 * const req = parseUploadPackBody(body);
 * for (const oid of req.wants) await sendObject(oid);
 * ```
 */
export type UploadPackRequest = {
  /** Capabilities the client advertised in the first `want` line. */
  readonly capabilities: readonly string[];
  /** OIDs the client wants to receive. */
  readonly wants: readonly string[];
  /** OIDs the client already has (used for thin-pack negotiation). */
  readonly haves: readonly string[];
  /** OIDs the client wants to mark as shallow. */
  readonly shallows: readonly string[];
  /** Whether the client signalled the negotiation is complete. */
  readonly done: boolean;
};

/**
 * Decodes a `git-receive-pack` request body.
 *
 * Wire shape: ordered pkt-lines `(old new ref [\0caps])`, terminated by a
 * flush-pkt, optionally followed by raw pack bytes.
 *
 * @param body - concatenated request body bytes
 *
 * @returns parsed request
 *
 * @throws when the body is malformed (missing flush-pkt, malformed triplet)
 *
 * @example
 * ```ts
 * const { capabilities, triplets, packfile } = parseReceivePackBody(body);
 * ```
 */
export function parseReceivePackBody(body: Uint8Array,): ReceivePackRequest {
  const decoder = new TextDecoder();
  const triplets: RefUpdateTriplet[] = [];
  let capabilities: readonly string[] = [];
  let offset = 0;
  let sawFlush = false;
  while (offset < body.byteLength) {
    if (body.byteLength - offset < PKT_HEADER_BYTES)
      throw new Error('receive-pack: truncated pkt-len header',);
    const lengthHex = decoder.decode(body.subarray(
      offset,
      offset + PKT_HEADER_BYTES,
    ),);
    const length = Number.parseInt(
      lengthHex,
      PKT_HEX_RADIX,
    );
    if (length === 0) {
      sawFlush = true;
      offset += PKT_HEADER_BYTES;
      break;
    }
    if (length < PKT_HEADER_BYTES)
      throw new Error(`receive-pack: invalid pkt-len ${String(length,)}`,);
    if (offset + length > body.byteLength)
      throw new Error('receive-pack: pkt-line overruns body',);
    const payload = body.subarray(
      offset + PKT_HEADER_BYTES,
      offset + length,
    );
    offset += length;
    // Strip optional trailing LF.
    const trimmed = payload[payload.byteLength - 1] === ASCII_LF
      ? payload.subarray(
        0,
        payload.byteLength - 1,
      )
      : payload;
    const text = decoder.decode(trimmed,);
    const nullSplit = text.split('\0',);
    const tripletText = nullSplit[0] ?? '';
    if (triplets.length === 0 && nullSplit.length >= 2) {
      const capsText = nullSplit[1] ?? '';
      capabilities = capsText.length === 0
        ? []
        : capsText.split(' ',).filter(function nonEmpty(s,) {
          return s.length > 0;
        },);
    }
    const parts = tripletText.split(' ',);
    if (parts.length < TRIPLET_MIN_TOKENS)
      throw new Error(`receive-pack: malformed triplet "${tripletText}"`,);
    const [oldOid, newOid, ...refTokens] = parts;
    triplets.push({
      oldOid: oldOid ?? '',
      newOid: newOid ?? '',
      refName: refTokens.join(' ',),
    },);
  }
  if (!sawFlush)
    throw new Error('receive-pack: missing flush-pkt before pack data',);
  const packfile = new Uint8Array(body.subarray(offset,),);
  return {
    capabilities,
    triplets,
    packfile,
  };
}

/**
 * Decodes a `git-upload-pack` request body.
 *
 * Wire shape: ordered pkt-lines `("want " <oid> [<caps>])`,
 * `("have " <oid>)`, optional `shallow` / `deepen-*`, terminated either
 * by a flush-pkt or by `"done"`.
 *
 * @param body - concatenated request body bytes
 *
 * @returns parsed request
 *
 * @example
 * ```ts
 * const req = parseUploadPackBody(body);
 * ```
 */
export function parseUploadPackBody(body: Uint8Array,): UploadPackRequest {
  const decoder = new TextDecoder();
  const wants: string[] = [];
  const haves: string[] = [];
  const shallows: string[] = [];
  let capabilities: readonly string[] = [];
  let done = false;
  for (const line of decodePktLines(body,)) {
    if (line === null || line === 'delim')
      continue;
    const trimmed = line[line.byteLength - 1] === ASCII_LF
      ? line.subarray(
        0,
        line.byteLength - 1,
      )
      : line;
    const text = decoder.decode(trimmed,).trim();
    if (text === 'done') {
      done = true;
      continue;
    }
    const tokens = text.split(' ',);
    const [key, value, ...rest] = tokens;
    if (capabilities.length === 0 && rest.length > 0) {
      capabilities = rest.filter(function nonEmpty(s,) {
        return s.length > 0;
      },);
    }
    if (value === undefined || value === '')
      continue;
    if (key === 'want') {
      wants.push(value,);
    } else if (key === 'have') {
      haves.push(value,);
    } else if (key === 'shallow') {
      shallows.push(value,);
    }
  }
  return {
    capabilities,
    wants,
    haves,
    shallows,
    done,
  };
}
