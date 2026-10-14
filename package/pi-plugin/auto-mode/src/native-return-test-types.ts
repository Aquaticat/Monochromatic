/**
 Consumer-only fixture contracts keep generated runtime modules outside the source compilation graph.

 @module
 */

//region Tests describe observable operations rather than importing implementation declarations

/** Original native call metadata remains observable at invocation. */
type ReturnCall = {
  /** Native call identifier. */
  readonly id: string;
  /** Native tool name. */
  readonly name: string;
};

/** Fixture-owned slots retain original associations and opaque native storage. */
export type NativeReturnSlot = {
  /** Original invocation association. */
  readonly call: ReturnCall;
  /** Original conversion modality declaration. */
  readonly tool: { readonly name: string; readonly outputSchema?: unknown };
  /** Original prepared member. */
  readonly member: object;
  /** Consumer owns this opaque native execution record. */
  native?: unknown;
};

/** Fixed native callbacks supplied by the disposable fixture. */
export type NativeReturnOwner = {
  /** Native runner's external positional signature. */
  readonly runNative: (call: ReturnCall, options: unknown) => unknown;
  /** Original slot lookup. */
  readonly getSlot: (handle: object) => NativeReturnSlot;
  /** Current original lifetime check. */
  readonly assertCurrent: () => void;
  /** Independent prepared-member completion check. */
  readonly assertReturnedMember: (member: unknown) => void;
};

/** Generated operations exercised through their actual runtime artifact. */
export type NativeReturnConsumer = {
  /** Native result is deliberately unknown until the test inspects it. */
  readonly invoke: (input: { readonly slot: object; readonly call: ReturnCall; readonly options?: unknown }) => Promise<unknown>;
  /** Supported script value requires original return membership. */
  readonly valueFor: (input: { readonly slot: object; readonly outcome: unknown }) => string;
  /** Retained inspection contains no current-use assertion. */
  readonly inspect: (handle: object) => {
    /** Historical state category. */
    readonly state: string;
    /** Original conversion attempt count. */
    readonly conversionCount: number;
    /** Borrowed failure identity remains untyped. */
    readonly failure: unknown;
  };
};

//endregion Tests describe observable operations rather than importing implementation declarations
