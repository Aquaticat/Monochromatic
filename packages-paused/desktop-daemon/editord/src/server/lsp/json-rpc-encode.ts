/**
 * JSON-RPC types and encoding for LSP wire transport.
 *
 * Defines the message types and provides Content-Length framing
 * for outgoing messages.
 */

//region Types

/**
 * JSON-RPC request message (client-initiated, expects a response).
 */
export type JsonRpcRequest = {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly method: string;
  readonly params?: unknown;
};

/**
 * JSON-RPC notification message (no response expected).
 */
export type JsonRpcNotification = {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: unknown;
};

/**
 * JSON-RPC response message (server reply to a request).
 */
export type JsonRpcResponse = {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
};

/**
 * Any JSON-RPC message that can arrive from an LSP server.
 */
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
 *
 * @example
 * ```ts
 * const result = encodeLspMessage({ message: 'Operation completed', });
 * ```
 */
export function encodeLspMessage({ message, }: { readonly message: unknown; },): Buffer {
  /**
   * Stringified message; serves as the JSON-RPC body before UTF-8 encoding.
   */
  const json = JSON.stringify(message,);
  /**
   * UTF-8 encoded body; needed for the Content-Length byte count below.
   */
  const content = Buffer.from(
    json,
    'utf8',
  );
  /**
   * LSP-style framing header preceded by an empty line per the spec.
   */
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
