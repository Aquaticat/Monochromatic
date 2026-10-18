/**
 Independent runner binding contracts describe observable native call and signal association. @module
 */
/**
 Original native calls retain their declared type, parent-derived identifier, and argument identity.
 */
export type RunnerBindingCall = Readonly<{
  type: 'toolCall';
  id: string;
  name: string;
  arguments: unknown
}>;
/**
 Native lookup retains the exact original definition or its absent lookup result.
 */
export type RunnerBindingTool = Readonly<{ name: string }>;
/**
 Caller-owned members retain mutable test observation hooks through their original declarations.
 */
export type RunnerBindingMember = Readonly<{
  handle: object;
  declaration: Readonly<{
    name: string;
    args: unknown
  }>;
  signal: AbortSignal;
}>;
/**
 Binding observes original scope state without importing production declarations.
 */
export type RunnerBindingScope = {
  recorder: object;
  nextId: number;
  holdsQueue: boolean;
  owner: object
};
/**
 Captured native function accepts opaque native options and preserves its return value.
 */
export type RunnerBindingNative = (
  call: RunnerBindingCall,
  options: unknown
) => unknown;
/**
 Judgment receives complete original calls and the native callback before any result tickets are exposed.
 */
export type RunnerBindingAdmission = Readonly<{
  group: object;
  calls: readonly RunnerBindingCall[];
  tools: readonly unknown[];
  
}>;
/**
 Exposed binding retains each independently owned association and transport.
 */
export type RunnerBindingResult = Readonly<{
  scope: RunnerBindingScope;
  calls: readonly RunnerBindingCall[];
  ordinals: ReadonlyMap<string, number>;
  tools: readonly RunnerBindingTool[];
  slots: readonly object[];
  tickets: readonly PromiseWithResolvers<unknown>[];
}>;
/**
 Independent runner state retains original function capture and scope publication.
 */
export type RunnerBindingInput = Readonly<{
  runner: Readonly<{
    scopes: Map<object | string, RunnerBindingScope>;
    host: { runOwnedToolCall: RunnerBindingNative };
  }>;
  tools: readonly RunnerBindingTool[];
  origin: Readonly<{
    prepared: Readonly<{ id: string }>;
    judgment: Readonly<{ bindProgramCalls: (input: RunnerBindingAdmission) => readonly object[] }>;
  }>;
  carrier: Readonly<{ token: object }>;
  group: Readonly<{
    handle: object;
    members: readonly RunnerBindingMember[]
  }>;
  assertParentCurrent: () => void;
  NestedCallRecorder: new () => object;
}>;
/**
 Fixture observations remain independent of production types and implementation diagnostics.
 */
export type RunnerBindingFixture = Readonly<{
  input: RunnerBindingInput;
  recorder: object;
  events: string[];
  admissions: RunnerBindingAdmission[];
  native: Readonly<{
    call: RunnerBindingCall;
    options: unknown
  }>[];
  slots: readonly object[];
  control: {
    failAt?: string;
    failure: unknown;
    value: unknown;
    onStep?: (point: string) => void
  };
  bind: () => RunnerBindingResult;
  admission: () => RunnerBindingAdmission;
}>;
/**
 Dynamic consumer contract does not import production binding declarations.
 */
export type RunnerBindingModule = Readonly<{ bindReachedProgramGroup: (input: RunnerBindingInput) => RunnerBindingResult }>;
