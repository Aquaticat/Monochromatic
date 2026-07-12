/**
 * D-Bus interface the KWin script drives. Each method is a thin adapter onto the
 * key/nvim/launch/state modules; the D-Bus method signatures (positional string
 * args) are dictated by dbus-next, so they are exempt from the named-parameter
 * convention.
 *
 * @module
 */

import dbus from 'dbus-next';

import { DBUS_IFACE } from './constants.ts';
import { sendKeys } from './keys.ts';
import { launchNewInstance } from './launch.ts';
import { sendNvimInput } from './nvim.ts';
import { setActiveWindowClass } from './state.ts';

/**
 * Exported D-Bus interface bridging KWin script commands to actuation the KWin
 * script cannot perform (spawning processes, injecting keys, RPC to Neovim).
 *
 * @example
 * ```ts
 * bus.export(DBUS_PATH, new KeyHelperInterface());
 * ```
 */
export class KeyHelperInterface extends dbus.interface.Interface {
  /** Construct the interface under {@link DBUS_IFACE}. */
  constructor() {
    super(DBUS_IFACE);
  }

  /**
   * Record the focused window's class on every focus change (double-shift scope).
   *
   * @param windowClass - Resource class reported by the KWin script
   * @returns Nothing
   * @example
   * ```ts
   * iface.SetActiveWindow('neovide');
   * ```
   */
  SetActiveWindow(windowClass: string): void {
    setActiveWindowClass(windowClass.toLowerCase());
  }

  /**
   * Send F20 to Neovim, the manual equivalent of a detected double-shift.
   *
   * @returns Nothing
   * @example
   * ```ts
   * iface.SendF20();
   * ```
   */
  SendF20(): void {
    void sendNvimInput('<F20>');
  }

  /**
   * Send an arbitrary Neovim key sequence over RPC.
   *
   * @param keys - Neovim key notation, e.g. `<F16>`, `<C-w>`, `<Esc>`
   * @returns Nothing
   * @example
   * ```ts
   * iface.SendNvimKeys('<F16>');
   * ```
   */
  SendNvimKeys(keys: string): void {
    void sendNvimInput(keys);
  }

  /**
   * Inject a key combo into the focused app via ydotool.
   *
   * @param keys - `+`-joined combo, e.g. `ctrl+w`
   * @returns Nothing
   * @example
   * ```ts
   * iface.SendKeys('ctrl+w');
   * ```
   */
  SendKeys(keys: string): void {
    sendKeys(keys);
  }

  /**
   * Launch another instance of the focused app (Meta+N).
   *
   * @param desktopFileName - Focused window's `desktopFileName`, may be empty
   * @param resourceClass - Focused window's `resourceClass`, may be empty
   * @returns Nothing
   * @example
   * ```ts
   * iface.LaunchNewInstance('', 'ghostty');
   * ```
   */
  LaunchNewInstance(desktopFileName: string, resourceClass: string): void {
    launchNewInstance({ desktopFileName, resourceClass });
  }
}

KeyHelperInterface.configureMembers({
  methods: {
    SetActiveWindow: { inSignature: 's', outSignature: '' },
    SendF20: { inSignature: '', outSignature: '' },
    SendNvimKeys: { inSignature: 's', outSignature: '' },
    SendKeys: { inSignature: 's', outSignature: '' },
    LaunchNewInstance: { inSignature: 'ss', outSignature: '' },
  },
});
