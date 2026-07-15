/**
 * Keyboard and click event handlers for the lecture screen.
 *
 * Each handler takes a runtime ref so it can cancel a pending
 * typewriter reveal before advancing, plus the navigation callbacks
 * to call when the user clicks or presses a key.
 */
import type { Cancel, } from './lecture-typewriter.ts';

/**
 * Per-mount runtime ref exposing the typewriter cancel handle.
 */
export type RuntimeRef = {
  /**
   * Pending typewriter cancel, cleared after invocation.
   */
  typewriterCancel: Cancel | undefined;
};

/**
 * Keyboard keys that trigger advance to the next beat.
 */
const ADVANCE_KEYS: ReadonlySet<string> = new Set([
  ' ',
  'Enter',
  'ArrowRight',
],);

/**
 * CSS selector used to short-circuit stage clicks on buttons/toolbar.
 */
const CONTROLS_SELECTOR = '.stage-controls, .stage-dialogue button';

/**
 * Builds the keyboard handler driving advance/regress shortcuts.
 *
 * @param runtime - per-mount runtime ref consulted to cancel a typewriter reveal
 *
 * @param advance - callback that moves to the next beat
 *
 * @param regress - callback that moves to the previous beat
 *
 * @returns the wired handler ready for `document.addEventListener('keydown', ...)`
 *
 * @example
 * ```ts
 * const onKey = lectureKeyHandler({ runtime, advance, regress });
 * document.addEventListener('keydown', onKey);
 * ```
 */
export function lectureKeyHandler(
  {
    runtime,
    advance,
    regress,
  }: {
    runtime: RuntimeRef;
    advance: () => void;
    regress: () => void;
  },
): (ev: KeyboardEvent,) => void {
  return function onKey(ev: KeyboardEvent,): void {
    if (ADVANCE_KEYS.has(ev.key,)) {
      ev.preventDefault();
      if (runtime.typewriterCancel
        !== undefined) {
        runtime.typewriterCancel();
        runtime.typewriterCancel = undefined;
        return;
      }
      advance();
    }
    else if (ev.key
      === 'ArrowLeft') {
      ev.preventDefault();
      regress();
    }
  };
}

/**
 * Builds the stage click handler that advances the dialogue while
 * ignoring clicks on toolbar/dialogue controls.
 *
 * @param runtime - per-mount runtime ref consulted to cancel a typewriter reveal
 *
 * @param advance - callback that moves to the next beat
 *
 * @returns the wired handler ready for `stage.addEventListener('click', ...)`
 *
 * @example
 * ```ts
 * const onStageClick = lectureStageClickHandler({ runtime, advance });
 * stage.addEventListener('click', onStageClick);
 * ```
 */
export function lectureStageClickHandler(
  {
    runtime,
    advance,
  }: {
    runtime: RuntimeRef;
    advance: () => void;
  },
): (ev: MouseEvent,) => void {
  return function onStageClick(ev: MouseEvent,): void {
    if (
      (ev.target
        instanceof Element)
      && (ev.target
        .closest<HTMLElement>(CONTROLS_SELECTOR,)
        !== null)
    ) {
      return;
    }
    if (runtime.typewriterCancel
      !== undefined) {
      runtime.typewriterCancel();
      runtime.typewriterCancel = undefined;
      return;
    }
    advance();
  };
}
