/**
 * JSON-RPC streaming parser for LSP communication over stdio.
 *
 * Extracts complete LSP messages from sequential byte chunks
 * using Content-Length header framing.
 */

import type { JsonRpcMessage, } from './json-rpc-encode.ts';

export {
  encodeLspMessage,
  type JsonRpcMessage,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './json-rpc-encode.ts';

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
 * @param onError - callback invoked when a message fails to parse as JSON
 *
 * @returns object with a `feed` method accepting Buffer chunks
 *
 * @example
 * ```ts
 * const parser = createLspParser({
 *   onMessage: function handleMessage(msg) { pending.get(msg.id)?.resolve(msg); },
 *   onError: function handleError(err) { console.error(err); },
 * });
 * parser.feed(chunk);
 * ```
 */
export function createLspParser({
  onMessage,
  onError,
}: {
  onMessage: (message: JsonRpcMessage,) => void;
  onError: (error: unknown,) => void;
},): { feed: (chunk: Buffer,) => void; } {
  /** Pending chunks that haven't been consolidated yet. */
  const chunks: Buffer[] = [];
  /** Total byte length across all pending chunks. */
  let totalLength = 0;
  /** Consolidated buffer: rebuilt from chunks only when needed for parsing. */
  let buffer = Buffer.alloc(0,);
  let contentLength = -1;

  /**
   * Consolidates pending chunks into a single buffer.
   * Only copies when multiple chunks are pending, avoiding
   * the O(N^2) cost of `Buffer.concat` on every incoming chunk.
   */
  function consolidate(): void {
    if (chunks.length === 0)
      return;
    buffer = Buffer.concat([
      buffer,
      ...chunks,
    ],);
    chunks.length = 0;
    totalLength = buffer.byteLength;
  }

  return {
    feed(chunk: Buffer,): void {
      chunks.push(chunk,);
      totalLength += chunk.byteLength;

      // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- loop exits via return when buffer is incomplete
      while (true) {
        if (contentLength === -1) {
          consolidate();
          const headerEnd = buffer.indexOf(HEADER_SEPARATOR,);
          if (headerEnd === -1)
            return;

          const header = buffer
            .subarray(
              0,
              headerEnd,
            )
            .toString('ascii',);
          const match = CONTENT_LENGTH_PATTERN.exec(header,);
          if (match === null) {
            buffer = buffer.subarray(headerEnd + HEADER_SEPARATOR.length,);
            totalLength = buffer.byteLength;
            continue;
          }

          contentLength = Number(match[1],);
          buffer = buffer.subarray(headerEnd + HEADER_SEPARATOR.length,);
          totalLength = buffer.byteLength;
        }

        /** Wait for enough data before consolidating for body extraction. */
        if (totalLength < contentLength)
          return;
        consolidate();

        const json = buffer
          .subarray(
            0,
            contentLength,
          )
          .toString('utf8',);
        buffer = buffer.subarray(contentLength,);
        totalLength = buffer.byteLength;
        contentLength = -1;

        try {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; callers validate via discriminant checks
          const message = JSON.parse(json,) as JsonRpcMessage;
          onMessage(message,);
        }
        catch (error) {
          onError(error,);
        }
      }
    },
  };
}

//endregion Parsing
