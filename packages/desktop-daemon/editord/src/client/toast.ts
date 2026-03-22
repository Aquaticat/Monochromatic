/**
 * Ephemeral toast notifications positioned near the editor cursor.
 *
 * Creates a temporary fixed-position element that auto-dismisses
 * after a short duration. Used for non-critical feedback like
 * "no definition found" from LSP actions.
 */

/** Duration in milliseconds before the toast is removed. */
const DISMISS_MS = 2000;

/** Vertical gap below the cursor in pixels. */
const VERTICAL_OFFSET = 4;

/**
 * Shows a brief toast message near the editor cursor.
 * The toast auto-dismisses after {@link DISMISS_MS}.
 *
 * @param message - text to display
 *
 * @param rect - bounding rectangle of the editor cursor for positioning
 *
 * @example
 * ```ts
 * const rect = editorPane.getCursorRect();
 * if (rect !== null) showCursorToast({ message: 'No definition found', rect });
 * ```
 */
export function showCursorToast({ message, rect, }: { message: string; rect: DOMRect }): void {
  const toast = document.createElement('div',);
  toast.textContent = message;

  toast.style.setProperty('position', 'fixed',);
  toast.style.setProperty('inset-inline-start', `${rect.left}px`,);
  toast.style.setProperty('inset-block-start', `${rect.bottom + VERTICAL_OFFSET}px`,);
  toast.style.setProperty('z-index', '200',);
  toast.style.setProperty('padding-block', '0.25rem',);
  toast.style.setProperty('padding-inline', '0.5rem',);
  toast.style.setProperty('background-color', 'var(--hover-bg)',);
  toast.style.setProperty('color', 'var(--fg-muted, var(--fg))',);
  toast.style.setProperty('border-radius', '0.25rem',);
  toast.style.setProperty('font-family', "'JetBrains Mono', monospace",);
  toast.style.setProperty('font-size', '0.8125rem',);
  toast.style.setProperty('pointer-events', 'none',);
  toast.style.setProperty('opacity', '0.9',);

  document.body.append(toast,);

  globalThis.setTimeout(function dismissToast() {
    toast.remove();
  }, DISMISS_MS,);
}
