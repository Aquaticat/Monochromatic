/**
 * Tier 2 -\> 3 promotion for new-message mode.
 *
 * The composer's `queueTierPromotionCheck` calls into `promoteToTier3`
 * when the buffer crosses 1 MB and we are not already in tier 3 or in
 * edit mode. The function:
 *
 * 1. Reserves the tier-3 slot synchronously so a re-entrant debounce
 *    cannot create a second draft.
 * 2. Asks the composer worker to compile the full buffer into chunks.
 * 3. Creates a new draft on the server (with the cached identity).
 * 4. Holds the chunks in `state.tier3.localChunks` and starts background
 *    PUTs via the outbox.
 * 5. Swaps the surface to chunk-paginated mode by replacing the
 *    textarea contents with chunk 0 and mounting the prev/next nav.
 *
 * Roll-back semantics: if the worker returns zero chunks (the buffer
 * was whitespace-only when the timer fired), the reserved slot is
 * cleared and the composer drops back to tier 2 so the user can keep
 * typing without a stale draft id following them around.
 */

import { compileViaWorker, } from './compile.ts';
import {
  getIdentity,
  postCreateDraft,
  randomId,
  setStatus,
  writeBody,
} from './helpers.ts';
import type { ComposerState, } from './state.ts';
import { setupTier3Nav, } from './tier3.ts';

/**
 * One-way tier 2 -\> 3 transition. See module-level doc for the full
 * sequence and roll-back rules.
 *
 * @param input - state, textarea, form, status element
 *
 * @example
 * ```ts
 * await promoteToTier3({ state, textarea, form, status });
 * ```
 */
export async function promoteToTier3(
  input: {
    state: ComposerState;
    textarea: HTMLTextAreaElement;
    form: HTMLFormElement;
    status: HTMLElement;
  },
): Promise<void> {
  if (input.state.tier3 !== null)
    return;
  // Reserve the tier-3 slot synchronously BEFORE any await so a
  // re-entrant debounce firing during the worker compile or draft
  // create can't spawn a second promotion (which would create an
  // orphan draft on the server).
  /** Allocated up front so the reserved tier-3 slot can capture the id before any await yields control. */
  const newDraftId = randomId();
  /* oxlint-disable eslint/no-magic-numbers -- tier discriminant */
  input.state.tier = 3;
  /* oxlint-enable eslint/no-magic-numbers */
  input.state.tier3 = {
    currentSeq: 0,
    chunkCount: 0,
    newDraftId,
    localChunks: [],
  };
  setStatus(
    input.status,
    'tier 3 promotion: chunking...',
  );
  /** Captured pre-compile so the metrics hook can report the full surface-swap latency. */
  const transitionStart = performance.now();
  /** Holds the worker-produced chunks; consumed twice (length check, then map+writeBody). */
  const compiled = await compileViaWorker({
    body: input.textarea.value,
    state: input.state,
  },);
  input.state.metricsHooks?.recordTransition(
    performance.now() - transitionStart,
  );
  if (compiled.chunks.length === 0) {
    /* oxlint-disable eslint/no-magic-numbers -- tier discriminant */
    input.state.tier = 2;
    /* oxlint-enable eslint/no-magic-numbers */
    input.state.tier3 = null;
    setStatus(
      input.status,
      'tier 3 promotion aborted (no chunks)',
    );
    return;
  }
  /** Resolved once so the create-draft POST and any subsequent outbox PUTs share the same identity. */
  const userId = getIdentity(input.form,);
  await postCreateDraft({
    id: newDraftId,
    userId,
    parentId: null,
  },);
  input.state.tier3.chunkCount = compiled.chunks.length;
  input.state.tier3.localChunks = compiled.chunks.map(function copy(chunk,) {
    return {
      md: chunk.md,
      html: chunk.html,
      charCount: chunk.charCount,
    };
  },);
  // Background upload via the outbox; flush awaited at send time.
  if (input.state.outbox !== null) {
    for (const [seq, chunk,] of compiled.chunks.entries()) {
      void input.state.outbox.enqueue({
        draftId: newDraftId,
        seq,
        md: chunk.md,
        html: chunk.html,
        charCount: chunk.charCount,
      },);
    }
  }
  // Swap the surface: textarea (and editor mirror) now hold chunk 0;
  // nav appears.
  writeBody({
    state: input.state,
    textarea: input.textarea,
    text: compiled.chunks[0]?.md ?? '',
  },);
  setupTier3Nav({
    form: input.form,
    textarea: input.textarea,
    state: input.state,
    status: input.status,
    messageId: null,
  },);
  setStatus(
    input.status,
    `tier 3: editing chunk 1 of ${String(compiled.chunks.length,)}`,
  );
}
