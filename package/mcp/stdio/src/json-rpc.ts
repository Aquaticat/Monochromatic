// JSON-RPC 2.0 types, error codes, and message validation for MCP stdio transport.
// Justification for >100 lines: all JSON-RPC wire types, their error codes, and the
// type guard that validates them form a single cohesive unit; splitting would scatter
// tightly-coupled definitions that are always imported together.

import { isPlainObject, } from './plain-object.ts';

//region JSON-RPC 2.0 base types: foundation for all MCP message exchange

/**
 * Unique request identifier. MCP uses integer or string ids per JSON-RPC 2.0.
 */
export type JsonRpcId = number | string;

/**
 * Inbound JSON-RPC request from client to server.
 *
 * @example
 * ```ts
 * const request: JsonRpcRequest = {
 *   jsonrpc: '2.0',
 *   id: 1,
 *   method: 'tools/list',
 *   params: {},
 * };
 * ```
 */
export type JsonRpcRequest = {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
};

/**
 * Inbound JSON-RPC notification from client. Notifications carry no `id` and expect no response.
 *
 * @example
 * ```ts
 * const notification: JsonRpcNotification = {
 *   jsonrpc: '2.0',
 *   method: 'notifications/initialized',
 * };
 * ```
 */
export type JsonRpcNotification = {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
};

/**
 * Outbound JSON-RPC success response.
 *
 * @example
 * ```ts
 * const response: JsonRpcResponse = {
 *   jsonrpc: '2.0',
 *   id: 1,
 *   result: { tools: [] },
 * };
 * ```
 */
export type JsonRpcResponse = {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly result: unknown;
};

/**
 * Structured error detail within a JSON-RPC error response.
 *
 * @example
 * ```ts
 * const error: JsonRpcErrorDetail = {
 *   code: -32602,
 *   message: 'Unknown tool: foo',
 * };
 * ```
 */
export type JsonRpcErrorDetail = {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
};

/**
 * Outbound JSON-RPC error response.
 * Allows `null` for `id` per JSON-RPC 2.0 section 5: when the request id
 * cannot be determined (parse errors, invalid structure), id must be null.
 *
 * @example
 * ```ts
 * const errorResponse: JsonRpcErrorResponse = {
 *   jsonrpc: '2.0',
 *   id: null,
 *   error: { code: -32700, message: 'Failed to parse JSON' },
 * };
 * ```
 */
export type JsonRpcErrorResponse = {
  readonly jsonrpc: '2.0';
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- JSON-RPC 2.0 section 5 mandates the literal wire value `null` for `id` when the request id cannot be determined (parse errors, invalid structure); this `null` is the external protocol's required output, not an internal absence sentinel.
  readonly id: JsonRpcId | null;
  readonly error: JsonRpcErrorDetail;
};

/**
 * Any message the server may send back over stdout.
 */
export type JsonRpcOutbound = JsonRpcResponse | JsonRpcErrorResponse;

/**
 * Any message the server may receive over stdin.
 */
export type JsonRpcInbound = JsonRpcRequest | JsonRpcNotification;

//endregion

//region Standard JSON-RPC error codes: used for protocol-level failures

/**
 * Message parsed as JSON but is not a valid JSON-RPC request or notification object.
 * Distinct from {@link JSON_RPC_PARSE_ERROR}, which covers text that is not JSON at all.
 */
export const JSON_RPC_INVALID_REQUEST = -32_600;

/**
 * Method does not exist or is not available.
 */
export const JSON_RPC_METHOD_NOT_FOUND = -32_601;

/**
 * Invalid method parameters.
 */
export const JSON_RPC_INVALID_PARAMS = -32_602;

/**
 * Internal server error.
 */
export const JSON_RPC_INTERNAL_ERROR = -32_603;

/**
 * Failed to parse JSON.
 */
export const JSON_RPC_PARSE_ERROR = -32_700;

/**
 * Request declared a protocol revision this server does not implement.
 * MCP-specific code from spec revision 2026-07-28; its `data` names the revisions
 * the server does support so the client can retry on one of them.
 */
export const JSON_RPC_UNSUPPORTED_PROTOCOL_VERSION = -32_022;

//endregion

//region Message validation: type guard for untrusted JSON parsed from stdin

/**
 * Validates that a parsed JSON value has the shape of a {@link JsonRpcInbound} message.
 * Requires `jsonrpc: '2.0'` and a string `method`, and rejects an `id` or `params` whose
 * type contradicts the declared wire types: an unsound guard would let a request with a
 * `null`, boolean, or object `id` reach dispatch and be echoed into a response.
 *
 * @param value - Untrusted parsed JSON from stdin.
 *
 * @returns `true` if value conforms to the {@link JsonRpcInbound} shape.
 *
 * @example
 * ```ts
 * const parsed: unknown = JSON.parse(line);
 * if (!isJsonRpcMessage(parsed)) {
 *   // send invalid-request response
 * }
 * ```
 */
export function isJsonRpcMessage(value: unknown,): value is JsonRpcInbound {
  if (!isPlainObject(value,))
    return false;
  if ((value.jsonrpc !== '2.0') || ((typeof value.method) !== 'string'))
    return false;
  // An absent `id` marks a notification; a present one must be a number or string.
  if (('id' in value) && ((typeof value.id) !== 'number')
    && ((typeof value.id) !== 'string'))
    return false;
  return (value.params === undefined) || isPlainObject(value.params,);
}

//endregion
