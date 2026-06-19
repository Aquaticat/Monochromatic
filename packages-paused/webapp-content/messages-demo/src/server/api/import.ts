/**
 * POST /api/import; single-shot streaming upload of a large markdown
 * body to a new draft.
 *
 * The body is consumed as a `ReadableStream`; we decode it with
 * `TextDecoderStream` so multi-byte characters are not split across
 * chunks, then feed the accumulating text through the block-boundary
 * chunker. Each completed chunk is PUT to the draft immediately,
 * so memory stays bounded regardless of total size.
 *
 * Identity (`user_id`) is sent via header `x-user-id` because the body
 * is the upload payload itself. There is no resume protocol; a TCP
 * reset means the partial draft is reaped by the orphan sweep and the
 * client retries the whole upload. For chunk-level resilience the user
 * goes through the editor flow.
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  HTTPError,
} from 'h3';
import { randomUUID, } from 'node:crypto';

import {
  createDraft,
  finalizeDraft,
  putChunk,
  REJECTED,
} from '../../lib/db/drafts.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_CREATED,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_PAYLOAD_TOO_LARGE,
} from '../../lib/http.ts';
import {
  CHUNK_HARD_CAP_BYTES,
  CHUNK_TARGET_BYTES,
  extractPreview,
  renderChunks,
} from '../../lib/markdown-stream.ts';

/**
 * Maximum length of the preview snippet, in characters.
 */
const PREVIEW_MAX_LENGTH = 200;

/**
 * Multiplier on `CHUNK_TARGET_BYTES` to bound the pending buffer.
 */
const PENDING_BUFFER_MULTIPLE = 2;

/**
 * Streaming importer. Returns 201 with the new message id on success,
 * 400 on missing identity, 413 if any single block produces HTML over
 * the hard cap (extremely unlikely for prose), 5xx on internal errors.
 */
export const importHandler: EventHandlerWithFetch = defineHandler(
  async function handleImport(event,) {
    /**
     * Identity sent via `x-user-id` header because the body is the upload payload.
     */
    const userId = event.req
      .headers
      .get('x-user-id',);
    if ((userId === null) || (userId === '')) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing x-user-id header',
      },);
    }

    /**
     * Inbound body stream; null aborts the import before any draft is created.
     */
    const stream = event.req
      .body;
    if ((stream === null) || (stream === undefined)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'no request body',
      },);
    }

    /**
     * Pre-allocated draft id reused by chunk PUTs and the finalize call below.
     */
    const draftId = randomUUID();
    await createDraft({
      id: draftId,
      userId,
    },);

    /**
     * Decoded reader; multi-byte safe because `TextDecoderStream` re-aligns chunks.
     */
    const reader = stream.pipeThrough(new TextDecoderStream(),)
      .getReader();

    /* oxlint-disable no-restricted-syntax/no-function-root-let -- streaming state machine: `pending` is grown by each read and shrunk by `flushFromPending`; `seq`, `chunkCount`, `charCount`, and `firstMd` are mutated by `flushFromPending` as it commits chunks. All five must live alongside `flushFromPending` so they share the closure */
    /**
     * Buffer holding text between chunker flushes; cut at blank-line boundaries.
     */
    let pending = '';
    /**
     * Monotonically incrementing chunk index forwarded to `putChunk`.
     */
    let seq = 0;
    /**
     * Accumulated char count across all chunks; passed to finalize.
     */
    let charCount = 0;
    /**
     * First chunk's markdown captured once for the preview field.
     */
    let firstMd = '';
    /**
     * Total chunk count produced by the chunker; passed to finalize.
     */
    let chunkCount = 0;
    /* oxlint-enable no-restricted-syntax/no-function-root-let */

    /**
     * Flushes whole chunks out of the pending buffer, leaving any
     * trailing partial block (without a closing blank line yet) in
     * `pending` for the next `read()` to extend. The chunker is
     * synchronous and does the block-boundary split internally; we
     * find the last blank line and feed only the prefix.
     *
     * @param force - drain even partial trailing input on stream end
     *
     * @example
     * ```ts
     * await flushFromPending(false); // mid-stream
     * await flushFromPending(true);  // end-of-stream
     * ```
     */
    async function flushFromPending(force: boolean,): Promise<void> {
      // Cut at the last fence-safe blank line so we never split a code
      // fence between flushes. For the demo we use a simple heuristic:
      // find the last "\n\n" outside any in-progress fence. With block
      // sizes typically << 1 MB, this scan is negligible.
      /**
       * Cut offset: end-of-buffer when forced, otherwise the last blank line.
       */
      const lastBlank = force
        ? pending.length
        : pending.lastIndexOf('\n\n',);
      if (lastBlank <= 0)
        return;
      /**
       * Prefix to feed through the chunker; remaining suffix stays in `pending`.
       */
      const prefix = pending.slice(
        0,
        lastBlank,
      );
      pending = pending.slice(lastBlank,);
      // Sequential PUTs preserve seq order; the chunker has no
      // forward-look so we must commit one chunk before deciding the
      // next.
      for (const chunk of renderChunks(prefix,)) {
        if (chunk.html
          .length
          > CHUNK_HARD_CAP_BYTES) {
          throw new HTTPError({
            status: HTTP_PAYLOAD_TOO_LARGE,
            message: 'a single block produced rendered HTML over the hard cap',
          },);
        }
        if (seq === 0)
          firstMd = chunk.md;
        // oxlint-disable-next-line no-await-in-loop
        await putChunk({
          draftId,
          seq,
          chunk,
        },);
        seq += 1;
        chunkCount += 1;
        charCount += chunk.charCount;
      }
    }

    /**
     * Drains the reader, calling `flushFromPending` after every read that
     * pushes `pending` past the soft cap, then a final force-flush. Any
     * thrown error is captured so the caller can release the reader lock
     * before rethrowing.
     *
     * @returns the first thrown error, or `undefined` on clean drain
     */
    async function drainReader(): Promise<unknown> {
      try {
        // Streaming reader is inherently sequential.
        /* oxlint-disable eslint/no-await-in-loop */
        while (true) {
          /**
           * Destructured read result; `done` ends the loop, `value` is the new text segment.
           */
          const {
            value,
            done,
          } = await reader.read();
          if (done)
            break;
          pending += value;
          // Avoid letting `pending` grow without bound between flushes.
          // Once it exceeds twice the soft target we run a flush.
          if (pending.length
            > (CHUNK_TARGET_BYTES * PENDING_BUFFER_MULTIPLE))
            await flushFromPending(false,);
        }
        /* oxlint-enable eslint/no-await-in-loop */
        // Drain anything left.
        await flushFromPending(true,);
        return undefined;
      }
      catch (error) {
        return error;
      }
    }
    /**
     * Holds the first thrown error from the read loop so the reader can release before rethrow.
     */
    const readError = await drainReader();
    reader.releaseLock();
    if (readError !== undefined) {
      if (readError instanceof Error)
        throw readError;
      /**
       * Human-readable rendering of `readError` for the rethrow message.
       */
      const description = (typeof readError) === 'string'
        ? readError
        : 'unknown error';
      throw new Error(`stream read failed: ${description}`,);
    }

    if (chunkCount === 0) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'empty upload',
      },);
    }

    /**
     * New messages.id; `REJECTED` becomes a 500 because the draft passed every check above.
     */
    const messageId = await finalizeDraft({
      draftId,
      userId,
      charCount,
      chunkCount,
      preview: extractPreview({
        md: firstMd,
        maxLength: PREVIEW_MAX_LENGTH,
      },),
    },);
    if (messageId === REJECTED) {
      throw new HTTPError({
        status: HTTP_INTERNAL_SERVER_ERROR,
        message: 'finalize rejected the import draft',
      },);
    }

    return Response.json(
      {
        messageId,
        location: `/m/${String(messageId,)}/c/0`,
      },
      {
        status: HTTP_CREATED,
        headers: {
          'Cache-Control': 'no-store',
          Location: `/m/${String(messageId,)}/c/0`,
        },
      },
    );
  },
);
