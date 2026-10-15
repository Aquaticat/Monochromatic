/**
 Original dispatcher scheduling borrows tool capabilities before member work starts. @module
 */
import type { ProgramNativeCall } from './program-operation-types.ts';
import type { ProgramRunnerTool } from './program-runner-binding-types.ts';

/**
 Scheduling checks capability presence without invoking the tool context factory.
 */
export type PreparedScheduleTool = ProgramRunnerTool & Readonly<{ createExecutionContext?: unknown }>;

/**
 Native call admission keeps the original dispatcher constructor and judgment property observations.
 */
export type PreparedScheduleInput = Readonly<{
  calls: readonly ProgramNativeCall[];
  tools: readonly PreparedScheduleTool[];
  executionJudgment: Readonly<Record<string, unknown>> | null | undefined;
  executionMode?: string;
  PreparedBatchContractError: new (message: string) => Error;
}>;

/**
 Original snapshots are shallowly frozen after independent per-call structured cloning.
 */
export type PreparedSchedule = Readonly<{
  scheduled: readonly ProgramNativeCall[];
  serial: boolean;
}>;
