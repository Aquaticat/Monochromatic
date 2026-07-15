/**
 * Pure evdev helpers: sysfs capability-bitmap parsing and the double-shift
 * state machine, kept free of I/O so both are unit-testable without a device.
 *
 * The double-shift detector is a reducer over shift/non-shift key events. A
 * double-shift is two Shift taps within {@link DOUBLE_TAP_MS}, where a "tap" is
 * a press then release with no other key pressed in between. Any non-shift key
 * pressed while Shift is held invalidates the current tap, so Shift+letter never
 * counts.
 *
 * @module
 */

import { DOUBLE_TAP_MS } from './constants.ts';

/**
 * Bits per space-separated word in a sysfs hex capability bitmap.
 */
const BITS_PER_WORD = 64;

/**
 * evdev `value` for a key press.
 */
const VALUE_PRESS = 1;

/**
 * evdev `value` for a key release.
 */
const VALUE_RELEASE = 0;

/**
 * Parse a sysfs hex capability bitmap into the set of bit positions it sets.
 *
 * The sysfs format is space-separated 64-bit hex words, most-significant word
 * first, so the words are reversed to make word index map to bit offset.
 *
 * @param hex - Contents of a `capabilities/*` sysfs node, e.g. `"1f 0 fffe"`
 *
 * @returns Bit positions (evdev codes) present in the bitmap
 *
 * @example
 * ```ts
 * parseBitmap('6'); // Set { 1, 2 }
 * ```
 */
export function parseBitmap(hex: string): ReadonlySet<number> {
  /**
   * Accumulated bit positions set anywhere in the bitmap.
   */
  const result = new Set<number>();
  /**
   * Words reversed so `words[0]` holds bits 0 to 63.
   */
  const words = hex
    .trim()
    .split(' ')
    .filter(function nonEmpty(word: string): boolean {
      return word.length > 0;
    })
    .toReversed();
  for (const [wordIndex, word] of words.entries()) {
    /**
     * Numeric value of one 64-bit hex word.
     */
    const value = BigInt(`0x${word}`);
    for (let bit = 0; bit < BITS_PER_WORD; bit += 1) {
      if (((value >> BigInt(bit)) & 1n) === 1n) {
        result.add((wordIndex * BITS_PER_WORD) + bit);
      }
    }
  }
  return result;
}

/**
 * Immutable double-shift detector state.
 *
 * @example
 * ```ts
 * let state = INITIAL_SHIFT_STATE;
 * ```
 */
export type ShiftState = {
  /**
   * Whether a Shift key is currently held.
   */
  readonly shiftPressed: boolean;
  /**
   * Whether a non-shift key was pressed during the current Shift hold.
   */
  readonly otherKeyDuring: boolean;
  /**
   * Timestamp (ms) of the previous clean Shift tap, or 0 when none pending.
   */
  readonly lastTapTime: number;
};

/**
 * Starting state for the double-shift detector.
 *
 * @example
 * ```ts
 * const { state, doubleShift } = reduceShiftEvent({ state: INITIAL_SHIFT_STATE, event });
 * ```
 */
export const INITIAL_SHIFT_STATE: ShiftState = {
  shiftPressed: false,
  otherKeyDuring: false,
  lastTapTime: 0,
};

/**
 * One key event fed to {@link reduceShiftEvent}.
 *
 * @example
 * ```ts
 * reduceShiftEvent({ state, event: { isShift: true, value: 1, now: 10 } });
 * ```
 */
export type ShiftEvent = {
  /**
   * Whether the key is a left or right Shift.
   */
  readonly isShift: boolean;
  /**
   * evdev value: 1 press, 0 release, 2 autorepeat.
   */
  readonly value: number;
  /**
   * Monotonic timestamp (ms) of the event.
   */
  readonly now: number;
};

/**
 * Result of reducing one event: the next state and whether a double-shift just
 * completed on this event.
 *
 * @example
 * ```ts
 * const { state: next, doubleShift } = reduceShiftEvent({ state, event });
 * ```
 */
export type ShiftResult = {
  /**
   * State to carry into the next event.
   */
  readonly state: ShiftState;
  /**
   * Whether this event completed a double-shift.
   */
  readonly doubleShift: boolean;
};

/**
 * Advance the double-shift detector by one key event.
 *
 * @param state - Current detector state
 *
 * @param event - Key event to fold in
 *
 * @returns Next state plus whether a double-shift fired on this event
 *
 * @example
 * ```ts
 * reduceShiftEvent({ state: INITIAL_SHIFT_STATE, event: { isShift: true, value: 0, now: 5 } });
 * ```
 */
export function reduceShiftEvent({
  state,
  event
}: {
  readonly state: ShiftState;
  readonly event: ShiftEvent;
}): ShiftResult {
  if (!event.isShift) {
    // A non-shift press while Shift is held invalidates the pending tap.
    if (state.shiftPressed && (event.value === VALUE_PRESS)) {
      return {
        state: {
          ...state,
          otherKeyDuring: true
        },
        doubleShift: false
      };
    }
    return {
      state,
      doubleShift: false
    };
  }
  if (event.value === VALUE_PRESS) {
    return {
      state: {
        ...state,
        shiftPressed: true,
        otherKeyDuring: false
      },
      doubleShift: false,
    };
  }
  if (event.value !== VALUE_RELEASE) {
    // Autorepeat or unknown value: no state change.
    return {
      state,
      doubleShift: false
    };
  }
  if ((!state.shiftPressed) || state.otherKeyDuring) {
    return {
      state: {
        ...state,
        shiftPressed: false
      },
      doubleShift: false
    };
  }
  /**
   * Time since the previous clean tap, only meaningful when one is pending.
   */
  const delta = event.now - state.lastTapTime;
  if ((state.lastTapTime > 0) && (delta < DOUBLE_TAP_MS)) {
    // Second tap in time: fire, and clear lastTapTime so a third tap does not
    // immediately re-fire.
    return {
      state: {
        ...state,
        shiftPressed: false,
        lastTapTime: 0
      },
      doubleShift: true,
    };
  }
  // First clean tap (or too slow): remember it as the start of a new window.
  return {
    state: {
      ...state,
      shiftPressed: false,
      lastTapTime: event.now
    },
    doubleShift: false,
  };
}
