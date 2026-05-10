/**
 * pkt-line codec for the git smart-HTTP protocol.
 *
 * pkt-line is git's framing format: a 4-byte hex length prefix
 * (length includes the prefix itself) followed by the payload.
 * The special case `"0000"` is the flush-pkt; `"0001"` is the
 * delim-pkt. Maximum data payload is 65516 bytes (so total length
 * fits in 65520 bytes).
 *
 * Format reference: `Documentation/gitprotocol-pack.txt` in the git
 * source tree, and isomorphic-git's `src/models/GitPktLine.js`.
 *
 * Vendored from isomorphic-git so the server can both encode wire
 * frames (it doesn't expose `mux`/`encode`) and decode incoming
 * `git-receive-pack` and `git-upload-pack` request bodies (it
 * doesn't expose these decoders either; see
 * `server/TROUBLESHOOTING.isomorphic-git.md`).
 */

/** Hexadecimal radix for pkt-len conversion. */
const HEX_RADIX = 16;

/** Number of hex digits in the pkt-len prefix. */
const PKT_LEN_BYTES = 4;

/** A flush-pkt is `"0000"`. */
const FLUSH_PKT = new TextEncoder().encode('0000',);

/** A delim-pkt is `"0001"`. */
const DELIM_PKT = new TextEncoder().encode('0001',);

/** Special pkt-len value indicating flush. */
const FLUSH_LEN = 0;

/** Special pkt-len value indicating delim. */
const DELIM_LEN = 1;

/**
 * Returns the flush-pkt sentinel (`"0000"`).
 *
 * @returns 4 bytes of ASCII `"0000"`
 *
 * @example
 * ```ts
 * flushPkt(); // <Uint8Array 30 30 30 30>
 * ```
 */
export function flushPkt(): Uint8Array {
  return new Uint8Array(FLUSH_PKT,);
}

/**
 * Returns the delim-pkt sentinel (`"0001"`).
 *
 * @returns 4 bytes of ASCII `"0001"`
 *
 * @example
 * ```ts
 * delimPkt();
 * ```
 */
export function delimPkt(): Uint8Array {
  return new Uint8Array(DELIM_PKT,);
}

/**
 * Encodes one pkt-line: prepends the hex length prefix to `payload`.
 *
 * @param payload - line content (bytes or UTF-8 string)
 *
 * @returns full pkt-line: 4-byte length prefix concatenated with payload
 *
 * @example
 * ```ts
 * encodePkt('hello\n');
 * ```
 */
export function encodePkt(payload: Uint8Array | string,): Uint8Array {
  const bytes = typeof payload === 'string'
    ? new TextEncoder().encode(payload,)
    : payload;
  const total = bytes.byteLength + PKT_LEN_BYTES;
  const lengthHex = total.toString(HEX_RADIX,).padStart(
    PKT_LEN_BYTES,
    '0',
  );
  const prefix = new TextEncoder().encode(lengthHex,);
  const out = new Uint8Array(total,);
  out.set(
    prefix,
    0,
  );
  out.set(
    bytes,
    PKT_LEN_BYTES,
  );
  return out;
}

/**
 * Decoded pkt-line. `null` represents a flush-pkt; `'delim'` represents a delim-pkt;
 * a `Uint8Array` is a regular data line (without the length prefix).
 */
export type PktLine = Uint8Array | null | 'delim';

/**
 * Decodes the `data` byte stream into a list of pkt-lines.
 *
 * @param data - concatenated pkt-line stream
 *
 * @returns parsed pkt-line list
 *
 * @example
 * ```ts
 * decodePktLines(buffer);
 * ```
 */
export function decodePktLines(data: Uint8Array,): PktLine[] {
  const decoder = new TextDecoder();
  const out: PktLine[] = [];
  let offset = 0;
  while (offset < data.byteLength) {
    if (data.byteLength - offset < PKT_LEN_BYTES) {
      throw new Error(
        `pkt-line decode: trailing ${
          String(data.byteLength - offset,)
        } bytes too short for length prefix`,
      );
    }
    const lengthSlice = data.subarray(
      offset,
      offset + PKT_LEN_BYTES,
    );
    const lengthText = decoder.decode(lengthSlice,);
    const length = Number.parseInt(
      lengthText,
      HEX_RADIX,
    );
    if (Number.isNaN(length,))
      throw new Error(`pkt-line decode: invalid length prefix "${lengthText}"`,);
    if (length === FLUSH_LEN) {
      out.push(null,);
      offset += PKT_LEN_BYTES;
      continue;
    }
    if (length === DELIM_LEN) {
      out.push('delim',);
      offset += PKT_LEN_BYTES;
      continue;
    }
    if (length < PKT_LEN_BYTES)
      throw new Error(`pkt-line decode: length ${String(length,)} below header size`,);
    if (offset + length > data.byteLength) {
      throw new Error(
        `pkt-line decode: line claims ${String(length,)} bytes but only ${
          String(data.byteLength - offset,)
        } remain`,
      );
    }
    const payload = data.subarray(
      offset + PKT_LEN_BYTES,
      offset + length,
    );
    out.push(new Uint8Array(payload,),);
    offset += length;
  }
  return out;
}
