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
  /**
   * Closure-shared state for `consolidate` and `feed`.
   *
   * - `chunks`: pending chunks not yet consolidated.
   * - `totalLength`: byte sum across the pending and consolidated buffers.
   * - `buffer`: consolidated content rebuilt from chunks only when parsing needs it.
   * - `contentLength`: -1 when no header parsed yet; reset to -1 after consuming the body.
   *
   * Held inside an object so the closures can mutate the same fields without
   * a function-root `let`.
   */
  const state: {
    chunks: Buffer[];
    totalLength: number;
    buffer: Buffer;
    contentLength: number;
  } = {
    chunks: [],
    totalLength: 0,
    buffer: Buffer.alloc(0,),
    contentLength: -1,
  };

  /**
   * Consolidates pending chunks into a single buffer.
   * Only copies when multiple chunks are pending, avoiding
   * the O(N^2) cost of `Buffer.concat` on every incoming chunk.
   */
  function consolidate(): void {
    if (state.chunks.length === 0)
      return;
    state.buffer = Buffer.concat([
      state.buffer,
      ...state.chunks,
    ],);
    state.chunks.length = 0;
    state.totalLength = state.buffer.byteLength;
  }

  return {
    feed(chunk: Buffer,): void {
      state.chunks.push(chunk,);
      state.totalLength += chunk.byteLength;

      // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- loop exits via return when buffer is incomplete
      while (true) {
        if (state.contentLength === (-1)) {
          consolidate();
          /**
           * -1 means the header is not yet complete in the buffer; wait for more data.
           */
          const headerEnd = state.buffer.indexOf(HEADER_SEPARATOR,);
          if (headerEnd === (-1))
            return;

          /**
           * Header text decoded as ASCII so the Content-Length scan stays cheap.
           */
          const header = state
            .buffer
            .subarray(
              0,
              headerEnd,
            )
            .toString('ascii',);
          /**
           * null means the header lacks Content-Length; skip past it and resume.
           */
          const match = CONTENT_LENGTH_PATTERN.exec(header,);
          if (match === null) {
            state.buffer = state.buffer.subarray(headerEnd + HEADER_SEPARATOR.length,);
            state.totalLength = state.buffer.byteLength;
            continue;
          }

          state.contentLength = Number(match[1],);
          state.buffer = state.buffer.subarray(headerEnd + HEADER_SEPARATOR.length,);
          state.totalLength = state.buffer.byteLength;
        }

        /**
         * Wait for enough data before consolidating for body extraction.
         */
        if (state.totalLength < state.contentLength)
          return;
        consolidate();

        /**
         * Body bytes decoded as UTF-8 for `JSON.parse` below.
         */
        const json = state
          .buffer
          .subarray(
            0,
            state.contentLength,
          )
          .toString('utf8',);
        state.buffer = state.buffer.subarray(state.contentLength,);
        state.totalLength = state.buffer.byteLength;
        state.contentLength = -1;

        try {
          /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown; callers validate via discriminant checks */
          /**
           * Untyped at runtime; downstream handlers gate on discriminants before use.
           */
          const message = JSON.parse(json,) as JsonRpcMessage;
          /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
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
