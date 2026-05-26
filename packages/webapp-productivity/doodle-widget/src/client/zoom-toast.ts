/**
 * Toast notification for zoom tool instructions.
 *
 * Shows a brief hint when the zoom tool is selected, then
 * auto-dismisses after a timeout. Uses the Popover API for
 * non-modal overlay without blocking interaction.
 */

import {
  ABSENT,
  type Maybe,
} from './maybe.ts';

/** Duration in milliseconds before the toast auto-hides */
const TOAST_DURATION_MS = 3_000;

/**
 * Timer id container for the auto-dismiss timeout.
 *
 * Stored as an object property so module-root state stays in a `const`
 * container (`no-module-root-let` would otherwise reject a top-level `let`).
 */
const timerState: { id: Maybe<ReturnType<typeof setTimeout>>; } = { id: ABSENT, };

/**
 * Shows the zoom instruction toast, auto-hiding after a delay.
 *
 * No-op if the toast element is missing (graceful degradation).
 *
 * @param toast - popover element to show
 *
 * @example
 * ```ts
 * showZoomToast(document.getElementById('zoom-toast'));
 * ```
 */
export function showZoomToast(toast: HTMLElement,): void {
  if (timerState.id
    !== ABSENT) {
    clearTimeout(timerState.id,);
    timerState.id = ABSENT;
  }
  toast.showPopover();
  timerState.id = setTimeout(
    function hideToast(): void {
      toast.hidePopover();
      timerState.id = ABSENT;
    },
    TOAST_DURATION_MS,
  );
}
