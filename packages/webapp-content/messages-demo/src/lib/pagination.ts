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

/** One page of feed results contains this many messages. */
export const FEED_PAGE_SIZE = 20;

/** Decimal radix for `parseInt`. */
const DECIMAL_RADIX = 10;

/** Base64 group size; padding aligns the input to a multiple of this. */
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
  const raw = base64UrlDecode(token,);
  const colon = raw.indexOf(':',);
  if (colon === -1)
    throw new Error(`malformed cursor: ${token}`,);
  const createdAt = Number.parseInt(
    raw.slice(
      0,
      colon,
    ),
    DECIMAL_RADIX,
  );
  const id = Number.parseInt(
    raw.slice(colon + 1,),
    DECIMAL_RADIX,
  );
  if (!Number.isFinite(createdAt,) || !Number.isFinite(id,))
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
  const bytes = new TextEncoder().encode(value,);
  let binary = '';
  for (const byte of bytes)
    binary += String.fromCodePoint(byte,);
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
      /=+$/,
      '',
    );
}

/**
 * Inverse of `base64UrlEncode`. Restores `+/=` padding before decoding.
 *
 * @param value - URL-safe base64 string
 *
 * @returns decoded UTF-8 string
 */
function base64UrlDecode(value: string,): string {
  let padded = value
    .replaceAll(
      '-',
      '+',
    )
    .replaceAll(
      '_',
      '/',
    );
  while (padded.length % BASE64_GROUP_SIZE !== 0)
    padded += '=';
  const binary = globalThis.atob(padded,);
  const bytes = new Uint8Array(binary.length,);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.codePointAt(index,) ?? 0;
  return new TextDecoder().decode(bytes,);
}
