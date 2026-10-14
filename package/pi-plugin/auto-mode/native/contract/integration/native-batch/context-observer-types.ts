/**
 Native context traversal contracts retain original callback identity and source ownership.

 @module
 */

//region Original callback positions and receipt phases

/** Native context methods are traversed in this fixed order. */
export type NativeContextKind = 'context' | 'context_with_system';

/** Captured handler references are compared by identity and never called by this observer. */
export type NativeContextHandler = (...args: never[]) => unknown;

/** Original extension and copied handler-list pair from Pi's traversal snapshot. */
export type NativeContextSnapshot = readonly {
  readonly ext: object;
  readonly handlers: readonly NativeContextHandler[];
}[];

/** Complete callback data reaches the existing manager input pool. */
export type NativeContextInput = {
  readonly kind: NativeContextKind;
  readonly phase: 'input' | 'output' | 'after';
  readonly ordinal: number;
  readonly path: string;
  readonly value: unknown;
};

/** One original position retains its extension path before callback code can change it. */
export type NativeContextSlot = {
  readonly extension: object;
  readonly handler: NativeContextHandler;
  readonly path: string;
};

/** Mutable progress belongs only to one emitter invocation. */
export type NativeContextStage = {
  readonly kind: NativeContextKind;
  readonly slots: readonly NativeContextSlot[];
  next: number;
  active: { readonly slot: NativeContextSlot; readonly event: unknown } | undefined;
};

/** Terminal traversal receipt is attached to the original native run publication. */
export type NativeContextCompletion = {
  readonly kinds: readonly NativeContextKind[];
  readonly handlers: number;
};

//endregion Original callback positions and receipt phases
