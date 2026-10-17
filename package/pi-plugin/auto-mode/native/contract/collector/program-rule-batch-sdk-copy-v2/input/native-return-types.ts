/**
 Original native invocation state stays on the slot owned by its enclosing judgment.

 @module
 */

//region Native results retain original calls and conversion outcomes

/**
 Original native call metadata identifies one invocation within its complete group.
 */
export type NativeReturnCall = {
  /**
   Original call identifier distinguishes repeated tools.
   */
  readonly id: string;
  /**
   Native tool name must match the owned slot.
   */
  readonly name: string;
};

/**
 Tool conversion needs only the original name and structured-output declaration.
 */
export type NativeReturnTool = {
  /**
   Original tool name supplies native failure diagnostics.
   */
  readonly name: string;
  /**
   Presence selects the original native structured-result conversion branch.
   */
  readonly outputSchema?: unknown;
};

/**
 Captured conversion distinguishes unsupported values from ordinary tool failures.
 */
export type NativeReturnConversion = {
  /**
   Strings are the supported result-binding profile.
   */
  readonly status: 'string';
  /**
   Original converted text is retained once.
   */
  readonly value: string;
  /**
   UTF-8 size controls the existing result bound.
   */
  readonly bytes: number;
} | {
  /**
   Other native output modalities remain inspectable but cannot bind this profile.
   */
  readonly status: 'unsupported';
  /**
   Native value category names the unsupported modality.
   */
  readonly kind: string;
} | {
  /**
   Native conversion failures remain ordinary tool errors.
   */
  readonly status: 'threw';
  /**
   Original caught value survives unchanged.
   */
  readonly error: unknown;
  /**
   Capture-time text does not replace the caught value.
   */
  readonly messageAtCapture: string;
};

/**
 Original native outcome is validated before any result conversion.
 */
export type NativeReturnOutcome = {
  /**
   Native runner must return the exact requested call identity values.
   */
  readonly toolCall: NativeReturnCall;
  /**
   Native conversion decides how ordinary tool failures are exposed.
   */
  readonly isError: boolean;
  /**
   Result body remains owned by the native runner.
   */
  readonly result: object;
};

/**
 Mutable execution record belongs exclusively to the original slot.
 */
export type NativeReturnInvocation = {
  /**
   Each reservation receives a distinct original identity.
   */
  readonly identity: object;
  /**
   Terminal state remains readable after parent retirement.
   */
  state: 'running' | 'threw' | 'invalid-return' | 'returned';
  /**
   Snapshot prevents later caller edits from rebinding native return identity.
   */
  readonly call: NativeReturnCall;
  /**
   Snapshot preserves native conversion selection.
   */
  readonly tool: NativeReturnTool;
  /**
   Converted value or captured native conversion failure is stored once.
   */
  conversion?: NativeReturnConversion;
  /**
   Count exposes duplicate conversion attempts to retained inspection.
   */
  conversionCount: number;
  /**
   Exact native outcome is retained without cloning.
   */
  outcome?: NativeReturnOutcome;
  /**
   Thrown values remain unchanged, including nullish values.
   */
  failure?: unknown;
};

/**
 Judgment-owned slot supplies call, tool, and prepared-member associations.
 */
export type NativeReturnSlot = {
  /**
   Original group call cannot be substituted at invocation.
   */
  readonly call: NativeReturnCall;
  /**
   Original tool controls native conversion behavior.
   */
  readonly tool: NativeReturnTool;
  /**
   Owner validates this association when the script requests a supported value.
   */
  readonly member?: unknown;
  /**
   Reservation prevents a second native invocation through the same slot.
   */
  native?: NativeReturnInvocation;
};

/**
 Fixed owner callbacks keep retained inspection separate from live value use.
 */
export type NativeReturnOwner = {
  
  /**
   Original slot reader remains available after native completion and retirement.
   */
  readonly getSlot: (handle: object) => NativeReturnSlot;
  /**
   Live use requires the original parent and dependencies to remain current.
   */
  readonly assertCurrent: () => void;
  /**
   Prepared-member owner independently verifies native execution completion.
   */
  readonly assertReturnedMember: (member: unknown) => void;
};

//endregion Native results retain original calls and conversion outcomes

//region Consumer operations expose retained evidence and guarded value access

/**
 One native invocation keeps the original call and options objects.
 */
export type NativeReturnInput = {
  /**
   Original owner-issued slot handle.
   */
  readonly slot: object;
  /**
   Original native call object is passed unchanged to the runner.
   */
  readonly call: NativeReturnCall;
  
};

/**
 Retained inspection never asserts present-day eligibility.
 */
export type NativeReturnInspection = {
  /**
   Explicitly limits this view to historical evidence.
   */
  readonly retainedOnly: true;
  /**
   Uninvoked slots have no native terminal state.
   */
  readonly state: NativeReturnInvocation['state'] | 'uninvoked';
  /**
   Absent invocations retain the original undefined-valued diagnostic field.
   */
  readonly identity: unknown;
  /**
   Conversion count remains available before and after invocation.
   */
  readonly conversionCount: number;
  /**
   Captured conversion remains inspectable without granting live access.
   */
  readonly conversion: unknown;
  /**
   Original caught value remains inspectable without normalization.
   */
  readonly failure: unknown;
};

/**
 Original reached-group consumer separates execution, live access, and inspection.
 */
export type NativeReturnConsumer = {
  /** Reserve an actual native call before asynchronous preparation starts. */
  readonly open: (input: NativeReturnInput) => NativeReturnEntry;
  
  /**
   Read supported text only through current original ownership.
   */
  readonly valueFor: (input: {
    readonly slot: object;
    readonly outcome: unknown
  }) => string;
  /**
   Read historical invocation state without testing live eligibility.
   */
  readonly inspect: (handle: object) => NativeReturnInspection;
};

/** Native phases retain completion through the original slot without consulting live parent eligibility. */
export type NativeReturnEntry = Readonly<{
  complete: (outcome: unknown) => NativeReturnOutcome;
  fail: (error: unknown) => void;
}>;

/** Factory-owned slots expose their native lifetime instead of requiring an invocation-handle round trip. */
export type NativeCallSlot = Readonly<{
  open: (call: NativeReturnCall) => NativeReturnEntry;
}>;

//endregion Consumer operations expose retained evidence and guarded value access
