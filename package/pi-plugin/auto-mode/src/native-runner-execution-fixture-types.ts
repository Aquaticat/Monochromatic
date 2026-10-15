/** Independent native group consumer contracts separate scheduling from dispatcher behavior. @module */
import type { EventCall, EventCallbacks, EventInput } from './native-runner-events-fixture-types.ts';

/** Original complete member admission contains exact prepared input identities. */
export type ExecutionMembers = readonly Readonly<{ id: string; name: string; input: Readonly<Record<string, unknown>> }>[];
/** Independently captured dispatcher callback shape follows the original native boundary. */
export type ExecutionDispatch = EventCallbacks & {
  calls: readonly EventCall[];
  tools: readonly Readonly<{ name: string; executionMode?: string }>[];
  assistantMessage: unknown;
  context: unknown;
  signal: AbortSignal;
  executionJudgment: object;
  executionMode: string;
  memberForExecution: (id: string) => object;
  runToolCall: (call: EventCall, options: unknown) => unknown;
  prepare: (hook: unknown) => unknown;
  after: (hook: unknown) => unknown;
  assertFresh: () => void;
  assess: (input: Readonly<{ members: ExecutionMembers }>) => { block: boolean };
};
/** Independent input includes only capabilities read by original execution. */
export type ExecutionInput = {
  runner: {
    queueTail: Promise<unknown>;
    host: EventInput['runner']['host'] & {
      isSequential: () => boolean;
      getContext: () => unknown;
      prepareOwnedToolCall: (hook: unknown, parent: string) => unknown;
      finishOwnedToolCall: (hook: unknown, parent: string) => unknown;
    };
  };
  origin: {
    prepared: { id: string };
    response: unknown;
    signal: AbortSignal;
    judgment: {
      reachedGroupFor: (group: object) => unknown;
      prepareReachedMembers: (input: { group: object; members: ExecutionMembers; nativeSignals: readonly AbortSignal[] }) => readonly object[];
      invokeProgramNative: (input: { group: object; slot: object; call: EventCall; options: unknown }) => unknown;
    };
  };
  group: { handle: object; members: readonly Readonly<{ signal: AbortSignal }>[] };
  bound: EventInput['bound'] & {
    scope: EventInput['bound']['scope'] & { holdsQueue: boolean };
    calls: readonly EventCall[];
    tools: readonly Readonly<{ name: string; executionMode?: string }>[];
    slots: readonly object[];
  };
  assertParentCurrent: () => void;
  dispatchPreparedBatch: (input: ExecutionDispatch) => unknown;
};
/** Built export retains the original asynchronous execution scope. */
export type ExecutionModule = { executeReachedProgramGroup: (input: ExecutionInput) => Promise<void> };
/** Fixture controls independently govern host scheduling, failure, and dispatch completion. */
export type ExecutionControl = {
  sequential: boolean;
  failure: unknown;
  failAt?: string;
  onStep?: (point: string) => void;
  dispatch?: (input: ExecutionDispatch) => unknown;
  handles: readonly object[];
};
/** Fixture observations retain original source arrays, callback results, and invocation inputs. */
export type ExecutionFixture = {
  input: ExecutionInput;
  control: ExecutionControl;
  steps: string[];
  observations: unknown[][];
  dispatched: ExecutionDispatch[];
  abort: AbortController;
  value: object;
  context: object;
  execute: () => Promise<void>;
  dispatch: () => ExecutionDispatch;
};
