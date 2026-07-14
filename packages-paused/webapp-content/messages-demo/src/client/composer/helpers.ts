/**
 * Composer network + UI helpers.
 *
 * Extracted from `composer.ts`. None of these functions hold composer
 * state; they take the data they need as arguments and operate on
 * passed-in DOM nodes.
 */

import type { ComposerState, } from './state.ts';

/**
 * Decimal radix for `parseInt`.
 */
const DECIMAL_RADIX = 10;

/**
 * Sentinel returned by `parseEditId` for the new-message mode (no
 * `data-edit-message-id`). A unique `Symbol` rather than `null`: an
 * edit-mode id is always a number, so callers gate with `=== NEW_MESSAGE`.
 */
export const NEW_MESSAGE: unique symbol = Symbol('messages-demo:new-message',);

/**
 * Sentinel returned by `fetchHeadDraftId` when a draft should be created
 * with no parent. A unique `Symbol` rather than `null`: a real head draft
 * id is a string, so callers gate with `=== NO_PARENT`.
 */
export const NO_PARENT: unique symbol = Symbol('messages-demo:no-parent',);

/**
 * Writes `text` into the body surface, updating both the hidden
 * textarea (which downstream code reads synchronously) and the custom
 * editor (when mounted). Use this everywhere instead of assigning
 * `textarea.value =` directly so the editor and the textarea cannot
 * diverge.
 *
 * @param input - composer state, textarea, replacement text
 *
 * @example
 * ```ts
 * writeBody({ state, textarea, text: chunk.md });
 * ```
 */
export function writeBody(
  input: {
    state: ComposerState;
    textarea: HTMLTextAreaElement;
    text: string;
  },
): void {
  input.textarea
    .value = input.text;
  if (input.state
    .editor
    !== undefined)
    void input.state
      .editor
      .setText(input.text,);
}

/**
 * Range for the random-id fallback when `crypto.randomUUID` is unavailable.
 */
const RANDOM_ID_RANGE = 1e9;

/**
 * POSTs to `/api/drafts` to create a draft.
 *
 * @param input - draft id, owning user, optional parent draft id
 *
 * @example
 * ```ts
 * await postCreateDraft({ id, userId });
 * ```
 */
export async function postCreateDraft(
  input: {
    readonly id: string;
    readonly userId: string;
    readonly parentId?: string;
  },
): Promise<void> {
  /**
   * Awaited so the `!ok` branch can read the body before throwing.
   */
  const response = await fetch(
    '/api/drafts',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify({
        id: input.id,
        user_id: input.userId,
        parent_id: input.parentId,
      },),
    },
  );
  if (!response.ok) {
    /**
     * Server-supplied error body folded into the thrown message for the caller's logs.
     */
    const message = await response.text();
    throw new Error(`create draft failed: ${message}`,);
  }
}

/**
 * Fetches the chunk_count for a message via a HEAD-style read of `/m/:id`.
 * For the demo we hit `/m/:id/c/0` and parse the chunk count from the
 * navigation label; this avoids adding a dedicated metadata endpoint.
 *
 * @param messageId - target message id
 *
 * @returns chunk count parsed from the navigation label
 *
 * @example
 * ```ts
 * const count = await fetchChunkCount(42);
 * ```
 */
export async function fetchChunkCount(messageId: number,): Promise<number> {
  /**
   * Awaited before reading the body so the body-read can throw the network error first if any.
   */
  const response = await fetch(`/m/${String(messageId,)}/c/0`,);
  /**
   * Full HTML of the chunk-0 nav, scanned for the chunk-count regex.
   */
  const text = await response.text();
  /* oxlint-disable no-restricted-syntax/no-regex -- parses "chunk N of M" from server-rendered nav fragment; bounded captures over server-controlled HTML, linear in input length */
  /**
   * Holds the regex match so the count can be parsed from capture group 1.
   */
  const match = /chunk\s+\d+\s+of\s+(\d+)/u.exec(text,);
  /* oxlint-enable no-restricted-syntax/no-regex */
  /**
   * Extracted before the undefined check so the call site sees one narrowed string.
   */
  const captured = match?.[1];
  if (captured === undefined)
    throw new Error('could not determine chunk count',);
  return Number.parseInt(
    captured,
    DECIMAL_RADIX,
  );
}

/**
 * Fetches the head draft id for a message. We do not expose this via a
 * dedicated endpoint; the demo passes `null` which means the new draft
 * has no parent and the granular-edit inheritance path uploads every
 * chunk explicitly.
 *
 * Returning `NO_PARENT` here is the safe option for the demo: edits create
 * a draft with no parent, and the tier-3 path uploads (or inherits via
 * fetch-and-PUT) every chunk explicitly. The tradeoff is more network
 * traffic on edit; the never-stale guarantee and revision count are
 * unaffected.
 *
 * @param _messageId - reserved for a future dedicated endpoint
 *
 * @returns `NO_PARENT` until a dedicated metadata endpoint is added
 *
 * @example
 * ```ts
 * const parent = await fetchHeadDraftId(42); // NO_PARENT for the demo
 * ```
 */
export function fetchHeadDraftId(_messageId: number,): Promise<string | typeof NO_PARENT> {
  return Promise.resolve(NO_PARENT,);
}

/**
 * Generates a UUID for client-side draft ids. Uses `crypto.randomUUID`
 * when available, falls back to a `Math.random` shim for older
 * browsers / non-secure contexts.
 *
 * @returns UUID string
 *
 * @example
 * ```ts
 * const id = randomId();
 * ```
 */
export function randomId(): string {
  if (((typeof crypto) !== 'undefined') && ((typeof crypto.randomUUID) === 'function'))
    return crypto.randomUUID();
  return `d-${String(Date.now(),)}-${
    String(Math.floor(Math.random()
      * RANDOM_ID_RANGE,),)
  }`;
}

/**
 * Reads the current identity from the form's select element. Used by
 * the edit-mode setup before the composer state object is built.
 *
 * @param form - composer form element
 *
 * @returns selected user id, or empty string when no selection exists
 *
 * @example
 * ```ts
 * const userId = getIdentity(form);
 * ```
 */
export function getIdentity(form: HTMLFormElement,): string {
  return form.querySelector<HTMLSelectElement>('.composer-identity',)
    ?.value
    ?? '';
}

/**
 * Parses the optional `data-edit-message-id` attribute off the form.
 *
 * @param raw - attribute value
 *
 * @returns numeric id, or `NEW_MESSAGE` for new-message mode
 *
 * @example
 * ```ts
 * parseEditId('42'); // 42
 * parseEditId(undefined); // NEW_MESSAGE
 * ```
 */
export function parseEditId(raw?: string,): number | typeof NEW_MESSAGE {
  if ((raw === undefined) || (raw === ''))
    return NEW_MESSAGE;
  /**
   * Parsed once so the finite-and-positive guard and the return can both reference it.
   */
  const value = Number.parseInt(
    raw,
    DECIMAL_RADIX,
  );
  return (Number.isFinite(value,)
    && (value > 0)) ? value : NEW_MESSAGE;
}

/**
 * Appends a small status `<div>` below the composer if one is not
 * already there.
 *
 * @param form - composer form element
 *
 * @returns the existing or newly-created status element
 *
 * @example
 * ```ts
 * const status = appendStatusElement(form);
 * ```
 */
export function appendStatusElement(form: HTMLFormElement,): HTMLElement {
  /**
   * Returned as-is when present so repeated calls do not re-append the same div.
   */
  const existing = form.querySelector<HTMLElement>('.composer-status',);
  if (existing !== null)
    return existing;
  /**
   * Lazily created on first call; appended below and returned to the caller.
   */
  const status = document.createElement('div',);
  status.className = 'composer-status';
  form.append(status,);
  return status;
}

/**
 * Updates the composer's status indicator. The composer uses this for
 * "saved", "uploading", "error", etc.
 *
 * @param input - status element returned by `appendStatusElement` plus the text
 *
 * @example
 * ```ts
 * setStatus({ status, message: 'uploading...' });
 * ```
 */
export function setStatus(
  input: {
    status: HTMLElement;
    message: string;
  },
): void {
  input.status
    .textContent = input.message;
}

/**
 * Adds the "volatile mode" badge when persistent storage is unavailable
 * so the user knows their unsent buffer is in-memory.
 *
 * @param form - composer form element
 *
 * @example
 * ```ts
 * appendVolatileBadge(form);
 * ```
 */
export function appendVolatileBadge(form: HTMLFormElement,): void {
  /**
   * Indicator pinned next to the composer so users notice unsent edits are in-memory only.
   */
  const badge = document.createElement('span',);
  badge.className = 'composer-volatile-badge';
  badge.textContent = 'volatile mode';
  badge.title = 'No persistent storage available; unsent edits are lost on reload';
  form.append(badge,);
}
