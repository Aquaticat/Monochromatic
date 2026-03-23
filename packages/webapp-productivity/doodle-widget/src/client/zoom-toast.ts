/**
 * Toast notification for zoom tool instructions.
 *
 * Shows a brief hint when the zoom tool is selected, then
 * auto-dismisses after a timeout. Uses the Popover API for
 * non-modal overlay without blocking interaction.
 */

/** Duration in milliseconds before the toast auto-hides */
const TOAST_DURATION_MS = 3_000;

/** Timer id for the auto-dismiss timeout */
let hideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows the zoom instruction toast, auto-hiding after a delay.
 *
 * No-op if the toast element is missing (graceful degradation).
 *
 * @param toast - popover element to show
 */
export function showZoomToast(toast: HTMLElement,): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer,);
    hideTimer = null;
  }
  toast.showPopover();
  hideTimer = setTimeout(function hideToast(): void {
    toast.hidePopover();
    hideTimer = null;
  }, TOAST_DURATION_MS,);
}
