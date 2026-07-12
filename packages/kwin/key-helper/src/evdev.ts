/**
 * evdev device discovery and monitoring (the I/O half of double-shift).
 *
 * All readable input devices that expose a Shift key are monitored, rather than
 * trying to tell keyboards from mice: gaming mice (e.g. Razer Naga) expose a
 * keyboard interface with programmable keys that may be bound to combos we care
 * about. Each device stream is decoded into fixed-size evdev records and fed to
 * the pure {@link reduceShiftEvent} detector.
 *
 * @module
 */

import {
  closeSync,
  openSync,
  readdirSync,
  readSync,
} from 'node:fs';
import { open } from 'node:fs/promises';

import {
  INITIAL_SHIFT_STATE,
  parseBitmap,
  reduceShiftEvent,
  type ShiftState,
} from './evdev-parse.ts';

/** evdev `type` value for a key event. */
const EV_KEY = 1;

/** evdev code for the left Shift key. */
const KEY_LEFTSHIFT = 42;

/** evdev code for the right Shift key. */
const KEY_RIGHTSHIFT = 54;

/**
 * Size of one `struct input_event` on 64-bit Linux: `timeval`(16) + type(2) +
 * code(2) + value(4).
 */
const EVENT_SIZE = 24;

/** Byte offset of the `type` field within an event record. */
const TYPE_OFFSET = 16;

/** Byte offset of the `code` field within an event record. */
const CODE_OFFSET = 18;

/** Byte offset of the `value` field within an event record. */
const VALUE_OFFSET = 20;

/** Buffer size for reading small sysfs capability and name nodes. */
const SYS_READ_SIZE = 256;

/** Directory of evdev character devices. */
const INPUT_DIR = '/dev/input';

/** sysfs directory describing each input device. */
const SYS_INPUT_DIR = '/sys/class/input';

/**
 * A monitorable input device.
 *
 * @example
 * ```ts
 * const [first] = findShiftDevices();
 * ```
 */
export type Device = {
  /** Absolute path of the evdev character device. */
  readonly path: string;
  /** Human-readable device name from sysfs. */
  readonly name: string;
};

/**
 * Read a small sysfs text node fully into a trimmed string.
 *
 * @param filePath - Absolute path of the sysfs node
 * @returns Trimmed node contents
 * @example
 * ```ts
 * readSysfs('/sys/class/input/event3/device/name');
 * ```
 */
function readSysfs(filePath: string): string {
  /** Open file descriptor for the sysfs node. */
  const fd = openSync(filePath, 'r');
  try {
    /** Scratch buffer for the node contents. */
    const buf = Buffer.alloc(SYS_READ_SIZE);
    /** Number of bytes actually read. */
    const n = readSync(fd, buf, 0, SYS_READ_SIZE, 0);
    return buf.subarray(0, n).toString('utf8').trim();
  } finally {
    closeSync(fd);
  }
}

/**
 * Discover every readable input device that exposes a Shift key.
 *
 * @returns Devices safe to open and worth monitoring for double-shift
 * @example
 * ```ts
 * for (const dev of findShiftDevices()) { await startEvdevMonitor({ devicePath: dev.path, onDoubleShift }); }
 * ```
 */
export function findShiftDevices(): readonly Device[] {
  /** All `eventN` entries under {@link INPUT_DIR}. */
  const entries = readdirSync(INPUT_DIR).filter((f) => f.startsWith('event'));
  /** Accumulated devices that pass every probe. */
  const results: Device[] = [];
  for (const dev of entries) {
    /** Absolute path of this candidate device. */
    const path = `${INPUT_DIR}/${dev}`;
    try {
      /** Key-capability bitmap for this device. */
      const bitmap = parseBitmap(readSysfs(`${SYS_INPUT_DIR}/${dev}/device/capabilities/key`));
      if (!bitmap.has(KEY_LEFTSHIFT) && !bitmap.has(KEY_RIGHTSHIFT)) {
        continue;
      }
      // Confirm the seat ACL actually lets us open the device before listing it.
      closeSync(openSync(path, 'r'));
      results.push({ path, name: readSysfs(`${SYS_INPUT_DIR}/${dev}/device/name`) });
    } catch {
      // Unreadable or malformed device (permission denied on a non-keyboard,
      // hot-unplugged mid-probe): expected, skip it rather than fail discovery.
      continue;
    }
  }
  return results;
}

/**
 * Extract the evdev `type`, `code`, and `value` from one raw event record.
 *
 * @param record - Exactly {@link EVENT_SIZE} bytes of one `input_event`
 * @returns Decoded fields needed by the double-shift detector
 * @example
 * ```ts
 * const { type, code, value } = decodeEvent(buf);
 * ```
 */
function decodeEvent(record: Buffer): { type: number; code: number; value: number } {
  return {
    type: record.readUInt16LE(TYPE_OFFSET),
    code: record.readUInt16LE(CODE_OFFSET),
    value: record.readInt32LE(VALUE_OFFSET),
  };
}

/**
 * Monitor one device for double-shift, invoking `onDoubleShift` each time two
 * clean Shift taps land within the detection window.
 *
 * @param devicePath - Absolute path of the evdev device to read
 * @param onDoubleShift - Called (fire-and-forget) when a double-shift completes
 * @example
 * ```ts
 * await startEvdevMonitor({ devicePath: '/dev/input/event3', onDoubleShift: () => {} });
 * ```
 */
export async function startEvdevMonitor({ devicePath, onDoubleShift }: {
  devicePath: string;
  onDoubleShift: () => void;
}): Promise<void> {
  /** Open handle for the device, streamed below. */
  const fh = await open(devicePath, 'r');
  /** Byte stream of raw evdev records. */
  const stream = fh.createReadStream();
  /** Reassembly buffer for one event straddling chunk boundaries. */
  const record = Buffer.alloc(EVENT_SIZE);
  /** Detector state carried across events. */
  let state: ShiftState = INITIAL_SHIFT_STATE;
  /** Bytes currently buffered in `record`. */
  let filled = 0;

  stream.on('data', (chunk: Buffer) => {
    /** Cursor into the incoming chunk. */
    let offset = 0;
    while (offset < chunk.length) {
      /** Bytes copied from this chunk into the record on this step. */
      const copied = Math.min(EVENT_SIZE - filled, chunk.length - offset);
      chunk.copy(record, filled, offset, offset + copied);
      filled += copied;
      offset += copied;
      if (filled !== EVENT_SIZE) {
        continue;
      }
      filled = 0;
      /** Decoded fields of the completed record. */
      const { type, code, value } = decodeEvent(record);
      if (type !== EV_KEY) {
        continue;
      }
      /** Result of folding this key event into the detector. */
      const result = reduceShiftEvent({
        state,
        event: {
          isShift: code === KEY_LEFTSHIFT || code === KEY_RIGHTSHIFT,
          value,
          now: performance.now(),
        },
      });
      state = result.state;
      if (result.doubleShift) {
        onDoubleShift();
      }
    }
  });

  stream.on('error', (error) => {
    console.error(`[key-helper] evdev read error: ${error.message}`);
  });

  console.log(`[key-helper] monitoring ${devicePath} for double-shift`);
}
