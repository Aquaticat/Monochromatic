/**
 * Edit-mode send handlers.
 *
 * - `sendInlineEdit` -- single-textarea edit, swap pointers via
 *   `/api/messages/:id/edit`
 * - `sendTier3Edit` -- chunk-paginated edit, inherit unedited chunks
 *   from the original via fetch+PUT and then commit the swap
 */

import { HTTP_NOT_FOUND, } from '../../lib/http.ts';
import { extractPreview, } from '../../lib/markdown-stream.ts';
import { readJson, } from '../json-fetch.ts';
import { compileInline, } from './compile.ts';
import {
  fetchHeadDraftId,
  postCreateDraft,
  randomId,
  setStatus,
} from './helpers.ts';
import type { ComposerState, } from './state.ts';
import { saveCurrentTier3Chunk, } from './tier3.ts';

/** Maximum length of the message preview, in characters. */
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
  if (input.state.editMessageId === null)
    return;
  setStatus(
    input.status,
    'creating new revision draft...',
  );
  const newDraftId = randomId();
  await postCreateDraft({
    id: newDraftId,
    userId: input.userId,
    parentId: await fetchHeadDraftId(input.state.editMessageId,),
  },);
  setStatus(
    input.status,
    'compiling...',
  );
  const compiled = compileInline(input.body,);
  setStatus(
    input.status,
    'uploading...',
  );
  // Sequential PUTs match the server's outbox-ack contract; parallel
  // uploads would race the highest-contiguous-seq the server returns.
  // oxlint-disable-next-line no-await-in-loop
  for (const [seq, chunk,] of compiled.chunks.entries()) {
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
  setStatus(
    input.status,
    'committing edit...',
  );
  const editResp = await fetch(
    `/api/messages/${String(input.state.editMessageId,)}/edit`,
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
    const message = await editResp.text();
    throw new Error(`edit failed: ${message}`,);
  }
  const result = await readJson<{ location?: string; }>(editResp,);
  if (typeof result.location !== 'string')
    return;
  globalThis.location.assign(result.location,);
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
  if (input.state.editMessageId === null || input.state.tier3 === null)
    return;
  const tier3Textarea = document.querySelector<HTMLTextAreaElement>('.composer-body',);
  if (tier3Textarea === null)
    throw new Error('composer body element missing',);
  await saveCurrentTier3Chunk({
    state: input.state,
    textarea: tier3Textarea,
    status: input.status,
  },);

  const totalChunks = input.state.tier3.chunkCount;
  let aggregateCharCount = 0;
  let firstMd = '';
  // Sequential inherit-walk: each step inspects the previous step's PUT
  // outcome before deciding whether to copy the next chunk.
  /* oxlint-disable no-await-in-loop */
  for (let seq = 0; seq < totalChunks; seq += 1) {
    const newChunkResp = await fetch(
      `/api/drafts/${encodeURIComponent(input.state.tier3.newDraftId,)}/chunks/${
        String(seq,)
      }`,
      { method: 'GET', },
    );
    if (newChunkResp.status === HTTP_NOT_FOUND) {
      const origMd = await fetch(
        `/m/${String(input.state.editMessageId,)}/c/${String(seq,)}/md`,
      );
      const origHtml = await fetch(
        `/m/${String(input.state.editMessageId,)}/c/${String(seq,)}/raw`,
      );
      if (!origMd.ok || !origHtml.ok)
        throw new Error(`failed to inherit chunk ${String(seq,)}`,);
      const md = await origMd.text();
      const html = await origHtml.text();
      await fetch(
        `/api/drafts/${encodeURIComponent(input.state.tier3.newDraftId,)}/chunks/${
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
    else {
      const origMd = await fetch(
        `/m/${String(input.state.editMessageId,)}/c/${String(seq,)}/md`,
      );
      if (origMd.ok) {
        const md = await origMd.text();
        aggregateCharCount += md.length;
        if (seq === 0)
          firstMd = md;
      }
    }
  }
  /* oxlint-enable no-await-in-loop */

  setStatus(
    input.status,
    'committing edit...',
  );
  const editResp = await fetch(
    `/api/messages/${String(input.state.editMessageId,)}/edit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify({
        user_id: input.userId,
        new_draft_id: input.state.tier3.newDraftId,
        char_count: aggregateCharCount,
        chunk_count: totalChunks,
        preview: extractPreview(
          firstMd,
          PREVIEW_MAX_LENGTH,
        ),
      },),
    },
  );
  if (!editResp.ok) {
    const message = await editResp.text();
    throw new Error(`edit failed: ${message}`,);
  }
  const result = await readJson<{ location?: string; }>(editResp,);
  if (typeof result.location !== 'string')
    return;
  globalThis.location.assign(result.location,);
}
