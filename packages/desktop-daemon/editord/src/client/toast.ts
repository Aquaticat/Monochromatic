/**
 * Ephemeral toast notifications.
 *
 * Creates temporary fixed-position elements that auto-dismiss
 * after a short duration. Cursor-anchored toasts display near the editor
 * caret; fixed toasts center at the top of the viewport for warnings
 * not tied to a specific location.
 */

/** Duration in milliseconds before the toast is removed. */
const DISMISS_MS = 2000;

/** Vertical gap below the cursor in pixels. */
const VERTICAL_OFFSET = 4;

/**
 * Shows a brief toast message centered at the top of the viewport.
 * Used for warnings not tied to a specific cursor location.
 * The toast auto-dismisses after {@link DISMISS_MS}.
 *
 * @param message - text to display
 *
 * @example
 * ```ts
 * showFixedToast({ message: 'File too large to open' });
 * ```
 */
export function showFixedToast({ message, }: { message: string }): void {
  const toast = document.createElement('div',);
  toast.textContent = message;

  toast.style.setProperty('position', 'fixed',);
  toast.style.setProperty('inset-block-start', '1rem',);
  toast.style.setProperty('inset-inline-start', '50%',);
  toast.style.setProperty('transform', 'translateX(-50%)',);
  toast.style.setProperty('z-index', '200',);
  toast.style.setProperty('padding-block', '0.5rem',);
  toast.style.setProperty('padding-inline', '1rem',);
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
