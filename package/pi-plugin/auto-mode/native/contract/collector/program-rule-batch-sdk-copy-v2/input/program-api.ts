/**
 Public original program operations preserve prepared inspection, live execution, and retained diagnostics. @module
 */
import type { NativeReturnInput, NativeReturnOutcome } from './native-return-types.ts';
import type { PreparedProgramView } from './program-declaration-types.ts';
import type { BindPreparedProgramInput, BindProgramCallsInput, PrepareReachedMembersInput } from './program-operation-types.ts';
import type { OriginalProgramInspection, ReachedGroupInspection } from './program-inspection.ts';
import type { ProgramGroup, ProgramScope } from './program-state-types.ts';
import type { NativeScriptValueGuardError } from './script-value-guard.ts';

/* oxlint-disable no-restricted-syntax/no-nullish-union -- Mirrors the original native judgment preparedProgramFor API: unbound inspection returns undefined before program entry; native/README.md documents why a sentinel would change its consumer contract. */
/**
 Original prepared inspection lookup returns undefined until the native source inspection is bound.
 */
export type PreparedProgramLookup = PreparedProgramView | undefined;
/* oxlint-enable no-restricted-syntax/no-nullish-union */

/**
 Original prepared inspection and once-only opening operations.
 */
export type ProgramOpening = Readonly<{
  bindPreparedProgram: (input: BindPreparedProgramInput) => PreparedProgramView;
  preparedProgramFor: (member: object) => PreparedProgramLookup;
  openProgram: (input: Readonly<{ parentToken: object; toolNames: readonly string[] }>) => object;
  programFor: (program: object) => ProgramScope['view'];
}>;

/**
 Original source-group materialization exposes only its already published view.
 */
export type ProgramReaching = Readonly<{
  reachProgramGroup: (input: Readonly<{ program: object; ordinal: number }>) => ProgramGroup['view'];
  reachedGroupFor: (group: object) => ProgramGroup['view'];
}>;

/**
 Native invocation and guarded value access remain separate operations.
 */
export type ProgramValueAccess = Readonly<{
  invokeProgramNative: (input: NativeReturnInput & Readonly<{ group: object }>) => Promise<NativeReturnOutcome>;
  scriptValueFor: (input: Readonly<{ group: object; slot: object; outcome: unknown }>) => string;
  markProgramGuard: (input: Readonly<{ program: object; error: unknown }>) => NativeScriptValueGuardError;
}>;

/**
 Retained diagnostics remain readable without testing live execution eligibility.
 */
export type ProgramInspection = Readonly<{
  inspectReachedGroup: (handle: object) => ReachedGroupInspection;
  inspectProgram: (program: object) => OriginalProgramInspection;
}>;

/**
 Original judgment exposes one frozen surface for program ownership and native group publication.
 */
export type JudgmentPrograms = ProgramOpening & ProgramReaching & ProgramValueAccess & ProgramInspection & Readonly<{
  bindProgramCalls: (input: BindProgramCallsInput) => readonly object[];
  prepareReachedMembers: (input: PrepareReachedMembersInput) => readonly object[];
}>;
