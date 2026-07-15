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

/**
 * Header separator between Content-Length header and JSON body.
 */
const HEADER_SEPARATOR = '\r\n\r\n';

/**
 * Lowercase form of the LSP framing header; matched case-insensitively.
 */
const CONTENT_LENGTH_LABEL = 'content-length:';

/**
 * Parses the Content-Length value from an LSP header block.
 * Case-insensitive on the label; tolerates spaces/tabs between the
 * label and the digits, and requires at least one digit to follow.
 *
 * @param header - ASCII-decoded header block (without `\r\n\r\n`)
 *
 * @returns parsed length, or `null` when no Content-Length is present
 *
 * @example
 * ```ts
 * parseContentLength('Content-Length: 42'); // 42
 * parseContentLength('Content-Type: text/plain'); // null
 * ```
 */
export function parseContentLength(header: string,): number | null {
  /**
   * Lower-cased copy so the label scan is case-insensitive.
   */
  const lower = header.toLowerCase();
  /**
   * Position of the label; -1 means the header lacks Content-Length.
   */
  const labelIdx = lower.indexOf(CONTENT_LENGTH_LABEL,);
  if (labelIdx === (-1))
    return null;
  /**
   * Cursor positioned at the first byte after the label.
   */
  const afterLabel = labelIdx + CONTENT_LENGTH_LABEL
    .length;
  /**
   * Digit run scanned in one linear forward pass from `afterLabel`:
   * skip inline whitespace (`' '` / `'\t'` only), then accumulate the
   * contiguous ASCII digit run, stopping at the first non-digit or the
   * header end. IIFE-with-`let` keeps the forward-only cursor in a tight
   * scope (no recursion: O(n) time, O(1) stack on adversarial
   * unbounded-whitespace headers; per-step `push` avoids the recursive
   * accumulator's repeated string rebuild).
   */
  const digits = (function scanDigits(): string {
    /**
     * Forward-only cursor; never rewinds, so the whole scan is one linear pass.
     */
    let idx = afterLabel;
    while (idx < header
      .length) {
      /**
       * Char at cursor; only ASCII space and tab precede the digits.
       */
      const c = header.charAt(idx,);
      if ((c !== ' ') && (c !== '\t'))
        break;
      idx += 1;
    }
    /**
     * Digit characters collected in order; joined once so the run is never rebuilt per step.
     */
    const collected: string[] = [];
    while (idx < header
      .length) {
      /**
       * Char at cursor; a non-digit ends the run.
       */
      const c = header.charAt(idx,);
      if ((c < '0') || (c > '9'))
        break;
      collected.push(c,);
      idx += 1;
    }
    return collected.join('',);
  })();
  if (digits === '')
    return null;
  return Number(digits,);
}

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
  readonly onMessage: (message: JsonRpcMessage,) => void;
  readonly onError: (error: unknown,) => void;
},): { readonly feed: (chunk: Buffer,) => void; } {
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
    if (state.chunks
      .length
      === 0)
      return;
    state.buffer = Buffer.concat([
      state.buffer,
      ...state.chunks,
    ],);
    state.chunks
      .length = 0;
    state.totalLength = state.buffer
      .byteLength;
  }

  return {
    feed(chunk: Buffer,): void {
      state.chunks
        .push(chunk,);
      state.totalLength += chunk.byteLength;

      while (true) {
        if (state.contentLength
          === (-1)) {
          consolidate();
          /**
           * -1 means the header is not yet complete in the buffer; wait for more data.
           */
          const headerEnd = state.buffer
            .indexOf(HEADER_SEPARATOR,);
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
          const len = parseContentLength(header,);
          if (len === null) {
            state.buffer = state.buffer
              .subarray(headerEnd + HEADER_SEPARATOR
                .length,);
            state.totalLength = state.buffer
              .byteLength;
            continue;
          }

          state.contentLength = len;
          state.buffer = state.buffer
            .subarray(headerEnd + HEADER_SEPARATOR
              .length,);
          state.totalLength = state.buffer
            .byteLength;
        }

        /**
         * Wait for enough data before consolidating for body extraction.
         */
        if (state.totalLength
          < state
          .contentLength)
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
        state.buffer = state.buffer
          .subarray(state.contentLength,);
        state.totalLength = state.buffer
          .byteLength;
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
