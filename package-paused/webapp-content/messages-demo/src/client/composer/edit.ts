/**
 * Edit-mode send handlers.
 *
 * - `sendInlineEdit`: single-textarea edit, swap pointers via
 *   `/api/messages/:id/edit`
 * - `sendTier3Edit`: chunk-paginated edit, inherit unedited chunks
 *   from the original via fetch+PUT and then commit the swap
 */

import { HTTP_NOT_FOUND, } from '../../lib/http.ts';
import { extractPreview, } from '../../lib/markdown-stream.ts';
import { readJson, } from '../json-fetch.ts';
import { compileInline, } from './compile.ts';
import {
  fetchHeadDraftId,
  NO_PARENT,
  postCreateDraft,
  randomId,
  setStatus,
} from './helpers.ts';
import type { ComposerState, } from './state.ts';
import { saveCurrentTier3Chunk, } from './tier3.ts';

/**
 * Maximum length of the message preview, in characters.
 */
const PREVIEW_MAX_LENGTH = 200;


/**
 * Inline-edit send: build a child draft from the new body and POST the
 * edit endpoint to atomically swap pointers.
 *
 * @param input - body, identity, state, status element
 *
 * @example
 * ```ts
 * await sendInlineEdit({ body, userId, state, status });
 * ```
 */
export async function sendInlineEdit(
  input: {
    body: string;
    userId: string;
    state: ComposerState;
    status: HTMLElement;
  },
): Promise<void> {
  if (input.state
    .editMessageId
    === undefined)
    return;
  setStatus({
    status: input.status,
    message: 'creating new revision draft...',
  },);
  /**
   * Allocated up front so the create-draft POST and chunk PUTs all share the same id.
   */
  const newDraftId = randomId();
  /**
   * Head draft for the copy-on-write parent; `NO_PARENT` omits the parent link for the demo.
   */
  const headDraft = await fetchHeadDraftId(input.state
    .editMessageId,);
  await postCreateDraft({
    id: newDraftId,
    userId: input.userId,
    ...(headDraft !== NO_PARENT ? { parentId: headDraft, } : {}),
  },);
  setStatus({
    status: input.status,
    message: 'compiling...',
  },);
  /**
   * Inline compile result; consumed by the PUT loop and the commit POST.
   */
  const compiled = compileInline(input.body,);
  setStatus({
    status: input.status,
    message: 'uploading...',
  },);
  // Sequential PUTs match the server's outbox-ack contract; parallel
  // uploads would race the highest-contiguous-seq the server returns.
  for (const [seq, chunk,] of compiled.chunks
    .entries()) {
    // oxlint-disable-next-line no-await-in-loop
    await fetch(
      `/api/drafts/${encodeURIComponent(newDraftId,)}/chunks/${String(seq,)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          md: chunk.md,
          html: chunk.html,
          char_count: chunk.charCount,
        },),
      },
    );
  }
  setStatus({
    status: input.status,
    message: 'committing edit...',
  },);
  /**
   * Awaited so both the `!ok` branch and the JSON read below can reuse the same response.
   */
  const editResp = await fetch(
    `/api/messages/${String(input.state
      .editMessageId,)}/edit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify({
        user_id: input.userId,
        new_draft_id: newDraftId,
        char_count: compiled.charCount,
        chunk_count: compiled.chunkCount,
        preview: compiled.preview,
      },),
    },
  );
  if (!editResp.ok) {
    /**
     * Server-supplied error body folded into the thrown message.
     */
    const message = await editResp.text();
    throw new Error(`edit failed: ${message}`,);
  }
  /**
   * Holds the `{ location? }` envelope so the redirect can fire only when location is a string.
   */
  const result = await readJson<{ location?: string; }>(editResp,);
  if ((typeof result.location) !== 'string')
    return;
  globalThis.location
    .assign(result.location,);
}

/**
 * Tier-3 edit send: chunks are already PUT into the new draft as the
 * user navigates; this just inherits unvisited chunks from the original
 * draft chain and commits the pointer swap.
 *
 * @param input - body, identity, state, status element
 *
 * @example
 * ```ts
 * await sendTier3Edit({ body, userId, state, status });
 * ```
 */
export async function sendTier3Edit(
  input: {
    body: string;
    userId: string;
    state: ComposerState;
    status: HTMLElement;
  },
): Promise<void> {
  if ((input.state
    .editMessageId
    === undefined) || (input.state
      .tier3
      === undefined))
    return;
  /**
   * Resolved once so the current-chunk save can run before the inherit-walk loop starts.
   */
  const tier3Textarea = document.querySelector<HTMLTextAreaElement>('.composer-body',);
  if (tier3Textarea === null)
    throw new Error('composer body element missing',);
  await saveCurrentTier3Chunk({
    state: input.state,
    textarea: tier3Textarea,
    status: input.status,
  },);

  /**
   * Captured before the loop so the per-iteration cost stays cheap.
   */
  const totalChunks = input.state
    .tier3
    .chunkCount;
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- inherit-walk accumulators: `aggregateCharCount` sums char counts across both branches (inherit vs reuse) of the per-seq decision and `firstMd` is captured exactly once when `seq === 0` is reached on either branch */
  /**
   * Accumulator for char counts across inherited and new chunks; needed by the commit POST.
   */
  let aggregateCharCount = 0;
  /**
   * Chunk-0 markdown captured for the preview field on the commit POST.
   */
  let firstMd = '';
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  // Sequential inherit-walk: each step inspects the previous step's PUT
  // outcome before deciding whether to copy the next chunk.
  /* oxlint-disable eslint/no-await-in-loop */
  for (let seq = 0; seq < totalChunks; seq += 1) {
    /**
     * Probe to decide whether the new draft already has this chunk or must inherit it.
     */
    const newChunkResp = await fetch(
      `/api/drafts/${encodeURIComponent(input.state
        .tier3
        .newDraftId,)}/chunks/${
        String(seq,)
      }`,
      { method: 'GET', },
    );
    /**
     * Original markdown fetched from the message-chunk endpoint; shared by the inherit-PUT branch and the already-uploaded char-count rollup.
     */
    const origMd = await fetch(
      `/m/${String(input.state
        .editMessageId,)}/c/${String(seq,)}/md`,
    );
    if (newChunkResp.status
      === HTTP_NOT_FOUND) {
      /**
       * Original rendered HTML fetched for the inherit-PUT body.
       */
      const origHtml = await fetch(
        `/m/${String(input.state
          .editMessageId,)}/c/${String(seq,)}/raw`,
      );
      if ((!origMd.ok) || (!origHtml.ok))
        throw new Error(`failed to inherit chunk ${String(seq,)}`,);
      /**
       * Resolved body of `origMd` so the PUT body and char-count update can reuse it.
       */
      const md = await origMd.text();
      /**
       * Resolved body of `origHtml`, sent as the rendered side of the inherited chunk.
       */
      const html = await origHtml.text();
      await fetch(
        `/api/drafts/${encodeURIComponent(input.state
          .tier3
          .newDraftId,)}/chunks/${
          String(seq,)
        }`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', },
          body: JSON.stringify({
            md,
            html,
            char_count: md.length,
          },),
        },
      );
      aggregateCharCount += md.length;
      if (seq === 0)
        firstMd = md;
    }
    else if (origMd.ok) {
      /**
       * Body of the original markdown re-read for char-count aggregation.
       */
      const md = await origMd.text();
      aggregateCharCount += md.length;
      if (seq === 0)
        firstMd = md;
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */

  setStatus({
    status: input.status,
    message: 'committing edit...',
  },);
  /**
   * Tier-3 edit commit; the same response is read for status + body.
   */
  const editResp = await fetch(
    `/api/messages/${String(input.state
      .editMessageId,)}/edit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify({
        user_id: input.userId,
        new_draft_id: input.state
          .tier3
          .newDraftId,
        char_count: aggregateCharCount,
        chunk_count: totalChunks,
        preview: extractPreview({
          md: firstMd,
          maxLength: PREVIEW_MAX_LENGTH,
        },),
      },),
    },
  );
  if (!editResp.ok) {
    /**
     * Server-supplied error body folded into the thrown message.
     */
    const message = await editResp.text();
    throw new Error(`edit failed: ${message}`,);
  }
  /**
   * `{ location? }` envelope; redirect fires only when `location` is a string.
   */
  const result = await readJson<{ location?: string; }>(editResp,);
  if ((typeof result.location) !== 'string')
    return;
  globalThis.location
    .assign(result.location,);
}
