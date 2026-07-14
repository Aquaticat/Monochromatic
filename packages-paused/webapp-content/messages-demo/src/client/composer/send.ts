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

/**
 * Maximum length of the message preview, in characters.
 */
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
  /**
   * Snapshot of the body at send time; the textarea may mutate during the await chain.
   */
  const body = input.textarea
    .value;
  /**
   * Active identity at send time; the select may change while uploads are in flight.
   */
  const userId = input.select
    .value;
  if (body.length
    === 0) {
    setStatus({
      status: input.status,
      message: 'empty: nothing to send',
    },);
    return;
  }
  input.sendBtn
    .disabled = true;
  try {
    if ((input.state
      .editMessageId
      !== undefined) && (input.state
        .tier3
        === undefined)) {
      await sendInlineEdit({
        ...input,
        body,
        userId,
      },);
    }
    else if ((input.state
      .editMessageId
      !== undefined) && (input.state
        .tier3
        !== undefined)) {
      await sendTier3Edit({
        ...input,
        body,
        userId,
      },);
    }
    else if ((input.state
      .editMessageId
      === undefined) && (input.state
        .tier3
        !== undefined)) {
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
    setStatus({
      status: input.status,
      message: `error: ${error instanceof Error ? error.message : String(error,)}`,
    },);
  }
  input.sendBtn
    .disabled = false;
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
  setStatus({
    status: input.status,
    message: 'creating draft...',
  },);
  /**
   * Allocated once so the create-draft POST, chunk PUTs, and finalize all share the same id.
   */
  const draftId = randomId();
  await postCreateDraft({
    id: draftId,
    userId: input.userId,
  },);
  setStatus({
    status: input.status,
    message: 'compiling...',
  },);
  /**
   * Tier-1 inline compile or tier-2/3 worker compile result; both expose `chunks`, `charCount`, etc.
   */
  const compiled = input.state
    .tier
    === 1
    ? compileInline(input.body,)
    : await compileViaWorker({
      body: input.body,
      state: input.state,
    },);

  setStatus({
    status: input.status,
    message: input.state
      .tier
      === 1 ? 'uploading chunk...' : 'uploading...',
  },);
  // Sequential PUTs match the server's outbox-ack contract; parallel
  // uploads would race the highest-contiguous-seq the server returns.
  for (const [seq, chunk,] of compiled.chunks
    .entries()) {
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

  setStatus({
    status: input.status,
    message: 'finalising...',
  },);
  /**
   * Awaited so the JSON body read below can read the same response object.
   */
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
  /**
   * Finalize envelope: `location` redirects to the new message page.
   */
  const result = await readJson<{
    location?: string;
    messageId?: number;
  }>(finalize,);
  if ((typeof result.location) !== 'string')
    throw new Error('finalize returned no location',);
  globalThis.location
    .assign(result.location,);
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
  if ((input.state
    .tier3
    === undefined) || (input.state
      .tier3
      .localChunks
      === undefined))
    return;
  await saveCurrentTier3Chunk({
    state: input.state,
    textarea: input.textarea,
    status: input.status,
  },);
  setStatus({
    status: input.status,
    message: 'flushing chunks...',
  },);
  await input.state
    .outbox
    .flushed();

  /**
   * Destructured so the aggregate-walk reads the cached chunks directly.
   */
  const { localChunks, } = input.state
    .tier3;
  /**
   * Aggregate character count across every cached chunk; passed to finalize.
   */
  const charCount = localChunks.reduce(
    function sumCharCount(
      acc,
      chunk,
    ) {
      return acc + chunk
        .charCount;
    },
    0,
  );
  /**
   * First chunk's markdown captured for the finalize preview field.
   */
  const firstMd = localChunks[0]
    ?.md
    ?? '';

  setStatus({
    status: input.status,
    message: 'finalising...',
  },);
  /**
   * Tier-3 finalize fetch; awaited so both the status check and the JSON read use the same response.
   */
  const finalize = await fetch(
    `/api/drafts/${encodeURIComponent(input.state
      .tier3
      .newDraftId,)}/finalize`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify({
        user_id: input.userId,
        char_count: charCount,
        chunk_count: localChunks.length,
        preview: extractPreview({
          md: firstMd,
          maxLength: PREVIEW_MAX_LENGTH,
        },),
      },),
    },
  );
  if (!finalize.ok) {
    /**
     * Server-supplied error body folded into the thrown message.
     */
    const message = await finalize.text();
    throw new Error(`finalize failed: ${message}`,);
  }
  /**
   * Finalize envelope: `location` redirects to the new message page.
   */
  const result = await readJson<{ location?: string; }>(finalize,);
  if ((typeof result.location) !== 'string')
    throw new Error('finalize returned no location',);
  globalThis.location
    .assign(result.location,);
}
