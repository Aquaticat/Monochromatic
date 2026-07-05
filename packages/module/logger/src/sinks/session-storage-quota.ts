/**
 * Per-runtime default sessionStorage quota heuristics.
 *
 * The Web Storage API exposes no way to read the sessionStorage quota (unlike
 * `navigator.storage.estimate()`, which reports the unrelated persistent-storage
 * budget), so the sink caps its own footprint from a table of measured
 * defaults. Each figure was fill-probed on a fresh store: values are written at
 * a growing single key until a `QuotaExceededError`, binary-searching the
 * largest that fits. Figures are UTF-16 code units (JS string length, counting
 * key plus value) because that is what sessionStorage measures and what the
 * sink compares `serialized.length` against.
 *
 * @module
 */

/**
 * Measured default per-origin sessionStorage quotas, in UTF-16 code units, one
 * bucket per detectable runtime:
 *
 * - `deno`: 10 MiB on Deno 2.9.
 * - `node`: 5 MiB on Node 26.
 * - `browser`: 5 MiB, measured identical on Chromium, Firefox, and WebKit under
 *   Playwright v1.61, so the three engines share one bucket and no fragile
 *   user-agent sniffing is needed to tell them apart.
 *
 * Bun 1.3 exposes no `sessionStorage`, so it has no bucket; its sink never
 * verifies and never reaches the cap.
 */
const RUNTIME_QUOTA_CHARS = {
  deno: 10_485_760,
  node: 5_242_880,
  browser: 5_242_880,
} as const;

/**
 * Detects the current runtime's default sessionStorage quota in UTF-16 code
 * units, or `Number.POSITIVE_INFINITY` when the runtime is unrecognized so the
 * caller leaves its footprint uncapped and relies on reactive eviction alone.
 *
 * Detection is by host global rather than user-agent string: Deno and Bun both
 * shim `process` with a Node-compatible `process.versions.node`, so their own
 * globals are tested before the Node check to avoid misclassifying them.
 *
 * @returns Total quota in code units, or `Number.POSITIVE_INFINITY` if unknown.
 *
 * @example
 * ```ts
 * const capChars = detectSessionStorageQuotaChars() / 2; // half the total
 * ```
 */
export function detectSessionStorageQuotaChars(): number {
  if ('Deno' in globalThis)
    return RUNTIME_QUOTA_CHARS.deno;

  // Bun exposes no sessionStorage, so leave it uncapped: its sink never writes.
  if ('Bun' in globalThis)
    return Number.POSITIVE_INFINITY;

  if (((typeof process) !== 'undefined') && ((typeof process.versions
    .node) === 'string'))
    return RUNTIME_QUOTA_CHARS.node;

  if ('document' in globalThis)
    return RUNTIME_QUOTA_CHARS.browser;

  return Number.POSITIVE_INFINITY;
}
