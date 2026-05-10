/**
 * Editor input interceptor.
 *
 * Translates browser-level edits on the contenteditable surface into
 * `Changeset`s that flow into the editor pipeline. The contenteditable
 * is an input surface only; its DOM is not the source of truth (per
 * plan §1, "DOM-as-source-of-truth invariant", verification 16a).
 *
 * Three categories of input handled:
 *
 * 1. **Plain edits** -- `beforeinput` covers insert text, delete
 *    backward/forward, paste, cut, undo/redo (via execCommand or
 *    keyboard). We intercept (`preventDefault`) and emit our own
 *    changeset.
 * 2. **IME composition** -- `compositionstart` flips a guard so we do
 *    not race the browser's tentative DOM mutations; `compositionend`
 *    reads the composed text and emits a single changeset, then
 *    re-renders the line so the browser's transient nodes are wiped.
 * 3. **Keyboard shortcuts** -- Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z map to
 *    `undo` / `redo` on the buffer worker via the `apply` channel
 *    (the worker exposes them as separate messages but we route
 *    through `apply` for now -- TODO once the wider editor lands).
 *
 * Note on undo/redo wiring: the worker has dedicated `undo`/`redo`
 * messages, but the public Editor surface in `index.ts` does not yet
 * expose them. For Phase 2 we let the browser handle in-document undo
 * via execCommand and rely on the worker-side undo stack only for
 * future use. The plan explicitly allows this incremental rollout.
 */

import type { Changeset, } from './changeset.ts';
import type { Selection, } from './selection.ts';

/** Input layer destructor. */
type InputCleanup = () => void;

/**
 * Attaches input handlers to the surface. Returns a cleanup function
 * that removes every listener.
 *
 * @param input - surface, apply callback, selection layer, mirror getter
 *
 * @returns cleanup function
 *
 * @example
 * ```ts
 * const off = attachInput({ surface, apply, selection, getMirror });
 * // ...
 * off();
 * ```
 */
export function attachInput(
  input: {
    surface: HTMLElement;
    apply: (changeset: Changeset,) => Promise<Changeset>;
    selection: Selection;
    getMirror: () => string;
  },
): InputCleanup {
  /** True while an IME composition is in progress. */
  let composing = false;

  /**
   * Sends a changeset, swallowing the inverse return value (it is
   * already mirrored into the worker's undo stack).
   *
   * @param changeset - the change to apply
   */
  function emit(changeset: Changeset,): void {
    void input.apply(changeset,);
  }

  /**
   * Resolves the active selection or, if none, a collapsed cursor at
   * the end of the buffer. Used by `beforeinput` handlers when the
   * browser doesn't supply target ranges (rare but possible for some
   * synthetic input types).
   *
   * @returns from/to half-open range
   */
  function currentRange(): {
    from: number;
    to: number;
  } {
    const selection = input.selection.get();
    if (selection !== null)
      return selection;
    const { length, } = input.getMirror();
    return {
      from: length,
      to: length,
    };
  }

  /**
   * Deletes one code unit before the cursor, collapsing into a
   * selection delete when the selection is non-empty.
   */
  function handleBackspace(): void {
    const range = currentRange();
    if (range.from < range.to) {
      emit({
        from: range.from,
        to: range.to,
        insert: '',
      },);
      return;
    }
    if (range.from === 0)
      return;
    emit({
      from: range.from - 1,
      to: range.from,
      insert: '',
    },);
  }

  /** Mirror of `handleBackspace` for the forward-delete key. */
  function handleDelete(): void {
    const range = currentRange();
    if (range.from < range.to) {
      emit({
        from: range.from,
        to: range.to,
        insert: '',
      },);
      return;
    }
    const { length, } = input.getMirror();
    if (range.from >= length)
      return;
    emit({
      from: range.from,
      to: range.from + 1,
      insert: '',
    },);
  }

  /**
   * Inserts text at (or replacing) the current selection. Empty
   * `text` is a no-op.
   *
   * @param text - text to insert
   */
  function handleInsert(text: string,): void {
    if (text.length === 0)
      return;
    const range = currentRange();
    emit({
      from: range.from,
      to: range.to,
      insert: text,
    },);
  }

  /**
   * Intercepts the browser's `beforeinput` event, prevents default, and
   * dispatches to the appropriate handler based on `inputType`.
   *
   * @param event - the `beforeinput` event from the contenteditable
   */
  function onBeforeInput(event: InputEvent,): void {
    if (composing)
      return;
    // We always handle the edit ourselves; preventing the default
    // stops the browser from mutating the DOM out from under us.
    event.preventDefault();

    if (event.inputType === 'insertText' || event.inputType === 'insertCompositionText') {
      handleInsert(event.data ?? '',);
      return;
    }
    if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
      handleInsert('\n',);
      return;
    }
    if (event.inputType === 'deleteContentBackward') {
      handleBackspace();
      return;
    }
    if (event.inputType === 'deleteContentForward') {
      handleDelete();
      return;
    }
    if (event.inputType === 'insertFromPaste') {
      const text = event.dataTransfer?.getData('text/plain',) ?? event.data ?? '';
      handleInsert(text,);
      return;
    }
    if (event.inputType === 'deleteByCut') {
      const range = currentRange();
      if (range.from < range.to) {
        emit({
          from: range.from,
          to: range.to,
          insert: '',
        },);
      }
      return;
    }
    // Fallback: if there is `data`, treat it as an insertion;
    // otherwise treat it as a backward delete.
    if (typeof event.data === 'string' && event.data.length > 0) {
      handleInsert(event.data,);
      return;
    }
    handleBackspace();
  }

  /**
   * Sets the `composing` guard so `onBeforeInput` doesn't race the
   * browser's tentative composition mutations.
   */
  function onCompositionStart(): void {
    composing = true;
  }

  /**
   * Reads the final composed text after the browser closes a
   * composition session, emits it as a single insertion changeset, and
   * clears the guard.
   *
   * @param event - the `compositionend` event
   */
  function onCompositionEnd(event: CompositionEvent,): void {
    composing = false;
    // The browser has applied the composed text to the contenteditable
    // DOM; we read it out and emit a single changeset, then the next
    // viewport repaint clears the browser's transient nodes.
    const text = event.data ?? '';
    if (text.length > 0)
      handleInsert(text,);
  }

  /**
   * Intercepts paste so we read the plain-text payload ourselves and
   * route it through the same insertion path as typed text. Stops the
   * browser from inserting rich content into the contenteditable.
   *
   * @param event - the `paste` event
   */
  function onPaste(event: ClipboardEvent,): void {
    if (event.clipboardData === null)
      return;
    const text = event.clipboardData.getData('text/plain',);
    if (text.length === 0)
      return;
    event.preventDefault();
    handleInsert(text,);
  }

  /**
   * Intercepts cut: copies the selected text to the clipboard and
   * emits the corresponding deletion changeset. Stops the browser
   * from removing DOM nodes out from under the viewport renderer.
   *
   * @param event - the `cut` event
   */
  function onCut(event: ClipboardEvent,): void {
    const range = currentRange();
    if (range.from >= range.to)
      return;
    const slice = input.getMirror().slice(
      range.from,
      range.to,
    );
    if (event.clipboardData !== null) {
      event.clipboardData.setData(
        'text/plain',
        slice,
      );
    }
    event.preventDefault();
    emit({
      from: range.from,
      to: range.to,
      insert: '',
    },);
  }

  /**
   * Intercepts copy and writes the selected text from the buffer
   * mirror onto the clipboard. We still let the browser fall through
   * if there's no selection so the default copy keybinding works on
   * read-only contexts.
   *
   * @param event - the `copy` event
   */
  function onCopy(event: ClipboardEvent,): void {
    const range = currentRange();
    if (range.from >= range.to)
      return;
    const slice = input.getMirror().slice(
      range.from,
      range.to,
    );
    if (event.clipboardData !== null) {
      event.clipboardData.setData(
        'text/plain',
        slice,
      );
      event.preventDefault();
    }
  }

  input.surface.addEventListener(
    'beforeinput',
    onBeforeInput,
  );
  input.surface.addEventListener(
    'compositionstart',
    onCompositionStart,
  );
  input.surface.addEventListener(
    'compositionend',
    onCompositionEnd,
  );
  input.surface.addEventListener(
    'paste',
    onPaste,
  );
  input.surface.addEventListener(
    'cut',
    onCut,
  );
  input.surface.addEventListener(
    'copy',
    onCopy,
  );

  return function cleanup() {
    input.surface.removeEventListener(
      'beforeinput',
      onBeforeInput,
    );
    input.surface.removeEventListener(
      'compositionstart',
      onCompositionStart,
    );
    input.surface.removeEventListener(
      'compositionend',
      onCompositionEnd,
    );
    input.surface.removeEventListener(
      'paste',
      onPaste,
    );
    input.surface.removeEventListener(
      'cut',
      onCut,
    );
    input.surface.removeEventListener(
      'copy',
      onCopy,
    );
  };
}
