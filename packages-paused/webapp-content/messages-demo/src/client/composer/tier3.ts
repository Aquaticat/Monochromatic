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
 * `state.tier3.localChunks`); omit `messageId` for new-mode.
 *
 * @param input - form, textarea, state, status element, optional
 *                message id (omitted in new-message tier 3)
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
    messageId?: number;
  },
): void {
  input.form
    .classList
    .add('tier-3',);
  /**
   * Chunk-nav container inserted above the textarea so the prev/next/save buttons stay visible.
   */
  const nav = document.createElement('div',);
  nav.className = 'composer-chunk-nav';
  nav.innerHTML = `
    <button type="button" data-tier3-prev>« prev</button>
    <span data-tier3-position></span>
    <button type="button" data-tier3-next>next »</button>
    <button type="button" data-tier3-save>save chunk</button>
  `;
  input.form
    .insertBefore(
    nav,
    input.textarea,
  );
  updateTier3Nav({
    nav,
    state: input.state,
  },);

  nav.querySelector<HTMLButtonElement>('[data-tier3-prev]',)
    ?.addEventListener(
    'click',
    function onPrev() {
      void navigateTier3({
        delta: -1,
        ...input,
        nav,
      },);
    },
  );
  nav.querySelector<HTMLButtonElement>('[data-tier3-next]',)
    ?.addEventListener(
    'click',
    function onNext() {
      void navigateTier3({
        delta: 1,
        ...input,
        nav,
      },);
    },
  );
  nav.querySelector<HTMLButtonElement>('[data-tier3-save]',)
    ?.addEventListener(
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
  if (input.state
    .tier3
    === undefined)
    return;
  /**
   * Destructured early so the button-state branches read the values directly.
   */
  const {
    currentSeq,
    chunkCount,
  } = input.state
    .tier3;
  /**
   * Position label element; updated on every nav refresh.
   */
  const position = input.nav
    .querySelector<HTMLElement>('[data-tier3-position]',);
  if (position !== null)
    position.textContent = `chunk ${String(currentSeq + 1,)} of ${String(chunkCount,)}`;
  /**
   * Prev button; disabled at chunk 0.
   */
  const prev = input.nav
    .querySelector<HTMLButtonElement>('[data-tier3-prev]',);
  /**
   * Next button; disabled at the last chunk.
   */
  const next = input.nav
    .querySelector<HTMLButtonElement>('[data-tier3-next]',);
  if (prev !== null)
    prev.disabled = currentSeq === 0;
  if (next !== null)
    next.disabled = currentSeq >= (chunkCount - 1);
}

/**
 * Loads chunk `seq` into the textarea. In edit mode (`messageId`
 * present), fetches from the server's `/m/:id/c/:seq/md` endpoint.
 * In new-mode tier 3, reads from `state.tier3.localChunks`.
 *
 * @param input - state, message id (omitted in new mode), chunk index,
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
    messageId?: number;
    seq: number;
    textarea: HTMLTextAreaElement;
  },
): Promise<void> {
  /**
   * New-mode chunk cache; present bypasses the network fetch below.
   */
  const local = input.state
    .tier3
    ?.localChunks;
  if (local !== undefined) {
    writeBody({
      state: input.state,
      textarea: input.textarea,
      text: local[input.seq]
        ?.md
        ?? '',
    },);
    return;
  }
  if (input.messageId
    === undefined)
    throw new Error('cannot load chunk: no message id and no local chunks',);
  /**
   * Per-chunk markdown fetch; throws on `!ok` so the textarea is not stomped with empty text.
   */
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
    messageId?: number;
  },
): Promise<void> {
  if (input.state
    .tier3
    === undefined)
    return;
  await saveCurrentTier3Chunk({
    state: input.state,
    textarea: input.textarea,
    status: input.status,
  },);
  /**
   * Clamped target seq so the buttons remain disabled at boundaries even if state drifts.
   */
  const next = Math.max(
    0,
    Math.min(
      input.state
        .tier3
        .chunkCount
        - 1,
      input.state
        .tier3
        .currentSeq
        + input
        .delta,
    ),
  );
  input.state
    .tier3
    .currentSeq = next;
  await loadChunkIntoEditor({
    state: input.state,
    ...(input.messageId
      !== undefined ? { messageId: input.messageId, } : {}),
    seq: next,
    textarea: input.textarea,
  },);
  updateTier3Nav({
    nav: input.nav,
    state: input.state,
  },);
  setStatus({
    status: input.status,
    message: `editing chunk ${String(next + 1,)} of ${
      String(input.state
        .tier3
        .chunkCount,)
    }`,
  },);
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
  if (input.state
    .tier3
    === undefined)
    return;
  /**
   * Current chunk markdown; read once so the compile, char-count, and PUT use the same snapshot.
   */
  const md = input.textarea
    .value;
  /**
   * Inline compile result; only the rendered HTML is forwarded to the chunk PUT.
   */
  const { html, } = compileInline(md,);
  /**
   * Character count forwarded to both the in-memory cache update and the chunk PUT.
   */
  const charCount = md.length;
  /**
   * Current seq from the tier-3 state; the chunk PUT lands here.
   */
  const seq = input.state
    .tier3
    .currentSeq;
  /**
   * Draft id used in the PUT URL; tier-3 reuses the new draft for every chunk save.
   */
  const draftId = input.state
    .tier3
    .newDraftId;
  // Mirror the edit into localChunks (new-mode tier 3) so prev/next
  // navigation reflects the latest text without a server round-trip.
  if (input.state
    .tier3
    .localChunks
    !== undefined) {
    input.state
      .tier3
      .localChunks[seq] = {
      md,
      html,
      charCount,
    };
  }
  await input.state
    .outbox
    .enqueue({
      draftId,
      seq,
      md,
      html,
      charCount,
    },);
  setStatus({
    status: input.status,
    message: `saved chunk ${String(seq + 1,)}`,
  },);
}
