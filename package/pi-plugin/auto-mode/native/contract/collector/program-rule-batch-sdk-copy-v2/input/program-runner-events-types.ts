/**
 Original runner event callbacks retain native result and recorder identities. @module
 */
import type { ProgramNativeCall } from './program-operation-types.ts';

/**
 Original native content retains opaque text values until JavaScript join coercion.
 */
export type ProgramEventResult = Readonly<{
  content?: readonly Readonly<{
    type: string;
    text?: unknown
  }>[];
  usage?: unknown;
}>;
/**
 Original completed call is published unchanged after its end event has finished.
 */
export type ProgramEventOutcome = Readonly<{
  toolCall: ProgramNativeCall;
  result: ProgramEventResult;
  isError: boolean;
}>;
/**
 Native event payloads preserve the host's existing start, update, and end contracts.
 */
export type ProgramRunnerEvent = Readonly<{
  type: 'tool_execution_start' | 'tool_execution_update' | 'tool_execution_end';
  toolCallId: string;
  toolName: string;
  parentToolCallId: string;
  args?: unknown;
  partialResult?: unknown;
  result?: ProgramEventResult;
  isError?: boolean;
}>;
/**
 Recorder callbacks accept absent starts and original opaque usage without reconstruction.
 */
export type ProgramEventRecorder = Readonly<{
  start: (call: ProgramNativeCall) => unknown;
  finish: (
    record: unknown,
    isError: boolean,
    text: string
  ) => unknown;
  addUsage: (usage: unknown) => unknown;
}>;
/**
 Event creation borrows the already allocated record map and original group transport.
 */
export type ProgramRunnerEventsInput = Readonly<{
  runner: Readonly<{ host: Readonly<{ emit: (event: ProgramRunnerEvent) => unknown }> }>;
  bound: Readonly<{
    scope: Readonly<{ recorder: ProgramEventRecorder }>;
    ordinals: ReadonlyMap<string, number>;
    tickets: readonly Readonly<{ resolve: (outcome: unknown) => unknown }>[];
  }>;
  parentId: string;
  records: Map<string, unknown>;
}>;
/**
 Native dispatcher callbacks retain its externally dictated positional update signature.
 */
export type ProgramRunnerEvents = Readonly<{
  onStart: (call: ProgramNativeCall) => Promise<void>;
  onUpdate: (
    partialResult: unknown,
    call: ProgramNativeCall
  ) => Promise<void>;
  onFinish: (outcome: ProgramEventOutcome) => Promise<void>;
}>;
