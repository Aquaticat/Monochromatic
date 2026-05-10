/**
 * Send dispatcher and the new-message send path.
 *
 * `handleSend` is the form-submit entry point; it dispatches to one of
 * three branches depending on the composer's mode (new / inline edit /
 * tier-3 edit) and re-enables the send button after either branch.
 */

import { extractPreview, } from '../../lib/markdown-stream.ts';
import { readJson, } from '../json-fetch.ts';
import {
  compileInline,
  compileViaWorker,
} from './compile.ts';
import {
  sendInlineEdit,
  sendTier3Edit,
} from './edit.ts';
import {
  postCreateDraft,
  randomId,
  setStatus,
} from './helpers.ts';
import type { ComposerState, } from './state.ts';
import { saveCurrentTier3Chunk, } from './tier3.ts';

/** Maximum length of the message preview, in characters. */
const PREVIEW_MAX_LENGTH = 200;

/**
 * Send / edit dispatcher. Picks the right path based on tier and mode
 * and re-enables the send button after either branch.
 *
 * @param input - DOM refs and shared composer state
 *
 * @example
 * ```ts
 * await handleSend({ form, textarea, select, sendBtn, state, status });
 * ```
 */
export async function handleSend(
  input: {
    form: HTMLFormElement;
    textarea: HTMLTextAreaElement;
    select: HTMLSelectElement;
    sendBtn: HTMLButtonElement;
    state: ComposerState;
    status: HTMLElement;
  },
): Promise<void> {
  const body = input.textarea.value;
  const userId = input.select.value;
  if (body.length === 0) {
    setStatus(
      input.status,
      'empty: nothing to send',
    );
    return;
  }
  input.sendBtn.disabled = true;
  try {
    if (input.state.editMessageId !== null && input.state.tier3 === null) {
      await sendInlineEdit({
        ...input,
        body,
        userId,
      },);
    }
    else if (input.state.editMessageId !== null && input.state.tier3 !== null) {
      await sendTier3Edit({
        ...input,
        body,
        userId,
      },);
    }
    else if (input.state.editMessageId === null && input.state.tier3 !== null) {
      await sendTier3New({
        state: input.state,
        textarea: input.textarea,
        status: input.status,
        userId,
      },);
    }
    else {
      await sendNew({
        ...input,
        body,
        userId,
      },);
    }
  }
  catch (error) {
    setStatus(
      input.status,
      `error: ${error instanceof Error ? error.message : String(error,)}`,
    );
  }
  input.sendBtn.disabled = false;
}

/**
 * Sends a brand-new message: create draft, compile, upload, finalize,
 * navigate to the new message page.
 *
 * @param input - body, identity, state, status element
 */
async function sendNew(
  input: {
    body: string;
    userId: string;
    state: ComposerState;
    status: HTMLElement;
  },
): Promise<void> {
  setStatus(
    input.status,
    'creating draft...',
  );
  const draftId = randomId();
  await postCreateDraft({
    id: draftId,
    userId: input.userId,
    parentId: null,
  },);
  setStatus(
    input.status,
    'compiling...',
  );
  const compiled = input.state.tier === 1
    ? compileInline(input.body,)
    : await compileViaWorker({
      body: input.body,
      state: input.state,
    },);

  setStatus(
    input.status,
    input.state.tier === 1 ? 'uploading chunk...' : 'uploading...',
  );
  // Sequential PUTs match the server's outbox-ack contract; parallel
  // uploads would race the highest-contiguous-seq the server returns.
  // oxlint-disable-next-line no-await-in-loop
  for (const [seq, chunk,] of compiled.chunks.entries()) {
    // oxlint-disable-next-line no-await-in-loop
    await fetch(
      `/api/drafts/${encodeURIComponent(draftId,)}/chunks/${String(seq,)}`,
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
    'finalising...',
  );
  const finalize = await fetch(
    `/api/drafts/${encodeURIComponent(draftId,)}/finalize`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify({
        user_id: input.userId,
        char_count: compiled.charCount,
        chunk_count: compiled.chunkCount,
        preview: compiled.preview,
      },),
    },
  );
  const result = await readJson<{
    location?: string;
    messageId?: number;
  }>(finalize,);
  if (typeof result.location !== 'string')
    throw new Error('finalize returned no location',);
  globalThis.location.assign(result.location,);
}

/**
 * Tier-3 new-message send. The chunks were already enqueued in the
 * outbox during tier 2 -\> 3 promotion; we just save the current chunk
 * (covers in-flight edits to it), wait for the outbox to drain, then
 * call finalize and navigate. Aggregates come from `localChunks`.
 *
 * @param input - state, textarea, status element, identity
 *
 * @example
 * ```ts
 * await sendTier3New({ state, textarea, status, userId });
 * ```
 */
async function sendTier3New(
  input: {
    state: ComposerState;
    textarea: HTMLTextAreaElement;
    status: HTMLElement;
    userId: string;
  },
): Promise<void> {
  if (input.state.tier3 === null || input.state.tier3.localChunks === null)
    return;
  await saveCurrentTier3Chunk({
    state: input.state,
    textarea: input.textarea,
    status: input.status,
  },);
  setStatus(
    input.status,
    'flushing chunks...',
  );
  if (input.state.outbox !== null)
    await input.state.outbox.flushed();

  const { localChunks, } = input.state.tier3;
  let charCount = 0;
  for (const chunk of localChunks)
    charCount += chunk.charCount;
  const firstMd = localChunks[0]?.md ?? '';

  setStatus(
    input.status,
    'finalising...',
  );
  const finalize = await fetch(
    `/api/drafts/${encodeURIComponent(input.state.tier3.newDraftId,)}/finalize`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify({
        user_id: input.userId,
        char_count: charCount,
        chunk_count: localChunks.length,
        preview: extractPreview(
          firstMd,
          PREVIEW_MAX_LENGTH,
        ),
      },),
    },
  );
  if (!finalize.ok) {
    const message = await finalize.text();
    throw new Error(`finalize failed: ${message}`,);
  }
  const result = await readJson<{ location?: string; }>(finalize,);
  if (typeof result.location !== 'string')
    throw new Error('finalize returned no location',);
  globalThis.location.assign(result.location,);
}
