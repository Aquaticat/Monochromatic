/**
 * Stub for `sax`, aliased into the SEA bundle in place of the workspace-
 * blocklisted `sax` package.
 *
 * `@homebridge/dbus-native` statically requires `./introspect` in
 * `lib/bus.js`, which loads xml2js, whose parser does `require('sax')` at module
 * load but only runs when PARSING a remote object's introspection XML (client
 * role). key-helper is a D-Bus service: it answers Introspect from
 * `lib/stdifaces.js` without xml2js and never parses, so this stub lets the
 * bundle's module graph load and throws only if parsing is ever attempted.
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
