/**
 * Shared D-Bus identity and timing constants for the key-helper daemon.
 *
 * The KWin companion script (`kwin-script/contents/code/main.js`) hard-codes the
 * same D-Bus service, path, and interface strings because the Plasma JavaScript
 * runtime cannot import TypeScript. Keep the two in sync when changing them.
 *
 * @module
 */

/**
 * D-Bus well-known name the daemon claims and the KWin script calls.
 *
 * @example
 * ```ts
 * await bus.requestName(DBUS_SERVICE, 0);
 * ```
 */
export const DBUS_SERVICE = 'org.monochromatic.KeyHelper';

/**
 * Object path the interface is exported at.
 *
 * @example
 * ```ts
 * bus.export(DBUS_PATH, iface);
 * ```
 */
export const DBUS_PATH = '/org/monochromatic/KeyHelper';

/**
 * Interface name for the exported methods, matching {@link DBUS_SERVICE} by convention.
 *
 * @example
 * ```ts
 * super(DBUS_IFACE);
 * ```
 */
export const DBUS_IFACE = 'org.monochromatic.KeyHelper';

/**
 * Maximum gap between two Shift taps for them to count as one double-shift.
 *
 * Chosen to match a deliberate double-tap without catching two unrelated Shift
 * presses seconds apart.
 *
 * @example
 * ```ts
 * if (delta < DOUBLE_TAP_MS) { ... }
 * ```
 */
export const DOUBLE_TAP_MS = 300;

/**
 * Lowercased window class that scopes double-shift to Neovide, so the F20 trip
 * only fires when Neovide is focused.
 *
 * @example
 * ```ts
 * if (getActiveWindowClass() === NEOVIDE_CLASS) { ... }
 * ```
 */
export const NEOVIDE_CLASS = 'neovide';
