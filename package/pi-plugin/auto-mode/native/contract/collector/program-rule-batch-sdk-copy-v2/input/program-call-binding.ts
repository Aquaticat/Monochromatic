/**
 Complete native call binding reserves original group slots before fixing their return consumer. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { createNativeReturnConsumer } from '../../../integration/native-batch/generated/native-return-consumer.mjs';
import { JudgmentConstructionError } from './judgment-error.ts';
import type { BindProgramCallsInput, ProgramContext } from './program-operation-types.ts';
import type { ProgramOwnership } from './program-ownership.ts';
import type { ProgramSlot } from './program-state-types.ts';

//region Slots publish as a complete original group before native invocation is possible.
/**
 Bind original native calls and retained return ownership to the reached group.

 @param input - original judgment capabilities

 @param state - original private slot map

 @param ownership - original group and slot readers

 @returns complete native call-binding operation

 @example createProgramCallBinding({ input, state, ownership });
 */
export function createProgramCallBinding({ input, state, ownership }: ProgramContext & Readonly<{ ownership: ProgramOwnership }>) {
  const { knownMember, operation } = input;
  const { slots } = state;
  const { currentGroup, knownSlot } = ownership;
  /**
   Compare complete native calls before publishing any pending slot.

   @param group - original opaque reached-group handle

   @param calls - complete original native call sequence

   @param tools - original callable definitions in declared order

   @param runNative - original fixed native runner

   @returns frozen original native slot handles
   */
  function bindProgramCalls({ group: handle, calls, tools, runNative }: BindProgramCallsInput): readonly object[] {
    const group = currentGroup(handle);
    if (group.state !== 'reached') throw new JudgmentConstructionError('Reached group native calls cannot be rebound');
    group.state = 'binding';
    try {
      const expected = nonNullishOrThrow(group.view).members;
      if ((!Array.isArray(calls)) || (calls.length !== expected.length) || (!Array.isArray(tools)) || (tools.length !== expected.length) || ((typeof runNative) !== 'function')) throw new JudgmentConstructionError('Native calls differ from complete reached group');
      const ids = new Set<string>();
      const pending: ProgramSlot[] = [];
      for (const [index, call] of calls.entries()) {
        const site = nonNullishOrThrow(expected[index]);
        const tool = tools[index];
        if ((!call) || (call.type !== 'toolCall') || ((typeof call.id) !== 'string') || (!call.id) || ids.has(call.id) || (call.name !== site.name) || (tool?.name !== site.name) || (JSON.stringify(call.arguments) !== site.argsJSON)) throw new JudgmentConstructionError('Native call binding differs from original reached member');
        ids.add(call.id);
        pending.push({ handle: Object.freeze({}), group, ordinal: index, call: Object.freeze({ id: call.id, name: call.name }), tool: Object.freeze({ name: nonNullishOrThrow(tool).name, outputSchema: tool?.outputSchema ? true : undefined }) });
      }
      currentGroup(handle);
      for (const slot of pending) slots.set(slot.handle, slot);
      group.slots = pending;
      /**
       Original native return lookup authenticates this exact reached group.

       @param slot - original opaque native slot

       @returns original slot record
       */
      function readOwnedSlot(slot: object): ProgramSlot {
        return knownSlot({ group, slot });
      }
      /**
       Native callbacks cross the enclosing judgment's original synchronous operation boundary.
       */
      function assertOriginalGroup(): void {
        operation(function checkCurrentGroup() { currentGroup(handle); });
      }
      /**
       Result consumption requires this group's original member to have returned.

       @param member - original prepared member handle supplied by the return consumer
       */
      function readReturnedMember(member: unknown): void {
        const record = knownMember(member);
        if ((record.group !== group) || (record.execution?.state !== 'returned')) throw new JudgmentConstructionError('Script binding producer is not the returned prepared member');
      }
      group.consumer = createNativeReturnConsumer({ runNative, getSlot: readOwnedSlot, assertCurrent: assertOriginalGroup, assertReturnedMember: readReturnedMember });
      group.state = 'bound';
      return Object.freeze(pending.map(function readSlotHandle(slot) { return slot.handle; }));
    } catch (error) {
      group.state = 'failed';
      group.failure = error;
      throw error;
    }
  }
  return bindProgramCalls;
}
//endregion
