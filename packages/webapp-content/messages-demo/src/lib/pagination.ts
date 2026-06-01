/**
 * Keyset cursor encode/decode for the message feed.
 *
 * The feed orders by `(created_at DESC, id DESC)`. A cursor is the pair
 * `(created_at, id)` of the last-shown message; the next page selects
 * rows that sort strictly *after* the cursor in the same ordering.
 *
 * Encoded form is URL-safe base64 of `"<created_at>:<id>"`. The encoded
 * payload is opaque to the client; the server is the only consumer.
 */

/**
 * One page of feed results contains this many messages.
 */
export const FEED_PAGE_SIZE = 20;

/**
 * Decimal radix for `parseInt`.
 */
const DECIMAL_RADIX = 10;

/**
 * Base64 group size; padding aligns the input to a multiple of this.
 */
const BASE64_GROUP_SIZE = 4;

/**
 * Materialised cursor coordinates, decoded from a cursor string.
 */
export type Cursor = {
  readonly createdAt: number;
  readonly id: number;
};

/**
 * Encodes a `(createdAt, id)` pair into a URL-safe cursor token.
 *
 * @param cursor - position of the last message on the current page
 *
 * @returns URL-safe base64 string suitable for inclusion in a path segment
 *
 * @example
 * ```ts
 * encodeCursor({ createdAt: 1714080000000, id: 1042 });
 * // 'MTcxNDA4MDAwMDAwMDoxMDQy'
 * ```
 */
export function encodeCursor(cursor: Cursor,): string {
  /**
   * ASCII-only pre-encoded form fed to the base64 helper.
   */
  const raw = `${String(cursor.createdAt,)}:${String(cursor.id,)}`;
  return base64UrlEncode(raw,);
}

/**
 * Decodes a cursor token back into coordinates. Throws on malformed input.
 *
 * @param token - URL-safe cursor produced by `encodeCursor`
 *
 * @returns decoded coordinates
 *
 * @throws `Error` when the token is not a valid `<int>:<int>` pair
 *
 * @example
 * ```ts
 * decodeCursor('MTcxNDA4MDAwMDAwMDoxMDQy');
 * // { createdAt: 1714080000000, id: 1042 }
 * ```
 */
export function decodeCursor(token: string,): Cursor {
  /**
   * Decoded `<int>:<int>` pair fed to the colon-split below.
   */
  const raw = base64UrlDecode(token,);
  /**
   * Colon offset separating the two integers; `-1` signals malformed input.
   */
  const colon = raw.indexOf(':',);
  if (colon === (-1))
    throw new Error(`malformed cursor: ${token}`,);
  /**
   * Created-at half parsed as an integer.
   */
  const createdAt = Number.parseInt(
    raw.slice(
      0,
      colon,
    ),
    DECIMAL_RADIX,
  );
  /**
   * Id half parsed as an integer.
   */
  const id = Number.parseInt(
    raw.slice(colon + 1,),
    DECIMAL_RADIX,
  );
  if ((!Number.isFinite(createdAt,)) || (!Number.isFinite(id,)))
    throw new Error(`malformed cursor: ${token}`,);
  return {
    createdAt,
    id,
  };
}

/**
 * URL-safe base64 of a UTF-8 string. Replaces `+/=` with `-_` and strips
 * trailing padding.
 *
 * @param value - UTF-8 string to encode
 *
 * @returns URL-safe base64
 */
function base64UrlEncode(value: string,): string {
  // btoa requires a Latin-1 string; we encode UTF-8 bytes first to
  // support non-ASCII safely, even though cursors are ASCII today.
  /**
   * UTF-8 byte view of `value`; iterated below into a Latin-1 string for `btoa`.
   */
  const bytes = new TextEncoder().encode(value,);
  /**
   * Latin-1 representation of the UTF-8 bytes; safe input for `btoa`.
   */
  const binary = Array
    .from(
      bytes,
      function toLatin1(byte,) {
        return String.fromCodePoint(byte,);
      },
    )
    .join('',);
  /* oxlint-disable no-restricted-syntax/no-regex -- trailing `=` padding strip on a fixed-length base64 string; anchored to end, no backtracking risk */
  return globalThis
    .btoa(binary,)
    .replaceAll(
      '+',
      '-',
    )
    .replaceAll(
      '/',
      '_',
    )
    .replace(
      /=+$/u,
      '',
    );
  /* oxlint-enable no-restricted-syntax/no-regex */
}

/**
 * Inverse of `base64UrlEncode`. Restores `+/=` padding before decoding.
 *
 * @param value - URL-safe base64 string
 *
 * @returns decoded UTF-8 string
 */
function base64UrlDecode(value: string,): string {
  /**
   * URL-safe input with `-_` mapped back to `+/`; padded below to a 4-group boundary.
   */
  const unpadded = value
    .replaceAll(
      '-',
      '+',
    )
    .replaceAll(
      '_',
      '/',
    );
  /**
   * Number of `=` characters needed to reach the next 4-group boundary.
   */
  const padLength = (BASE64_GROUP_SIZE - (unpadded.length
    % BASE64_GROUP_SIZE))
    % BASE64_GROUP_SIZE;
  /**
   * Base64 input ready for `atob`; trailing `=` restored to a 4-group boundary.
   */
  const padded = unpadded + '='
    .repeat(padLength,);
  /**
   * Latin-1 string of decoded bytes; rewrapped into a Uint8Array below for `TextDecoder`.
   */
  const binary = globalThis.atob(padded,);
  /**
   * Byte buffer copied from `binary`; decoded back to UTF-8 below.
   */
  const bytes = new Uint8Array(binary.length,);
  for (let loopIndex = 0; loopIndex < binary
    .length; loopIndex += 1)
    bytes[loopIndex] = binary.codePointAt(loopIndex,)
      ?? 0;
  return new TextDecoder().decode(bytes,);
}
