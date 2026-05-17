/**
 * TOML key encoding helpers.
 *
 * @module
 */

//region Key encoding

/**
 * Tests whether `c` is permitted inside a TOML bare key (`[A-Za-z0-9_-]`).
 *
 * @param c - single character
 *
 * @returns whether `c` is a TOML bare-key character
 */
function isBareKeyChar(c: string,): boolean {
  return ((c >= 'a') && (c <= 'z'))
    || ((c >= 'A') && (c <= 'Z'))
    || ((c >= '0') && (c <= '9'))
    || (c === '_')
    || (c === '-');
}

/**
 * Tests whether every char of `key` is a TOML bare-key char (and `key`
 * is non-empty). Mirrors the shape of `/^[A-Za-z0-9_-]+$/` with a
 * linear scan.
 *
 * @param key - candidate TOML key
 *
 * @returns whether `key` is a valid TOML bare key
 */
function isBareKey(key: string,): boolean {
  if (key.length === 0)
    return false;
  /**
   * Recursive walker: every char must satisfy `isBareKeyChar`.
   *
   * @param idx - cursor into `key`
   *
   * @returns whether the suffix from `idx` is all bare-key chars
   */
  function walk(idx: number,): boolean {
    if (idx >= key.length)
      return true;
    if (!isBareKeyChar(key.charAt(idx,),))
      return false;
    return walk(idx + 1,);
  }
  return walk(0,);
}

/**
 * Encode a key string. Bare when every char is `[A-Za-z0-9_-]`, basic-quoted otherwise.
 *
 * @param key - Raw key segment.
 *
 * @returns TOML key segment text.
 *
 * @example
 * ```ts
 * encodeKey({ key: 'tools', },);  // 'tools'
 * encodeKey({ key: 'my key', },); // '"my key"'
 * ```
 */
export function encodeKey({ key, }: { key: string; },): string {
  if (isBareKey(key,))
    return key;
  return `"${
    key
      .replaceAll(
        '\\',
        String.raw`\\`,
      )
      .replaceAll(
        '"',
        String.raw`\"`,
      )
  }"`;
}

//endregion Key encoding
