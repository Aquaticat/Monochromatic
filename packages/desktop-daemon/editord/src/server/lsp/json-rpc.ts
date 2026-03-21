/**
 * JSON-RPC framing for LSP communication over stdio.
 *
 * LSP messages are framed with HTTP-style `Content-Length` headers.
 * This module handles encoding outgoing messages and streaming-parsing
 * incoming messages from a readable byte stream.
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
  error?: { code: number; message: string; data?: unknown };
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
export function encodeLspMessage({ message, }: { message: unknown }): Buffer {
  const json = JSON.stringify(message,);
  const content = Buffer.from(json, 'utf8',);
  const header = `Content-Length: ${content.byteLength}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, 'ascii',), content,],);
}

//endregion Encoding

//region Parsing

/** Header separator between Content-Length header and JSON body. */
const HEADER_SEPARATOR = '\r\n\r\n';

/** Pattern to extract the content length from the header block. */
const CONTENT_LENGTH_PATTERN = /Content-Length:\s*(\d+)/i;

/**
 * Creates a streaming parser that extracts complete LSP messages
 * from sequential byte chunks.
 *
 * Feed chunks from a child process stdout into `feed()`;
 * each complete message triggers the `onMessage` callback.
 *
 * @param onMessage - callback invoked for each complete JSON-RPC message
 *
 * @returns object with a `feed` method accepting Buffer chunks
 */
export function createLspParser({ onMessage, }: {
  onMessage: (message: JsonRpcMessage,) => void;
}): { feed: (chunk: Buffer,) => void } {
  let buffer = Buffer.alloc(0,);
  let contentLength = -1;

  return {
    feed(chunk: Buffer,): void {
      buffer = Buffer.concat([buffer, chunk,],);

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- loop exits via return when buffer is incomplete
      while (true) {
        if (contentLength === -1) {
          const headerEnd = buffer.indexOf(HEADER_SEPARATOR,);
          if (headerEnd === -1)
            return;

          const header = buffer.subarray(0, headerEnd,).toString('ascii',);
          const match = CONTENT_LENGTH_PATTERN.exec(header,);
          if (match === null) {
            buffer = buffer.subarray(headerEnd + HEADER_SEPARATOR.length,);
            continue;
          }

          contentLength = Number(match[1],);
          buffer = buffer.subarray(headerEnd + HEADER_SEPARATOR.length,);
        }

        if (buffer.byteLength < contentLength)
          return;

        const json = buffer.subarray(0, contentLength,).toString('utf8',);
        buffer = buffer.subarray(contentLength,);
        contentLength = -1;

        try {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; callers validate via discriminant checks
          const message = JSON.parse(json,) as JsonRpcMessage;
          onMessage(message,);
        }
        catch {
          /* skip malformed messages */
        }
      }
    },
  };
}

//endregion Parsing
