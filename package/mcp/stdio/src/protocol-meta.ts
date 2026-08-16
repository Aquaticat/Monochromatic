// Reserved `_meta` keys and their payload types for MCP spec revision 2026-07-28.
// Revision 2026-07-28 moved version, identity, and capability reporting out of a
// session handshake and into per-message `_meta`, so these keys carry the negotiation.

//region Reserved key names: the `io.modelcontextprotocol/` namespace

/**
 * `_meta` key naming the protocol revision a request is written against.
 * Mandatory on every inbound request under revision 2026-07-28.
 */
export const META_PROTOCOL_VERSION = 'io.modelcontextprotocol/protocolVersion';

/**
 * `_meta` key naming the client software that sent a request.
 * Self-reported and unverified, so it belongs in logs and displays, never in a security decision.
 */
export const META_CLIENT_INFO = 'io.modelcontextprotocol/clientInfo';

/**
 * `_meta` key carrying capabilities the client offers for one request.
 * Declared per request because revision 2026-07-28 keeps no session state to infer them from.
 */
export const META_CLIENT_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities';

/**
 * `_meta` key naming the server software that produced a result.
 * Servers should stamp it on every response so clients can log and display which server answered.
 */
export const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

//endregion

//region Implementation identity: how a client or server names itself

/**
 * Identity of one MCP implementation, used for both client and server info.
 * `title` is for display; `name` stays programmatic and is the display fallback.
 *
 * @example
 * ```ts
 * const info: Implementation = { name: 'mvm', version: '0.1.0', title: 'mvm VM manager' };
 * ```
 */
export type Implementation = {
  readonly name: string;
  readonly version: string;
  readonly title?: string;
};

//endregion

//region Request and result metadata objects carried on the wire

/**
 * Capabilities a client declares on a single request.
 * Kept loose because the set is open: any client may declare capabilities beyond the spec's.
 *
 * @example
 * ```ts
 * const capabilities: ClientCapabilities = { elicitation: {} };
 * ```
 */
export type ClientCapabilities = Readonly<Record<string, unknown>>;

/**
 * `_meta` object attached to an inbound request.
 * Only {@link META_PROTOCOL_VERSION} is required; the rest inform logging and display.
 *
 * @example
 * ```ts
 * const meta: RequestMeta = {
 *   'io.modelcontextprotocol/protocolVersion': '2026-07-28',
 *   'io.modelcontextprotocol/clientCapabilities': {},
 * };
 * ```
 */
export type RequestMeta = {
  readonly [META_PROTOCOL_VERSION]?: string;
  readonly [META_CLIENT_INFO]?: Implementation;
  readonly [META_CLIENT_CAPABILITIES]?: ClientCapabilities;
};

/**
 * `_meta` object attached to an outbound result.
 *
 * @example
 * ```ts
 * const meta: ResultMeta = {
 *   'io.modelcontextprotocol/serverInfo': { name: 'mvm', version: '0.1.0' },
 * };
 * ```
 */
export type ResultMeta = {
  readonly [META_SERVER_INFO]?: Implementation;
};

//endregion
