/** Declared program ownership retains original runtime and native runner capabilities. @module */
import type { JudgmentPrograms } from './program-api.ts';
import type { ProgramRunnerBinding, ProgramRunnerTool, ProgramRunnerGroup } from './program-runner-binding-types.ts';
import type { ProgramEventRecorder } from './program-runner-events-types.ts';
import type { ProgramExecutionOrigin } from './program-runner-execution-types.ts';
import type { ProgramRuntime, ProgramRuntimeInput } from './program-runtime-types.ts';

/** Original parent metadata supplies declaration equality and aggregate failure labels. */
export type ProgramFacadeOrigin = ProgramExecutionOrigin & Readonly<{
  prepared: Readonly<{ id: string; name: string; input: Readonly<{ code: string }> }>;
  judgment: JudgmentPrograms;
}>;
/** Binding retains exact original group and parent capabilities. */
export type ProgramFacadeBindingInput = Readonly<{
  tools: readonly ProgramRunnerTool[];
  origin: ProgramFacadeOrigin;
  carrier: Readonly<{ token: object }>;
  group: ProgramRunnerGroup;
  assertParentCurrent: () => unknown;
}>;
/** Original private execution wrapper preserves its asynchronous settlement boundary. */
export type ProgramFacadeExecutionInput = Pick<ProgramFacadeBindingInput, 'origin' | 'group' | 'assertParentCurrent'> & Readonly<{
  program: object;
  bound: ProgramRunnerBinding<ProgramEventRecorder>;
}>;
/** Existing guard constructor receives retained failures in their original collection order. */
export type ProgramFacadeGuardInput = Readonly<{
  errors: readonly unknown[];
  phase: 'validation';
  toolCallId: string;
  toolName: string;
}>;
/** Facade borrows original construction and private runner wrappers without replacing owners. */
export type ProgramFacadeInput = Omit<ProgramFacadeBindingInput, 'group'> & Readonly<{
  code: string;
  bindGroup: (input: ProgramFacadeBindingInput) => ProgramRunnerBinding<ProgramEventRecorder>;
  executeGroup: (input: ProgramFacadeExecutionInput) => Promise<void>;
  createReachedProgramRun: (input: ProgramRuntimeInput<string>) => ProgramRuntime<string>;
  NativeExecutionGuardError: new (input: ProgramFacadeGuardInput) => Error;
}>;
