/**
 * Custom-editor mount helper.
 *
 * Extracted from `composer.ts` so the entry module stays under the
 * per-file line cap. Mounts the worker-backed editor as a sibling of
 * the textarea and wires change events to mirror text back into the
 * textarea so the rest of the composer (tier3, send) can continue
 * reading `textarea.value` synchronously.
 */

import { mountEditor, } from '../editor/index.ts';
import type { ComposerState, } from './state.ts';

/**
 * Mounts the custom editor and wires its change events to mirror
 * text into the (now hidden) textarea. Call only when
 * `?editor=custom` is on the URL.
 *
 * @param input - form, textarea, composer state
 *
 * @example
 * ```ts
 * await mountCustomEditor({ form, textarea, state });
 * ```
 */
export async function mountCustomEditor(
  input: {
    form: HTMLFormElement;
    textarea: HTMLTextAreaElement;
    state: ComposerState;
  },
): Promise<void> {
  /**
   * Mount node inserted as a sibling of the textarea; the editor renders into this element.
   */
  const host = document.createElement('div',);
  // Use a distinct class; not `composer-body`: so
  // `querySelector('.composer-body')` continues to return the textarea
  // unambiguously elsewhere in the page.
  host.className = 'composer-body--custom';
  // Hide the textarea but leave it in DOM so reads of
  // `textarea.value` continue to work.
  input.textarea
    .hidden = true;
  input.textarea
    .parentNode
    ?.insertBefore(
    host,
    input.textarea,
  );
  /**
   * URL-flag override that surfaces editor-internal trace logs in the browser console.
   */
  const debug = new URLSearchParams(globalThis.location
    .search,).get('debug',)
    === '1';
  /**
   * Saved on composer state so later send/promote steps can read editor text or unmount it.
   */
  const editor = await mountEditor({
    host,
    initialText: input.textarea
      .value,
    debug,
  },);
  input.state
    .editor = editor;
  editor.on(
    'change',
    function mirror() {
      input.textarea
        .value = editor.text;
      // Dispatch a synthetic `input` event so `queueTierPromotionCheck`
      // (which is registered on the textarea) still fires for typing
      // through the custom editor.
      input.textarea
        .dispatchEvent(new Event(
        'input',
        { bubbles: true, },
      ),);
    },
  );
}
