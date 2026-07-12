/**
 * Shared runtime state: the class of the currently focused window.
 *
 * The KWin script reports focus changes via the `SetActiveWindow` D-Bus method,
 * and the evdev double-shift handler reads this to decide whether to trip F20
 * (only when Neovide is focused). This is genuinely mutable process state, so it
 * lives behind a getter/setter pair rather than an exported binding.
 *
 * @module
 */

/**
 * Mutable holder for the focused window class, a `const` object rather than a
 * module-root `let` binding.
 */
const windowState: { current: string } = { current: '' };

/**
 * Read the class of the currently focused window.
 *
 * @returns Lowercased resource class, or empty string before any focus report
 *
 * @example
 * ```ts
 * if (getActiveWindowClass() === NEOVIDE_CLASS) { ... }
 * ```
 */
export function getActiveWindowClass(): string {
  return windowState.current;
}

/**
 * Record the class of the newly focused window.
 *
 * @param windowClass - Resource class reported by the KWin script
 *
 * @example
 * ```ts
 * setActiveWindowClass('neovide');
 * ```
 */
export function setActiveWindowClass(windowClass: string): void {
  windowState.current = windowClass;
}
