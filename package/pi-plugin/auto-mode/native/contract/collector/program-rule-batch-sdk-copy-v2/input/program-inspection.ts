/**
 Retained program inspection reports original state without granting present-day execution eligibility. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { NativeReturnInspection } from './native-return-types.ts';
import type { ProgramContext } from './program-operation-types.ts';
import type { ProgramOwnership } from './program-ownership.ts';
import type {
  ProgramGroup,
  ProgramMemberExecution,
  ProgramScope
} from './program-state-types.ts';
import type { NativeScriptValueGuardError } from './script-value-guard.ts';
import type { ProgramInspection } from './program-api.ts';

/**
 Group diagnostics retain terminal states and original native return evidence.
 */
export type ReachedGroupInspection = Readonly<{
  retainedOnly: true;
  ordinal: number;
  state: ProgramGroup['state'];
  failure: unknown;
  members: readonly Readonly<{
    id: string;
    state: ProgramMemberExecution['state'] | 'unentered'
  }>[];
  nativeReturns: readonly NativeReturnInspection[];
}>;

/**
 Program diagnostics retain original declaration and guard history after retirement.
 */
export type OriginalProgramInspection = Readonly<{
  retainedOnly: true;
  status: ProgramScope['status'];
  failure: unknown;
  declaration: ProgramScope['declaration'];
  producerValueReady: boolean;
  guardFailures: readonly NativeScriptValueGuardError[];
  groups: readonly ReachedGroupInspection[];
}>;

//region Historical evidence remains readable after current source and parent dependencies retire.
/**
 Bind original retained inspection to private custody without live-use checks.

 @param input - original prepared-member records

 @param ownership - retained original program and group readers

 @returns immutable original diagnostic views

 @example createProgramInspection({ input, ownership });
 */
export function createProgramInspection({
  input,
  ownership
}: Pick<ProgramContext, 'input'> & Readonly<{ ownership: ProgramOwnership }>): ProgramInspection {
  const { bindings } = input;
  const {
    knownGroup,
    knownProgram
  } = ownership;
  /**
   Retain original member execution and native conversion state without asserting eligibility.

   @param handle - original opaque reached-group handle

   @returns frozen retained group evidence
   */
  function inspectReachedGroup(handle: object): ReachedGroupInspection {
    const group = knownGroup(handle);
    return Object.freeze({
      retainedOnly: true,
      ordinal: group.definition
        .ordinal,
      state: group.state,
      failure: group.failure,
      members: Object.freeze((group.members ?? []).map(function inspectMemberExecution(member) {
        const record = nonNullishOrThrow(bindings.get(member));
        return Object.freeze({
          id: record.prepared.id,
          state: record.execution?.state ?? 'unentered'
        });
      })),
      nativeReturns: Object.freeze(group.slots
        .map(function inspectConsumedSlot(slot) { return nonNullishOrThrow(group.consumer).inspect(slot.handle); }))
    });
  }
  /**
   Preserve original scope state and guard order after any terminal failure.

   @param program - original opaque program handle

   @returns frozen retained program evidence
   */
  function inspectProgram(program: object): OriginalProgramInspection {
    const scope = nonNullishOrThrow(knownProgram(program)
      .program);
    return Object.freeze({
      retainedOnly: true,
      status: scope.status,
      failure: scope.failure,
      declaration: scope.declaration,
      producerValueReady: scope.valueReceipt !== undefined,
      guardFailures: Object.freeze([...scope.guardFailures]),
      groups: Object.freeze(scope.groups
        .map(function inspectOwnedGroup(group) { return inspectReachedGroup(group.handle); }))
    });
  }
  return {
    inspectReachedGroup,
    inspectProgram
  };
}
//endregion
