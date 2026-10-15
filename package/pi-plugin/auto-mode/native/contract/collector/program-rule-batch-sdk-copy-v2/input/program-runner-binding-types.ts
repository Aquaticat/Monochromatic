/**
 Original runner binding associates declared members with native call, slot, and signal identities. @module
 */
import type { GroupCollectorInput } from './group-collector-types.ts';
import type { JudgmentPrograms } from './program-api.ts';
import type { ProgramNativeCall } from './program-operation-types.ts';
import type {
  NativeReturnOwner,
  NativeReturnTool
} from './native-return-types.ts';
import type { ProgramScope } from './program-scope.ts';

/**
 Original complete-group dispatch supplies member-specific cancellation without reconstructing it.
 */
export type ProgramRunnerGroup = Parameters<GroupCollectorInput['dispatchGroup']>[0];
/**
 Original tool metadata also selects the runner's native sequential scheduling branch.
 */
export type ProgramRunnerTool = NativeReturnTool & Readonly<{ executionMode?: string }>;
/**
 Binding borrows original runner scope membership and a captured native callback.
 */
export type ProgramBindingRunner<Recorder extends object> = Readonly<{
  scopes: Map<object | string, ProgramScope<Recorder>>;
  host: Readonly<{ runOwnedToolCall: NativeReturnOwner['runNative'] }>;
}>;
/**
 Original binding preserves parent identity and delegates admission to the same judgment owner.
 */
export type ProgramRunnerBindingInput<Recorder extends object> = Readonly<{
  runner: ProgramBindingRunner<Recorder>;
  tools: readonly ProgramRunnerTool[];
  origin: Readonly<{
    prepared: Readonly<{ id: string }>;
    judgment: Pick<JudgmentPrograms, 'bindProgramCalls'>;
  }>;
  carrier: Readonly<{ token: object }>;
  group: ProgramRunnerGroup;
  assertParentCurrent: () => unknown;
  NestedCallRecorder: new () => Recorder;
}>;
/**
 Native binding retains mutable original scope and per-member transport without cloning tools or slots.
 */
export type ProgramRunnerBinding<Recorder extends object> = Readonly<{
  scope: ProgramScope<Recorder>;
  calls: readonly ProgramNativeCall[];
  ordinals: ReadonlyMap<string, number>;
  tools: readonly ProgramRunnerTool[];
  slots: readonly object[];
  tickets: readonly PromiseWithResolvers<unknown>[];
}>;
