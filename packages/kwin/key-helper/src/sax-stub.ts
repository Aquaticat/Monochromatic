/**
 * Stub for `sax`, aliased into the SEA bundle in place of the workspace-
 * blocklisted `sax` package.
 *
 * dbus-next pulls in xml2js, whose parser does `require('sax')` at module load
 * but only calls `sax.parser()` when PARSING introspection XML (client role).
 * key-helper is server-only: it answers Introspect via xml2js's Builder and
 * never parses, so this stub lets the module load and throws only if parsing is
 * ever attempted.
 *
 * @module
 */

/**
 * Stand-in for `sax.parser`, which key-helper never calls.
 *
 * @throws {@link Error} always, since XML parsing is intentionally unbundled
 *
 * @example
 * ```ts
 * // Not reached in server-only D-Bus usage.
 * ```
 */
export function parser(): never {
  throw new Error('[key-helper] sax XML parsing is not bundled (server-only D-Bus usage)');
}

/**
 * Module-shaped default export; xml2js only ever reads `parser`.
 */
const sax: { parser: typeof parser } = { parser };

export default sax;
