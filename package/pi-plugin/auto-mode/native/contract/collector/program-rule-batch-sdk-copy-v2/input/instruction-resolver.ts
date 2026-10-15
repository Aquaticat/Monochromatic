/**
 Original instruction resolution authenticates retained dependencies on every read. @module
 */
import { JudgmentConstructionError } from './judgment-error.ts';
import { retainedInstructionRules } from './instruction-ownership.ts';
import type {
  InstructionContext,
  InstructionRecord,
  InstructionMember
} from './instruction-types.ts';
import type { OriginalMembershipRead } from './membership-read.ts';
import type { InstructionBindingLookup } from './instruction-api.ts';

//region Retained instruction records require the same original request, member, and source units.
/**
 Bind dependency resolution to the private original judgment owner.

 @param input - original member and request capabilities

 @param state - private original instruction records

 @returns original dependency resolver
 
 @example createInstructionResolver({ input, state });
 */
export function createInstructionResolver({
  input,
  state
}: InstructionContext) : (bindingHandle: unknown) => InstructionBindingLookup {
  /**
   Original judgment capabilities remain borrowed without reading lazy request or source content.
   */
  const {
    ready,
    bindings,
    receipt
  } = input;
  /**
   Revalidate each original dependency before exposing its retained question binding.

   @param bindingHandle - original opaque member or instruction handle

   @returns retained original binding

   @throws JudgmentConstructionError for foreign or changed ownership
   */
  function resolveBinding(bindingHandle: unknown): InstructionBindingLookup {
    ready();
    /**
     Native query capability retains primitive lookup after original readiness checks.
     */
    const instructionBindings: OriginalMembershipRead<InstructionRecord> = state.instructionBindings;
    /**
     Private original record selects the exact dependencies that must remain current.
     */
    const instruction = instructionBindings.get(bindingHandle);
    if (instruction) {
      if (instruction.kind === 'unit-adoption') {
        if ((!bindings.has(instruction.member)) || (retainedInstructionRules(state)
          .read(instruction.adopter)
          !== instruction.adopterProjection)
          || (retainedInstructionRules(state)
            .read(instruction.target)
            !== instruction.targetProjection)) throw new JudgmentConstructionError('Unit adoption lost its original member or source units');
        return instruction.binding;
      }
      if (instruction.kind === 'whole-request-material') {
        if (instruction.request !== receipt.request) throw new JudgmentConstructionError('Whole-request material lost its original request occurrence');
        return instruction.binding;
      }
      if (((instruction.member !== undefined) && (!bindings.has(instruction.member))) || (retainedInstructionRules(state)
        .read(instruction.rule)
        !== instruction.projection)) throw new JudgmentConstructionError('Instruction claim lost its original member or source clause');
      return instruction.binding;
    }
    /**
     Foreign instruction handles may resolve only through original prepared-member ownership.
     */
    const memberBindings: OriginalMembershipRead<InstructionMember> = bindings;
    /**
     Original fallback reads the same shared map even for foreign primitive queries.
     */
    const value = memberBindings.get(bindingHandle);
    if (!value) throw new JudgmentConstructionError('Prepared member binding is not owned by this judgment');
    return value.binding;
  }
  return resolveBinding;
}
//endregion
