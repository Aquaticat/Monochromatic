/**
 * Tier-3 chunk-paginated UI.
 *
 * Mounted when the composer opens an existing message large enough to
 * be edited one chunk at a time. Each prev/next click silently saves
 * the current chunk before loading the new one so pending edits never
 * blank-out under navigation.
 */

import { compileInline, } from './compile.ts';
import {
  setStatus,
  writeBody,
} from './helpers.ts';
import type { ComposerState, } from './state.ts';

/**
 * Sets up tier-3 prev/next/save buttons inside the composer form. Used
 * for both edit-mode (chunks live on the server, addressable by
 * `messageId`) and new-mode (chunks live in
 * `state.tier3.localChunks`); pass `messageId === null` for new-mode.
 *
 * @param input - form, textarea, state, status element, optional
 *                message id (null in new-message tier 3)
 *
 * @example
 * ```ts
 * setupTier3Nav({ form, textarea, state, status, messageId });
 * ```
 */
export function setupTier3Nav(
  input: {
    form: HTMLFormElement;
    textarea: HTMLTextAreaElement;
    state: ComposerState;
    status: HTMLElement;
    messageId: number | null;
  },
): void {
  input.form.classList.add('tier-3',);
  const nav = document.createElement('div',);
  nav.className = 'composer-chunk-nav';
  nav.innerHTML = `
    <button type="button" data-tier3-prev>« prev</button>
    <span data-tier3-position></span>
    <button type="button" data-tier3-next>next »</button>
    <button type="button" data-tier3-save>save chunk</button>
  `;
  input.form.insertBefore(
    nav,
    input.textarea,
  );
  updateTier3Nav({
    nav,
    state: input.state,
  },);

  nav.querySelector<HTMLButtonElement>('[data-tier3-prev]',)?.addEventListener(
    'click',
    function onPrev() {
      void navigateTier3({
        delta: -1,
        ...input,
        nav,
      },);
    },
  );
  nav.querySelector<HTMLButtonElement>('[data-tier3-next]',)?.addEventListener(
    'click',
    function onNext() {
      void navigateTier3({
        delta: 1,
        ...input,
        nav,
      },);
    },
  );
  nav.querySelector<HTMLButtonElement>('[data-tier3-save]',)?.addEventListener(
    'click',
    function onSave() {
      void saveCurrentTier3Chunk({
        state: input.state,
        textarea: input.textarea,
        status: input.status,
      },);
    },
  );
}

/**
 * Updates the tier-3 nav's position label and disabled-button states.
 *
 * @param input - nav element and current state
 *
 * @example
 * ```ts
 * updateTier3Nav({ nav, state });
 * ```
 */
export function updateTier3Nav(
  input: {
    nav: HTMLElement;
    state: ComposerState;
  },
): void {
  if (input.state.tier3 === null)
    return;
  const {
    currentSeq,
    chunkCount,
  } = input.state.tier3;
  const position = input.nav.querySelector<HTMLElement>('[data-tier3-position]',);
  if (position !== null)
    position.textContent = `chunk ${String(currentSeq + 1,)} of ${String(chunkCount,)}`;
  const prev = input.nav.querySelector<HTMLButtonElement>('[data-tier3-prev]',);
  const next = input.nav.querySelector<HTMLButtonElement>('[data-tier3-next]',);
  if (prev !== null)
    prev.disabled = currentSeq === 0;
  if (next !== null)
    next.disabled = currentSeq >= chunkCount - 1;
}

/**
 * Loads chunk `seq` into the textarea. In edit mode (`messageId`
 * non-null), fetches from the server's `/m/:id/c/:seq/md` endpoint.
 * In new-mode tier 3, reads from `state.tier3.localChunks`.
 *
 * @param input - state, message id (null in new mode), chunk index,
 *                target textarea
 *
 * @example
 * ```ts
 * await loadChunkIntoEditor({ state, messageId, seq: 3, textarea });
 * ```
 */
export async function loadChunkIntoEditor(
  input: {
    state: ComposerState;
    messageId: number | null;
    seq: number;
    textarea: HTMLTextAreaElement;
  },
): Promise<void> {
  const local = input.state.tier3?.localChunks;
  if (local !== null && local !== undefined) {
    writeBody({
      state: input.state,
      textarea: input.textarea,
      text: local[input.seq]?.md ?? '',
    },);
    return;
  }
  if (input.messageId === null)
    throw new Error('cannot load chunk: no message id and no local chunks',);
  const response = await fetch(
    `/m/${String(input.messageId,)}/c/${String(input.seq,)}/md`,
  );
  if (!response.ok)
    throw new Error(`failed to load chunk ${String(input.seq,)}`,);
  writeBody({
    state: input.state,
    textarea: input.textarea,
    text: await response.text(),
  },);
}

/**
 * Tier-3 prev/next handler. Saves the current chunk silently before
 * moving on, so the user does not lose pending edits.
 *
 * @param input - delta (-1 or 1), state, textarea, status element,
 *                nav element, form, current message id
 *
 * @example
 * ```ts
 * await navigateTier3({ delta: 1, state, textarea, status, nav, form, messageId });
 * ```
 */
export async function navigateTier3(
  input: {
    delta: -1 | 1;
    state: ComposerState;
    textarea: HTMLTextAreaElement;
    status: HTMLElement;
    nav: HTMLElement;
    form: HTMLFormElement;
    messageId: number | null;
  },
): Promise<void> {
  if (input.state.tier3 === null)
    return;
  await saveCurrentTier3Chunk({
    state: input.state,
    textarea: input.textarea,
    status: input.status,
  },);
  const next = Math.max(
    0,
    Math.min(
      input.state.tier3.chunkCount - 1,
      input.state.tier3.currentSeq + input.delta,
    ),
  );
  input.state.tier3.currentSeq = next;
  await loadChunkIntoEditor({
    state: input.state,
    messageId: input.messageId,
    seq: next,
    textarea: input.textarea,
  },);
  updateTier3Nav({
    nav: input.nav,
    state: input.state,
  },);
  setStatus(
    input.status,
    `editing chunk ${String(next + 1,)} of ${String(input.state.tier3.chunkCount,)}`,
  );
}

/**
 * PUTs the current textarea contents as the chunk for the current seq.
 * Compiled inline (one chunk = small enough for main thread).
 *
 * @param input - state, textarea holding the chunk md, status element
 *
 * @example
 * ```ts
 * await saveCurrentTier3Chunk({ state, textarea, status });
 * ```
 */
export async function saveCurrentTier3Chunk(
  input: {
    state: ComposerState;
    textarea: HTMLTextAreaElement;
    status: HTMLElement;
  },
): Promise<void> {
  if (input.state.tier3 === null)
    return;
  const md = input.textarea.value;
  const { html, } = compileInline(md,);
  const charCount = md.length;
  const seq = input.state.tier3.currentSeq;
  const draftId = input.state.tier3.newDraftId;
  // Mirror the edit into localChunks (new-mode tier 3) so prev/next
  // navigation reflects the latest text without a server round-trip.
  if (input.state.tier3.localChunks !== null) {
    input.state.tier3.localChunks[seq] = {
      md,
      html,
      charCount,
    };
  }
  await (input.state.outbox !== null
    ? input.state.outbox.enqueue({
      draftId,
      seq,
      md,
      html,
      charCount,
    },)
    : fetch(
      `/api/drafts/${encodeURIComponent(draftId,)}/chunks/${String(seq,)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({
          md,
          html,
          char_count: charCount,
        },),
      },
    ));
  setStatus(
    input.status,
    `saved chunk ${String(seq + 1,)}`,
  );
}
