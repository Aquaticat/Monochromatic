/**
 Original native invocation and script-value access retain distinct failure boundaries. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import {
  NativeScriptValueGuardError,
  scriptValueGuard
} from './script-value-guard.ts';
import type {
  NativeReturnInput,
  NativeReturnOutcome
} from './native-return-types.ts';
import type { ProgramContext } from './program-operation-types.ts';
import type { ProgramOwnership } from './program-ownership.ts';
import type { ProgramGroup } from './program-state-types.ts';
import type { ProgramValueAccess } from './program-api.ts';

//region Native completion remains possible after retirement while live result use stays guarded.
/**
 Bind original result consumption and sticky guard capture to the same judgment operation boundary.

 @param input - original judgment operation capability

 @param ownership - original retained and current custody readers

 @returns original invocation, script-value, and guard operations

 @example createProgramValueAccess({ input, ownership });
 */
export function createProgramValueAccess({
  input,
  ownership
}: Pick<ProgramContext, 'input'> & Readonly<{ ownership: ProgramOwnership }>): ProgramValueAccess {
  const { operation } = input;
  const {
    knownGroup,
    knownProgram,
    currentGroup,
    knownSlot
  } = ownership;
  /**
   Native callbacks may prepare the group while its original invocation remains in flight.

   @param group - original opaque group handle

   @param slot - original opaque slot handle

   @param call - original native call forwarded unchanged

   @param options - original native options forwarded unchanged

   @returns exact original native outcome
   */
  async function invokeProgramNative({
    group: handle,
    slot,
    call,
    options
  }: NativeReturnInput & Readonly<{ group: object }>): Promise<NativeReturnOutcome> {
    const group = knownGroup(handle);
    if (!group.consumer) throw new JudgmentConstructionError('Reached group has no fixed native consumer');
    return await group.consumer
      .invoke({ slot, call, options });
  }
  /**
   Retain the first failure and every distinct original guard occurrence.

   @param program - original opaque program handle

   @param error - original caught value

   @returns original or newly associated result-binding guard
   */
  function markProgramGuard({
    program,
    error
  }: Readonly<{
    program: object;
    error: unknown
  }>): NativeScriptValueGuardError {
    const scope = nonNullishOrThrow(knownProgram(program)
      .program);
    const guard = scriptValueGuard({ error });
    if (!scope.seenGuards
      .has(guard)) {
      scope.seenGuards
        .add(guard);
      scope.guardFailures
        .push(guard);
    }
    scope.guardFailure ??= guard;
    return guard;
  }
  /**
   Missing or foreign return custody becomes a result-binding guard before value consumption.

   @param handle - original opaque reached-group handle

   @returns group with its original fixed return consumer
   */
  function requireReturnConsumer(handle: object): ProgramGroup {
    try {
      const group = knownGroup(handle);
      if (!group.consumer) throw new JudgmentConstructionError('Reached group has no fixed native consumer');
      return group;
    } catch (error) { throw scriptValueGuard({ error }); }
  }
  /**
   Preserve ordinary native failures while retaining code-owned value guards on the program.

   @param group - original reached group

   @param slotHandle - original native slot

   @param outcome - exact original native outcome

   @returns original supported script text
   */
  function consumeScriptValue({
    group,
    slotHandle,
    outcome
  }: Readonly<{
    group: ProgramGroup;
    slotHandle: object;
    outcome: unknown
  }>): string {
    try { return nonNullishOrThrow(group.consumer)
      .valueFor({ slot: slotHandle, outcome }); }
    catch (error) {
      if (error instanceof NativeScriptValueGuardError) throw operation(function markInvocationFailure() { return markProgramGuard({
        program: group.program,
        error
      }); });
      throw error;
    }
  }
  /**
   Publish a producer receipt only after original conversion and current ownership succeed.

   @param group - original opaque group handle

   @param slot - original opaque native slot handle

   @param outcome - exact original native outcome

   @returns original supported script value
   */
  function scriptValueFor({
    group: handle,
    slot: slotHandle,
    outcome
  }: Readonly<{
    group: object;
    slot: object;
    outcome: unknown
  }>): string {
    const group = requireReturnConsumer(handle);
    const value = consumeScriptValue({
      group,
      slotHandle,
      outcome
    });
    try {
      return operation(function readGuardedScriptValue() {
        currentGroup(handle);
        const slot = knownSlot({
          group,
          slot: slotHandle
        });
        const scope = nonNullishOrThrow(knownProgram(group.program)
          .program);
        if (group.definition
          .ordinal
          === 0) {
          if (scope.valueReceipt && ((scope.valueReceipt
            .slot
            !== slotHandle) || (scope.valueReceipt
            .native
            !== nonNullishOrThrow(slot.native)
            .identity))) throw new JudgmentConstructionError('Producer script-value receipt cannot be replaced');
          scope.valueReceipt ??= Object.freeze({
            slot: slotHandle,
            member: nonNullishOrThrow(slot.member),
            native: nonNullishOrThrow(slot.native).identity,
            value
          });
        }
        return value;
      });
    } catch (error) { throw operation(function markConversionFailure() { return markProgramGuard({
      program: group.program,
      error
    }); }); }
  }
  return {
    invokeProgramNative,
    scriptValueFor,
    markProgramGuard
  };
}
//endregion
