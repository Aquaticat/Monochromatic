/** Type shim for `lezer-json5`, whose package metadata omits its bundled declarations. */
declare module 'lezer-json5' {
  /** JSON5 Lezer parser exported by the community package. */
  export const parser: import('@lezer/lr').LRParser;
}

/** Type shim for `lezer-toml`, whose package metadata omits its bundled declarations. */
declare module 'lezer-toml' {
  /** TOML Lezer parser exported by the community package. */
  export const parser: import('@lezer/lr').LRParser;
}
