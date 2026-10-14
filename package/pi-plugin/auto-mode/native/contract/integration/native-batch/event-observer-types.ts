/**
 Original extension event traversal retains callback identity and source ownership.

 @module
 */

//region Original event positions and immutable domain observations

/** Native callbacks are compared by identity and invoked only by Pi. */
export type NativeEventHandler = (...args: never[]) => unknown;

/** Native snapshot preserves extension order and copied callback lists. */
export type NativeEventSnapshot = readonly {
  readonly ext: object;
  readonly handlers: readonly NativeEventHandler[];
}[];

/** Complete callback values enter the existing manager input pool. */
export type NativeEventInput = {
  readonly kind: string;
  readonly phase: 'input' | 'output' | 'after';
  readonly ordinal: number;
  readonly path: string;
  readonly value: unknown;
};

/** One manager-owned emission groups complete callback values under one source allowance. */
export type NativeEventCapture = {
  readonly capture: (input: NativeEventInput) => void;
  readonly complete: () => void;
};

/** One copied position retains the original extension and callback. */
export type NativeEventSlot = {
  readonly extension: object;
  readonly handler: NativeEventHandler;
  readonly path: string;
};

/** One original emission retains progress across Pi's existing await sites. */
export type NativeEventTraversal = {
  readonly before: (input: {
    readonly extension: object;
    readonly handler: NativeEventHandler;
    readonly event: unknown;
  }) => void;
  readonly returned: (value: unknown) => void;
  readonly failed: (error: unknown) => void;
  readonly end: () => void;
  readonly stopped: () => void;
  readonly aborted: (error: unknown) => void;
};

/** Original runner publication keeps pending and failed capture explicit. */
export type NativeEventObservation = {
  readonly occurrence: object;
  readonly revision: number;
  readonly pending: number;
  readonly failed: boolean;
  readonly registeredKinds: readonly string[];
};

/** Original runner owns construction, traversal, and its current publication. */
export type NativeEventObserver = {
  readonly begin: (input: {
    readonly kind: string;
    readonly snapshot: NativeEventSnapshot;
  }) => NativeEventTraversal;
  readonly read: (registeredKinds: readonly string[]) => NativeEventObservation;
};

//endregion Original event positions and immutable domain observations
