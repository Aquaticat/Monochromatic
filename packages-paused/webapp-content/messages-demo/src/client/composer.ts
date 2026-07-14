/**
 * Composer state machine.
 *
 * Replaces the server-rendered `<form>` with a JS-driven workflow:
 *
 * - **send**: create draft -> compile + PUT chunks -> finalize -> redirect
 * - **edit**: load existing chunks, present them, accept changes, finalise
 *   the new draft via `/api/messages/:id/edit`
 *
 * Tier system (see plan section 2):
 *
 * - tier 1 (< 8 KB single block): main thread compiles, three sequential
 *   network calls on send
 * - tier 2 (8 KB to 1 MB): worker compiles, batch upload on send
 * - tier 3 (> 1 MB): chunk-paginated; the editor surface only ever
 *   holds one chunk's source markdown
 *
 * Promotion across tiers is one-way and triggered by the running body
 * size after a 500 ms idle.
 */

import { createChunkCache, } from './chunk-cache.ts';
import {
  appendStatusElement,
  appendVolatileBadge,
  fetchChunkCount,
  fetchHeadDraftId,
  getIdentity,
  NEW_MESSAGE,
  NO_PARENT,
  parseEditId,
  postCreateDraft,
  randomId,
  setStatus,
  writeBody,
} from './composer/helpers.ts';
import { attachMetricsOverlay, } from './composer/metrics-overlay.ts';
import { mountCustomEditor, } from './composer/mount-custom-editor.ts';
import { promoteToTier3, } from './composer/promote.ts';
import { handleSend, } from './composer/send.ts';
import type { ComposerState, } from './composer/state.ts';
import {
  loadChunkIntoEditor,
  setupTier3Nav,
} from './composer/tier3.ts';
import {
  loadIdentity,
  NO_IDENTITY,
  saveIdentity,
} from './identity-store.ts';
import { createOutbox, } from './outbox.ts';
import {
  probeStorage,
  type StorageCaps,
} from './storage-probe.ts';

import { decideTierTransition, } from './composer-tier.ts';

export {
  decideTierTransition,
  TIER_2_THRESHOLD,
  TIER_3_THRESHOLD,
  type TierTransition,
} from './composer-tier.ts';

/**
 * Idle delay before tier promotion fires, in milliseconds.
 */
const TIER_DEBOUNCE_MS = 500;

/**
 * Decimal radix for `parseInt`.
 */
const DECIMAL_RADIX = 10;


/**
 * Bootstraps the composer. Idempotent: if called multiple times on the
 * same form element it returns the same instance.
 *
 * @param form - server-rendered composer form
 *
 * @param caps - storage capability flags from `probeStorage`
 *
 * @example
 * ```ts
 * await attachComposer({ form, caps: await probeStorage() });
 * ```
 */
export async function attachComposer({
  form,
  caps,
}: {
  form: HTMLFormElement;
  caps: StorageCaps;
},): Promise<void> {
  if (form.dataset
    .composerAttached
    === '1')
    return;
  form.dataset
    .composerAttached = '1';

  /**
   * Identity select; null aborts the attach so a half-mounted form is not left behind.
   */
  const select = form.querySelector<HTMLSelectElement>('.composer-identity',);
  /**
   * Composer body textarea; null aborts the attach.
   */
  const textarea = form.querySelector<HTMLTextAreaElement>('.composer-body',);
  /**
   * Send button; null aborts the attach.
   */
  const sendBtn = form.querySelector<HTMLButtonElement>('.composer-send',);
  if ((select === null) || (textarea === null)
    || (sendBtn === null))
    return;

  /**
   * Identity previously persisted; restored if it still matches one of the select's options.
   */
  const persisted = loadIdentity(caps.localStorage,);
  if ((persisted !== NO_IDENTITY) && [...select.options,]
    .some(function isPersisted(option,) {
    return option.value
      === persisted;
  },)) {
    select.value = persisted;
  }

  select.addEventListener(
    'change',
    function onIdentityChange() {
      saveIdentity({
        identity: select.value,
        available: caps.localStorage,
      },);
    },
  );

  /**
   * Outbox and chunk cache built concurrently; both depend only on `caps`.
   */
  const [outbox, cache,] = await Promise.all([
    createOutbox({ idbAvailable: caps.idb, },),
    createChunkCache({
      caps: {
        opfs: caps.opfs,
        idb: caps.idb,
      },
    },),
  ],);

  /**
   * Parsed edit-mode id; `NEW_MESSAGE` means the composer is in new-message mode and `editMessageId` stays absent.
   */
  const editId = parseEditId(form.dataset
    .editMessageId,);
  /**
   * Long-lived composer state; passed to every helper so they share editor, outbox, and tier discriminant.
   */
  const state: ComposerState = {
    /* oxlint-disable eslint/no-magic-numbers, typescript/no-unsafe-type-assertion -- tier discriminant cast */
    tier: Number.parseInt(
      form.dataset
        .initialTier
        ?? '1',
      DECIMAL_RADIX,
    ) as 1 | 2 | 3,
    /* oxlint-enable eslint/no-magic-numbers, typescript/no-unsafe-type-assertion */
    caps,
    outbox,
    cache,
    ...(editId !== NEW_MESSAGE ? { editMessageId: editId, } : {}),
  };

  // Mount the metrics overlay before any worker spawns so we don't
  // miss the first compile pass. Only when `?debug=1`.
  /**
   * URL-flag override that surfaces the per-pipeline metrics overlay.
   */
  const debug = new URLSearchParams(globalThis.location
    .search,).get('debug',)
    === '1';
  if (debug) {
    /**
     * Overlay handle whose `recordTransition` is captured on state for later metrics.
     */
    const overlay = attachMetricsOverlay({
      parent: form,
      state,
    },);
    state.metricsHooks = overlay;
  }

  if ((!caps.localStorage) || (!caps.idb))
    appendVolatileBadge(form,);

  /**
   * Idempotent status element appended below the form; passed to every send and edit helper.
   */
  const status = appendStatusElement(form,);

  // Custom editor opt-in via `?editor=custom`. The textarea stays in
  // the DOM (visually hidden) so every existing read of
  // `textarea.value` still works; the editor mirrors its text into
  // the textarea on every change.
  /**
   * Opt-in for the worker-backed editor; the textarea remains in the DOM as the mirrored source-of-truth.
   */
  const wantCustom = new URLSearchParams(globalThis.location
    .search,).get('editor',)
    === 'custom';
  if (wantCustom) {
    await mountCustomEditor({
      form,
      textarea,
      state,
    },);
  }

  if (state.editMessageId
    !== undefined) {
    await loadExistingChunksForEdit({
      form,
      textarea,
      state,
      status,
    },);
  }

  textarea.addEventListener(
    'input',
    function onInput() {
      queueTierPromotionCheck({
        state,
        textarea,
        form,
        status,
      },);
    },
  );

  textarea.addEventListener(
    'keydown',
    function onKeydown(event,) {
      if ((event.metaKey
        || event
        .ctrlKey) && (event.key
          === 'Enter')) {
        event.preventDefault();
        sendBtn.click();
      }
    },
  );

  form.addEventListener(
    'submit',
    function onSubmit(event,) {
      event.preventDefault();
      void handleSend({
        form,
        textarea,
        select,
        sendBtn,
        state,
        status,
      },);
    },
  );
}

/**
 * Loads the markdown for an existing message into the editor when the
 * composer is mounted in edit mode. For tier-3 messages we set up the
 * chunk-paginated UI instead of concatenating all chunks.
 *
 * @param input - form, textarea, state, status element
 */
async function loadExistingChunksForEdit(
  input: {
    form: HTMLFormElement;
    textarea: HTMLTextAreaElement;
    state: ComposerState;
    status: HTMLElement;
  },
): Promise<void> {
  if (input.state
    .editMessageId
    === undefined)
    return;
  /**
   * Captured under a present name so the branch logic does not re-narrow per access.
   */
  const messageId = input.state
    .editMessageId;
  if (input.state
    .tier
    // oxlint-disable-next-line eslint/no-magic-numbers -- tier-3 discriminant
    === 3) {
    /**
     * Total chunk count from the server; needed to render the nav and size the tier-3 state.
     */
    const chunkCount = await fetchChunkCount(messageId,);
    /**
     * Allocated up front so the create-draft POST and the tier-3 state both pick up the same id.
     */
    const newDraftId = randomId();
    /**
     * Head draft for the copy-on-write parent; `NO_PARENT` omits the parent link for the demo.
     */
    const headDraft = await fetchHeadDraftId(messageId,);
    await postCreateDraft({
      id: newDraftId,
      userId: getIdentity(input.form,),
      ...(headDraft !== NO_PARENT ? { parentId: headDraft, } : {}),
    },);
    input.state
      .tier3 = {
      currentSeq: 0,
      chunkCount,
      newDraftId,
    };
    setupTier3Nav({
      ...input,
      messageId,
    },);
    await loadChunkIntoEditor({
      state: input.state,
      messageId,
      seq: 0,
      textarea: input.textarea,
    },);
    setStatus({
      status: input.status,
      message: `editing chunk 1 of ${String(chunkCount,)}`,
    },);
    return;
  }
  /**
   * Total chunk count from the server; used as the upper bound for the fetch loop.
   */
  const chunkCount = await fetchChunkCount(messageId,);
  // Sequential fetches keep ordering deterministic for streaming
  // assembly; the textarea concatenates parts in seq order.
  /* oxlint-disable no-await-in-loop */
  /**
   * Accumulator of fetched chunk markdown; joined in seq order before writing the body.
   */
  const parts: string[] = [];
  for (let seq = 0; seq < chunkCount; seq += 1) {
    /**
     * Per-chunk fetch response; throws on `!ok` so a partial body is never written.
     */
    const response = await fetch(`/m/${String(messageId,)}/c/${String(seq,)}/md`,);
    if (!response.ok)
      throw new Error(`failed to load chunk ${String(seq,)}`,);
    parts.push(await response.text(),);
  }
  /* oxlint-enable no-await-in-loop */
  writeBody({
    state: input.state,
    textarea: input.textarea,
    text: parts.join('',),
  },);
  setStatus({
    status: input.status,
    message: 'editing message',
  },);
}

/**
 * Sentinel for "no promotion check queued". A unique `Symbol` rather
 * than `null`: a live timer handle is the only other value, so the
 * scheduler gates `clearTimeout` with `!== NO_TIMER`.
 */
const NO_TIMER: unique symbol = Symbol('messages-demo:no-promotion-timer',);

/* oxlint-disable no-restricted-syntax/no-module-root-let -- singleton timer handle: cleared inside `clearTimeout` and reassigned by every `queueTierPromotionCheck` call; wrapping in a Map adds noise without a key to hang state off */
/**
 * Pending promotion-check timer; `NO_TIMER` when no check is queued.
 */
let promotionTimer: ReturnType<typeof setTimeout> | typeof NO_TIMER = NO_TIMER;
/* oxlint-enable no-restricted-syntax/no-module-root-let */

/**
 * Schedules a tier promotion check after a short idle. Promotes between
 * tiers based on the body length after a 500 ms idle. One-way: tier-3
 * stays tier-3.
 *
 * @param input - state, textarea, form, status element
 */
function queueTierPromotionCheck(
  input: {
    state: ComposerState;
    textarea: HTMLTextAreaElement;
    form: HTMLFormElement;
    status: HTMLElement;
  },
): void {
  if (promotionTimer !== NO_TIMER)
    clearTimeout(promotionTimer,);
  promotionTimer = setTimeout(
    function onIdle() {
      promotionTimer = NO_TIMER;
      /**
       * Tier-transition decision computed on the post-idle snapshot of buffer length and state.
       */
      const transition = decideTierTransition({
        tier: input.state
          .tier,
        length: input.textarea
          .value
          .length,
        tier3Active: input.state
          .tier3
          !== undefined,
        inEditMode: input.state
          .editMessageId
          !== undefined,
      },);
      if (transition.kind
        === 'to-tier-2') {
        input.state
          .tier = 2;
        setStatus({
          status: input.status,
          message: 'tier 2 (worker)',
        },);
        // Fall through: a single tick can't double-jump to tier 3 because
        // the decision was made on the pre-transition `tier` value.
      }
      if (transition.kind
        === 'to-tier-3')
        void promoteToTier3(input,);
    },
    TIER_DEBOUNCE_MS,
  );
}

/**
 * Re-export the entry function so the lazy import is type-safe.
 */
export const init: typeof attachComposer = attachComposer;

/**
 * Boots the composer on the first user interaction. Run from `index.ts`.
 *
 * @example
 * ```ts
 * await bootstrap();
 * ```
 */
export async function bootstrap(): Promise<void> {
  /**
   * Composer form element; null aborts the bootstrap on pages without a composer.
   */
  const form = document.querySelector<HTMLFormElement>('#composer',);
  if (form === null)
    return;
  /**
   * Storage capability probe results; forwarded to outbox, cache, and identity-store helpers.
   */
  const caps = await probeStorage();
  await attachComposer({
    form,
    caps,
  },);
}
