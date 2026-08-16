// Validates the protocol revision that MCP revision 2026-07-28 requires
// on the `_meta` of every inbound request.

import type { JsonRpcRequest, } from './json-rpc.ts';

import { isPlainObject, } from './plain-object.ts';

import { isSupportedProtocolVersion, } from './protocol.ts';

import { META_PROTOCOL_VERSION, } from './protocol-meta.ts';

import {
  MissingProtocolVersionError,
  UnsupportedProtocolVersionError,
} from './server-protocol-error.ts';

//region Version validation: the gate every served request passes through

/**
 * Validates that a request declares a protocol revision this server implements.
 * Absence fails loud here rather than travelling onward: nothing downstream can serve a
 * request whose revision is unknown, so there is no caller for an "absent revision" value.
 *
 * @param request - Inbound request carrying revision metadata from the client.
 *
 * @returns Revision string the request declared, once accepted.
 *
 * @throws {@link MissingProtocolVersionError} when `_meta` carries no revision string.
 *
 * @throws {@link UnsupportedProtocolVersionError} when the declared revision is not implemented.
 *
 * @example
 * ```ts
 * requireProtocolVersion({
 *   request: {
 *     jsonrpc: '2.0',
 *     id: 1,
 *     method: 'tools/list',
 *     params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } },
 *   },
 * });
 * // '2026-07-28'
 * ```
 */
export function requireProtocolVersion(
  { request, }: { readonly request: JsonRpcRequest; },
): string {
  /**
   * Raw `_meta` value from params, still untrusted; anything but a keyed object cannot
   * carry the revision and is refused exactly as an omitted `_meta` is.
   */
  const rawMeta = request.params
    ?._meta;
  if (!isPlainObject(rawMeta,))
    throw new MissingProtocolVersionError();

  /**
   * Revision the client declared, refused below unless it is a string this server implements.
   */
  const version = rawMeta[META_PROTOCOL_VERSION];
  if ((typeof version) !== 'string')
    throw new MissingProtocolVersionError();
  if (!isSupportedProtocolVersion({ version, },))
    throw new UnsupportedProtocolVersionError({ requested: version, },);
  return version;
}

//endregion
