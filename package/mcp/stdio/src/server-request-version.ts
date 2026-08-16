// Reads and validates the protocol revision that MCP revision 2026-07-28 requires
// on the `_meta` of every inbound request.

import type { JsonRpcRequest, } from './json-rpc.ts';

import { isSupportedProtocolVersion, } from './protocol.ts';

import {
  META_PROTOCOL_VERSION,
  type RequestMeta,
} from './protocol-meta.ts';

import {
  MissingProtocolVersionError,
  UnsupportedProtocolVersionError,
} from './server-protocol-error.ts';

//region Metadata extraction: pulls `_meta` out of untrusted request params

/**
 * Extracts the `_meta` object from request params without trusting its shape.
 *
 * @param request - Inbound request whose params arrived unvalidated from the client.
 *
 * @returns Metadata object, or `undefined` when params carry no usable `_meta`.
 *
 * @example
 * ```ts
 * readRequestMeta({ request: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: {} } } });
 * // {}
 * ```
 */
export function readRequestMeta(
  { request, }: { readonly request: JsonRpcRequest; },
): RequestMeta | undefined {
  /**
   * Raw `_meta` value from params; anything other than a plain object is treated as absent.
   */
  const rawMeta = request.params?._meta;
  if ((rawMeta === undefined)
    || (rawMeta === null)
    || ((typeof rawMeta) !== 'object')
    || Array.isArray(rawMeta,))
    return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed from unknown to non-array object above; every RequestMeta field is optional, so the assertion adds no unchecked requirement
  return rawMeta as RequestMeta;
}

//endregion

//region Version validation: the gate every served request passes through

/**
 * Validates that a request declares a protocol revision this server implements.
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
   * Declared revision, or `undefined` when the client omitted it or sent a non-string.
   */
  const version = readRequestMeta({ request, },)?.[META_PROTOCOL_VERSION];
  if ((typeof version) !== 'string')
    throw new MissingProtocolVersionError();
  if (!isSupportedProtocolVersion({ version, },))
    throw new UnsupportedProtocolVersionError({ requested: version, },);
  return version;
}

//endregion
