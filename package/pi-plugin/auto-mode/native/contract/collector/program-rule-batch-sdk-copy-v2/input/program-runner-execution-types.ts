/**
 Original reached-group execution contracts preserve queue, judgment, and host ownership. @module
 */
import type { JudgmentPrograms } from './program-api.ts';
import type { ProgramPreparedMember } from './program-declaration-types.ts';
import type { NativeReturnCall } from './native-return-types.ts';
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
  judgment: Pick<JudgmentPrograms, 'invokeProgramNative' | 'reachedGroupFor' | 'prepareReachedMembers'>;
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
  runToolCall: (
    call: NativeReturnCall,
    options: unknown
  ) => unknown;
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
export type ProgramExecutionCallbacksInput = Omit<ProgramRunnerExecutionInput, 'dispatchPreparedBatch'> & Readonly<{
  parentId: string;
  assessment: ProgramAssessment;
}>;
