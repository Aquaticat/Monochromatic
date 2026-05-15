/**
 * TOML key encoding helpers.
 *
 * @module
 */

//region Key encoding

/**
 * Encode a key string. Bare when matches `[A-Za-z0-9_-]+`, basic-quoted otherwise.
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
  if (/^[A-Za-z0-9_-]+$/.test(key,) && (key.length > 0))
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
