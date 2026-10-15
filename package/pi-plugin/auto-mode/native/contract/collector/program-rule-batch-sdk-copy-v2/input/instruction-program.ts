/**
 Original program claims retain request, heading, clause, and adoption identities. @module
 */
import { JudgmentConstructionError } from './judgment-error.ts';
import { retainInstructionHandle } from './instruction-ownership.ts';
import type { InstructionAdoptionPair, InstructionContext, ProgramInstruction } from './instruction-types.ts';
import type { InstructionSources } from './instruction-sources.ts';

//region Canonical original program selectors cannot be resampled through another member.
/**
 Bind program-level claim declaration to original request and source ownership.
 @param context - original judgment capabilities and retained records
 @param sources - original lazy source selectors
 @returns program-level claim operations
 */
export function createProgramInstructions({ context, sources }: Readonly<{ context: InstructionContext; sources: InstructionSources }>) {
  const { input, state } = context;
  const { ready, receipt, knownSelection, bindings } = input;
  const { ensureRuleBindings, indexedUnitAdoptionPairs } = sources;
  /** Read original whole-request material under the original lifetime. */
  function requestMaterialFor() {
    ready();
    return receipt.request;
  }
  /** Retain original request occurrence before declaring its fixed predicate. */
  function claimRequestMaterial() {
    ready();
    if (!state.requestMaterialBinding) {
      state.requestMaterialBinding = Object.freeze({});
      const request = receipt.request;
      const binding = Object.freeze({ identity: request, projection: Object.freeze({ claimScope: 'program-request', requestMaterial: request }) });
      state.instructionBindings.set(state.requestMaterialBinding, { kind: 'whole-request-material', request, binding });
    }
    return knownSelection().declare({ definitionId: 'request_instruction_content', bindingHandle: state.requestMaterialBinding });
  }
  /**
   Retain original source-wide heading content without selecting an individual clause.
   @param candidate - original contextual-heading aggregate
   @returns canonical fixed-predicate claim
   @throws JudgmentConstructionError for a nonheading candidate
   */
  function claimHeadingContext({ candidate }: Readonly<{ candidate: object }>) {
    const projection = ensureRuleBindings().read(candidate);
    if (projection.kind !== 'source-heading-context') throw new JudgmentConstructionError('Heading content requires an original contextual-heading group');
    /** Capture original heading identity before publishing its canonical handle. */
    function createRecord() {
      const binding = Object.freeze({ identity: candidate, projection: Object.freeze({ claimScope: 'program-heading-context', headingContext: projection }) });
      return { member: undefined, rule: candidate, projection, binding };
    }
    const bindingHandle = retainInstructionHandle({ state, map: state.programInstructionPairs, key: candidate, createRecord });
    return knownSelection().declare({ definitionId: 'heading_instruction_content', bindingHandle });
  }
  /**
   Bind the original enclosing program to one original instruction clause.
   @param definitionId - fixed whole-program relation
   @param rule - original instruction candidate
   @returns canonical fixed-predicate claim
   @throws JudgmentConstructionError for unsupported predicates or contextual headings
   */
  function claimProgramRuleCandidate({ definitionId, rule }: ProgramInstruction) {
    if (!['operation_violates_rule', 'clause_operation_relation'].includes(definitionId)) throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');
    const projection = ensureRuleBindings().read(rule);
    if (projection.kind === 'source-heading-context') throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');
    /** Distinct original program-clause identity is shared across supported predicates. */
    function createRecord() {
      const binding = Object.freeze({ identity: Object.freeze({}), projection: Object.freeze({ claimScope: 'program-instruction', governingRule: projection }) });
      return { member: undefined, rule, projection, binding };
    }
    const bindingHandle = retainInstructionHandle({ state, map: state.programInstructionPairs, key: rule, createRecord });
    return knownSelection().declare({ definitionId, bindingHandle });
  }
  /**
   Declare an original structural pair only after member and same-source admission.
   @param pair - original selected structural opportunity
   @returns canonical adoption claim
   @throws JudgmentConstructionError for foreign pairs, members, or source units
   */
  function claimUnitAdoption({ pair }: Readonly<{ pair: InstructionAdoptionPair }>) {
    if (!indexedUnitAdoptionPairs().includes(pair)) throw new JudgmentConstructionError('Unit adoption requires an original selected pair from this judgment');
    const { adopter, target, member } = pair;
    const adopterProjection = ensureRuleBindings().read(adopter);
    const targetProjection = ensureRuleBindings().read(target);
    const memberRecord = member === undefined ? undefined : bindings.get(member);
    if (!memberRecord || member === undefined || adopterProjection.sourceOccurrence !== targetProjection.sourceOccurrence) throw new JudgmentConstructionError('Unit adoption requires its original member and same-source units');
    /** Retain both source projections and the authenticated original member ordinal. */
    function createRecord() {
      const binding = Object.freeze({ identity: pair, projection: Object.freeze({ claimScope: 'member-unit-adoption', member, memberOrdinal: memberRecord.binding.projection.memberOrdinal, adopter: adopterProjection, target: targetProjection }) });
      return { kind: 'unit-adoption' as const, member, adopter, target, adopterProjection, targetProjection, binding };
    }
    const bindingHandle = retainInstructionHandle({ state, map: state.programInstructionPairs, key: pair, createRecord });
    return knownSelection().declare({ definitionId: 'unit_adoption', bindingHandle });
  }
  return { requestMaterialFor, claimRequestMaterial, claimHeadingContext, claimProgramRuleCandidate, claimUnitAdoption };
}
//endregion

/** Original program claim functions share canonical source and request ownership. */
export type ProgramInstructions = ReturnType<typeof createProgramInstructions>;
