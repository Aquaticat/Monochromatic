/**
 * JSON-RPC types and encoding for LSP wire transport.
 *
 * Defines the message types and provides Content-Length framing
 * for outgoing messages.
 */

//region Types

/** JSON-RPC request message (client-initiated, expects a response). */
export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
};

/** JSON-RPC notification message (no response expected). */
export type JsonRpcNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
};

/** JSON-RPC response message (server reply to a request). */
export type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

/** Any JSON-RPC message that can arrive from an LSP server. */
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

//endregion Types

//region Encoding

/**
 * Encodes a JSON-RPC message for LSP wire transport.
 * Prepends the `Content-Length` header followed by `\r\n\r\n`.
 *
 * @param message - JSON-serializable message object
 *
 * @returns Buffer containing the framed message
 */
export function encodeLspMessage({ message, }: { message: unknown; },): Buffer {
  const json = JSON.stringify(message,);
  const content = Buffer.from(
    json,
    'utf8',
  );
  const header = `Content-Length: ${content.byteLength}\r\n\r\n`;
  return Buffer.concat([
    Buffer.from(
      header,
      'ascii',
    ),
    content,
  ],);
}

//endregion Encoding
