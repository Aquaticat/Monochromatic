/**
 Original instruction resolution authenticates retained dependencies on every read. @module
 */
import { JudgmentConstructionError } from './judgment-error.ts';
import { retainedInstructionRules } from './instruction-ownership.ts';
import type { InstructionContext } from './instruction-types.ts';
import type { QuestionBinding } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner-types.ts';

//region Retained instruction records require the same original request, member, and source units.
/**
 Bind dependency resolution to the private original judgment owner.

 @param input - original member and request capabilities

 @param state - private original instruction records

 @returns original dependency resolver
 */
export function createInstructionResolver({
  input,
  state
}: InstructionContext) : (bindingHandle: object) => QuestionBinding {
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
  function resolveBinding(bindingHandle: object): QuestionBinding {
    ready();
    const instruction = state.instructionBindings
      .get(bindingHandle);
    if (instruction) {
      if (instruction.kind === 'unit-adoption') {
        if ((!bindings.has(instruction.member)) || (retainedInstructionRules(state).read(instruction.adopter) !== instruction.adopterProjection)
          || (retainedInstructionRules(state).read(instruction.target) !== instruction.targetProjection)) throw new JudgmentConstructionError('Unit adoption lost its original member or source units');
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
    const value = bindings.get(bindingHandle);
    if (!value) throw new JudgmentConstructionError('Prepared member binding is not owned by this judgment');
    return value.binding;
  }
  return resolveBinding;
}
//endregion
