/**
 Original reached-group execution contracts preserve queue, judgment, and host ownership. @module
 */
import type { JudgmentPrograms } from './program-api.ts';
import type { ProgramPreparedMember } from './program-declaration-types.ts';
import type { NativeReturnCall } from './native-return-types.ts';
import type { ProgramRunnerTool } from './program-runner-binding-types.ts';

/** Original native phase inputs keep the same actual call and preparation throughout the lifecycle. */
export type ProgramNativePhaseRun = Readonly<{
  call: NativeReturnCall;
  prepared: unknown;
  execute: (...args: unknown[]) => unknown;
  onUpdate?: (partial: unknown) => unknown;
  after?: (hook: unknown) => unknown;
}>;
/** The qualified SDK owns both phase bodies and their signal. */
export type ProgramNativePhasePipeline = Readonly<{
  prepare: (input: Readonly<{ call: NativeReturnCall; before: (hook: unknown) => unknown }>) => Promise<unknown>;
  run: (input: ProgramNativePhaseRun) => unknown;
}>;
/** Each child call captures its own cancellation through the same SDK factory as root groups. */
export type ProgramNativePhaseFactory = (input: Readonly<{
  context: unknown; assistantMessage: unknown; signal: AbortSignal; tools: readonly ProgramRunnerTool[];
}>) => ProgramNativePhasePipeline;
import type {
  ProgramRunnerBinding,
  ProgramRunnerGroup
} from './program-runner-binding-types.ts';
import type {
  ProgramEventRecorder,
  ProgramRunnerEvents,
  ProgramRunnerEventsInput
} from './program-runner-events-types.ts';
import type { ProgramQueue } from './program-scope.ts';

/**
 Group execution borrows existing host methods without replacing their receiver.
 */
export type ProgramExecutionRunner = ProgramQueue & Readonly<{
  host: ProgramRunnerEventsInput['runner']['host'] & Readonly<{
    createOwnedToolPhases: ProgramNativePhaseFactory;
    isSequential: () => boolean;
    getContext: () => unknown;
    prepareOwnedToolCall: (
      hook: unknown,
      parentId: string
    ) => unknown;
    finishOwnedToolCall: (
      hook: unknown,
      parentId: string
    ) => unknown;
  }>;
}>;
/**
 Original judgment remains the owner of admission, currentness, and native invocation.
 */
export type ProgramExecutionOrigin = Readonly<{
  prepared: Readonly<{ id: string }>;
  judgment: Pick<JudgmentPrograms, 'reachedGroupFor' | 'prepareReachedMembers'>;
  signal: AbortSignal;
  response: unknown;
}>;
/**
 Assessment publication is private to the original group dispatch.
 */
export type ProgramAssessment = { handles?: readonly object[] };
/**
 Native callbacks retain their positional signatures and original callback return values.
 */
export type ProgramExecutionCallbacks = Readonly<{
  memberForExecution: (id: string) => object;
  nativePhases: ProgramNativePhasePipeline & Readonly<{
    retain: (input: Readonly<{ call: NativeReturnCall; outcome: unknown }>) => void;
    failed: (input: Readonly<{ call: NativeReturnCall; error: unknown }>) => void;
  }>;
  prepare: (hook: unknown) => unknown;
  after: (hook: unknown) => unknown;
  assertFresh: () => void;
  assess: (input: Readonly<{ members: readonly ProgramPreparedMember[] }>) => Readonly<{ block: false }>;
}>;
/**
 Complete dispatch preserves original arrays, context, and callbacks as one native input.
 */
export type ProgramExecutionDispatchInput = ProgramExecutionCallbacks & ProgramRunnerEvents & Readonly<{
  calls: ProgramRunnerBinding<ProgramEventRecorder>['calls'];
  tools: ProgramRunnerBinding<ProgramEventRecorder>['tools'];
  assistantMessage: unknown;
  context: unknown;
  signal: AbortSignal;
  executionJudgment: ProgramExecutionOrigin['judgment'];
  executionMode: 'sequential' | 'parallel';
}>;
/**
 Group execution owns queue acquisition while borrowing original binding and admission callbacks.
 */
export type ProgramRunnerExecutionInput = Readonly<{
  runner: ProgramExecutionRunner;
  origin: ProgramExecutionOrigin;
  group: ProgramRunnerGroup;
  bound: ProgramRunnerBinding<ProgramEventRecorder>;
  assertParentCurrent: () => unknown;
  dispatchPreparedBatch: (input: ProgramExecutionDispatchInput) => unknown;
}>;
/**
 Callback creation retains assessment state allocated before original queue acquisition.
 */
export type ProgramExecutionCallbacksInput = Pick<ProgramRunnerExecutionInput, 'runner' | 'group' | 'assertParentCurrent'> & Readonly<{
  judgment: ProgramExecutionOrigin['judgment'];
  bound: Pick<ProgramRunnerBinding<ProgramEventRecorder>, 'ordinals' | 'slots' | 'tools'>;
  context: unknown;
  response: unknown;
  signal: AbortSignal;
  parentId: string;
  assessment: ProgramAssessment;
}>;
