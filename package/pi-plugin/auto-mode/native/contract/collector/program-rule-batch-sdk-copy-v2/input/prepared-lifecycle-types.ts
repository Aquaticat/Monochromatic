/**
 Original native member execution borrows callbacks and queue ownership. @module
 */
import type { PreparedExecutableTool } from './prepared-executable-types.ts';
import type { ProgramNativeCall } from './program-operation-types.ts';

/**
 Preparation can publish entry and release its turn before native execution completes.
 */
export type PreparedLifecycleMember = {
  entered: boolean;
  preparationReleased: boolean;
};

/**
 Original preparation retains shared group state in the dispatcher closure.
 */
export type PreparedLifecyclePreparation = Readonly<{
  hook: Readonly<{ args: unknown }>;
  call: ProgramNativeCall;
  memberState: PreparedLifecycleMember;
  releasePreparation: () => void;
}>;

/**
 Optional native notifications retain original absence and callback return values.
 */
type LifecycleNotifications = Readonly<{
  onStart?: (call: ProgramNativeCall) => unknown;
  onFinish?: (result: unknown) => unknown;
  onUpdate?: (
    partial: unknown,
    call: ProgramNativeCall
  ) => unknown;
}>;

/**
 Native SDK options preserve opaque context and original synchronous hook forwarding.
 */
export type PreparedLifecycleOptions = Readonly<{
  tools: readonly PreparedExecutableTool[];
  assistantMessage: unknown;
  context: unknown;
  signal: unknown;
  afterToolCall: unknown;
  onUpdate: Readonly<{ callback?: (partial: unknown) => unknown }>['callback'];
  beforeToolCall: (hook: Readonly<{ args: unknown }>) => unknown;
}>;

/**
 Member lifecycle retains original ordinal lookup, failure storage, and disposal callbacks.
 */
export type PreparedLifecycleInput = Readonly<{
  call: ProgramNativeCall;
  ordinalByID: ReadonlyMap<string, number>;
  waitForPreparation: (ordinal: number) => unknown;
  releaseNextPreparation: (ordinal: number) => unknown;
  releaseNextExecution: (ordinal: number) => unknown;
  onStart: LifecycleNotifications['onStart'];
  onFinish: LifecycleNotifications['onFinish'];
  onUpdate: LifecycleNotifications['onUpdate'];
  runToolCall: (
    call: ProgramNativeCall,
    options: PreparedLifecycleOptions
  ) => unknown;
  executableTools: readonly PreparedExecutableTool[];
  assistantMessage: unknown;
  context: unknown;
  signal: unknown;
  after: unknown;
  prepareNativeMember: (input: PreparedLifecyclePreparation) => unknown;
  failures: unknown[];
  block: (reason: string) => unknown;
  PreparedBatchContractError: new (message: string) => Error;
}>;
