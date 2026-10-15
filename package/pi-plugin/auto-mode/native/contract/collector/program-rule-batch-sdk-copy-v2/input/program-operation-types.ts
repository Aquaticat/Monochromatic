/**
 Original program operations separate caller inputs from retained owner state. @module
 */
import type {
  NativeReturnCall,
  NativeReturnOwner,
  NativeReturnTool
} from './native-return-types.ts';
import type { ProgramPreparedMember } from './program-declaration-types.ts';
import type {
  JudgmentProgramsInput,
  ProgramOwnerState
} from './program-state-types.ts';

/**
 Helpers borrow the same original capabilities and private custody maps.
 */
export type ProgramContext = Readonly<{
  input: JudgmentProgramsInput;
  state: ProgramOwnerState;
}>;

/**
 Prepared source admission precedes native parent entry and policy review.
 */
export type BindPreparedProgramInput = Readonly<{
  member: object;
  declaration: unknown;
  assertCurrent: () => void;
}>;

/**
 Native call binding compares original identity, name, and serialized arguments.
 */
export type ProgramNativeCall = NativeReturnCall & Readonly<{
  type: 'toolCall';
  arguments: unknown;
}>;

/**
 Complete native call groups retain one fixed native runner.
 */
export type BindProgramCallsInput = Readonly<{
  group: object;
  calls: readonly ProgramNativeCall[];
  tools: readonly NativeReturnTool[];
  runNative: NativeReturnOwner['runNative'];
}>;

/**
 Final prepared members and cancellation signals follow original declared order.
 */
export type PrepareReachedMembersInput = Readonly<{
  group: object;
  members: readonly ProgramPreparedMember[];
  nativeSignals: readonly AbortSignal[];
}>;
