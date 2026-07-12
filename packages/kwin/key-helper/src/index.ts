/**
 * key-helper daemon entry point.
 *
 * Claims the {@link DBUS_SERVICE} bus name, exports {@link KeyHelperInterface}
 * for the KWin script to drive, and monitors every Shift-capable input device
 * for double-shift. Double-shift trips F20 in Neovim only while Neovide is
 * focused, so the tap stays passive everywhere else (e.g. VSCodium keeps its own
 * double-shift).
 *
 * This half does the actuation KWin scripts cannot: spawning processes, injecting
 * keys via ydotool, and talking to Neovim over RPC.
 *
 * @module
 */

import dbus from 'dbus-next';

import {
  DBUS_PATH,
  DBUS_SERVICE,
  NEOVIDE_CLASS,
} from './constants.ts';
import { KeyHelperInterface } from './dbus-iface.ts';
import {
  findShiftDevices,
  startEvdevMonitor,
} from './evdev.ts';
import { sendNvimInput } from './nvim.ts';
import { getActiveWindowClass } from './state.ts';

/**
 * Start the D-Bus service and every evdev monitor.
 *
 * @returns Nothing, resolves once all devices are being monitored
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /** Session bus connection. */
  const bus = dbus.sessionBus();
  /** Exported interface instance. */
  const iface = new KeyHelperInterface();
  bus.export(DBUS_PATH, iface);
  // 0: request the name with no special flags.
  await bus.requestName(DBUS_SERVICE, 0);
  console.log(`[key-helper] D-Bus service registered: ${DBUS_SERVICE}`);

  /** Every readable Shift-capable input device. */
  const devices = findShiftDevices();
  if (devices.length === 0) {
    console.error('[key-helper] no readable input devices found -- double-shift disabled');
  }
  for (const device of devices) {
    console.log(`[key-helper] monitoring: ${device.path} (${device.name})`);
    await startEvdevMonitor({
      devicePath: device.path,
      onDoubleShift: () => {
        if (getActiveWindowClass() === NEOVIDE_CLASS) {
          console.log('[key-helper] double-shift, sending F20');
          void sendNvimInput('<F20>');
        }
      },
    });
  }
}

try {
  await main();
} catch (error) {
  /** Stack or message for a fatal startup failure. */
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`[key-helper] fatal: ${message}`);
  process.exitCode = 1;
}
