/**
 Original program claims retain request, heading, clause, and adoption identities. @module
 */
import type { ProgramInstructionOperations } from './instruction-api.ts';
import type {
  InstructionRecord,
  InstructionMember,
  InstructionAdoptionPair,
  InstructionContext,
  ProgramInstruction
} from './instruction-types.ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { memberProjection } from './instruction-member-projection.ts';
import { retainInstructionHandle } from './instruction-ownership.ts';
import type { InstructionSources } from './instruction-sources.ts';

//region Canonical original program selectors cannot be resampled through another member.
/**
 Bind program-level claim declaration to original request and source ownership.

 @param context - original judgment capabilities and retained records

 @param sources - original lazy source selectors

 @returns program-level claim operations
 
 @example createProgramInstructions({ context, sources });
 */
export function createProgramInstructions({
  context,
  sources
}: Readonly<{
  context: InstructionContext;
  sources: InstructionSources
}>) : ProgramInstructionOperations {
  /**
   Helpers share original input capabilities and private instruction state.
   */
  const {
    input,
    state
  } = context;
  /**
   Original judgment capabilities remain borrowed without reading lazy request or source content.
   */
  const {
    ready,
    receipt,
    knownSelection,
    bindings
  } = input;
  /**
   Source selectors retain one original lazy governing-rule owner.
   */
  const {
    ensureRuleBindings,
    indexedUnitAdoptionPairs
  } = sources;
  /**
   Read original whole-request material under the original lifetime.
   
   @returns original whole-request occurrence
   */
  function requestMaterialFor() : object {
    ready();
    return receipt.request;
  }
  /**
   Retain original request occurrence before declaring its fixed predicate.
   
   @returns canonical original request claim
   */
  function claimRequestMaterial() : object {
    ready();
    if (!state.requestMaterialBinding) {
      state.requestMaterialBinding = Object.freeze({});
      /**
       Original request is read only at its established publication boundary.
       */
      const {request} = receipt;
      /**
       Frozen question binding retains original occurrence identity and projection.
       */
      const binding = Object.freeze({
        identity: request,
        projection: Object.freeze({
          claimScope: 'program-request',
          requestMaterial: request
        })
      });
      state.instructionBindings
        .set(
          state.requestMaterialBinding,
          {
            kind: 'whole-request-material',
            request,
            binding
          }
        );
    }
    return knownSelection()
      .declare({
        definitionId: 'request_instruction_content',
        bindingHandle: state.requestMaterialBinding
      });
  }
  /**
   Retain original source-wide heading content without selecting an individual clause.

   @param candidate - original contextual-heading aggregate

   @returns canonical fixed-predicate claim

   @throws JudgmentConstructionError for a nonheading candidate
   */
  function claimHeadingContext({ candidate }: Readonly<{ candidate: object }>) : object {
    /**
     Original source projection is retained by reference for later revalidation.
     */
    const projection = ensureRuleBindings()
      .read(candidate);
    if (projection.kind !== 'source-heading-context') throw new JudgmentConstructionError('Heading content requires an original contextual-heading group');
    /**
     Capture original heading identity before publishing its canonical handle.
     
     @returns original dependency record before handle publication
     */
    function createRecord() : InstructionRecord {
      /**
       Frozen question binding retains original occurrence identity and projection.
       */
      const binding = Object.freeze({
        identity: candidate,
        projection: Object.freeze({
          claimScope: 'program-heading-context',
          headingContext: projection
        })
      });
      return {
        member: undefined,
        rule: candidate,
        projection,
        binding
      };
    }
    /**
     Canonical opaque handle preserves original scope identity across repeated declarations.
     */
    const bindingHandle = retainInstructionHandle({
      state,
      map: state.programInstructionPairs,
      key: candidate,
      createRecord
    });
    return knownSelection()
      .declare({
        definitionId: 'heading_instruction_content',
        bindingHandle
      });
  }
  /**
   Bind the original enclosing program to one original instruction clause.

   @param definitionId - fixed whole-program relation

   @param rule - original instruction candidate

   @returns canonical fixed-predicate claim

   @throws JudgmentConstructionError for unsupported predicates or contextual headings
   */
  function claimProgramRuleCandidate({
    definitionId,
    rule
  }: ProgramInstruction) : object {
    if (![
      'operation_violates_rule',
      'clause_operation_relation'
    ].includes(definitionId)) throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');
    /**
     Original source projection is retained by reference for later revalidation.
     */
    const projection = ensureRuleBindings()
      .read(rule);
    if (projection.kind === 'source-heading-context') throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');
    /**
     Distinct original program-clause identity is shared across supported predicates.
     
     @returns original dependency record before handle publication
     */
    function createRecord() : InstructionRecord {
      /**
       Frozen question binding retains original occurrence identity and projection.
       */
      const binding = Object.freeze({
        identity: Object.freeze({}),
        projection: Object.freeze({
          claimScope: 'program-instruction',
          governingRule: projection
        })
      });
      return {
        member: undefined,
        rule,
        projection,
        binding
      };
    }
    /**
     Canonical opaque handle preserves original scope identity across repeated declarations.
     */
    const bindingHandle = retainInstructionHandle({
      state,
      map: state.programInstructionPairs,
      key: rule,
      createRecord
    });
    return knownSelection()
      .declare({
        definitionId,
        bindingHandle
      });
  }
  /**
   Declare an original structural pair only after member and same-source admission.

   @param pair - original selected structural opportunity

   @returns canonical adoption claim

   @throws JudgmentConstructionError for foreign pairs, members, or source units
   */
  function claimUnitAdoption({ pair }: Readonly<{ pair: InstructionAdoptionPair }>) : object {
    if (!indexedUnitAdoptionPairs()
      .includes(pair)) throw new JudgmentConstructionError('Unit adoption requires an original selected pair from this judgment');
    /**
     Original structural pair retains independently selected member and source-unit handles.
     */
    const {
      adopter,
      target,
      member
    } = pair;
    /**
     Original adopter projection is read before the target projection.
     */
    const adopterProjection = ensureRuleBindings()
      .read(adopter);
    /**
     Original target projection must retain the adopter source occurrence.
     */
    const targetProjection = ensureRuleBindings()
      .read(target);
    /**
     Original private member lookup precedes projection capture.
     */
    const memberRecord = member === undefined ? undefined : bindings.get(member);
    if ((!memberRecord) || (member === undefined)
      || (adopterProjection.sourceOccurrence !== targetProjection.sourceOccurrence)) throw new JudgmentConstructionError('Unit adoption requires its original member and same-source units');
    /**
     Authenticated member identity remains narrowed inside deferred record capture.
     */
    const originalMember: object = member;
    /**
     Authenticated original member record remains available inside deferred capture.
     */
    const originalMemberRecord: InstructionMember = memberRecord;
    /**
     Retain both source projections and the authenticated original member ordinal.
     
     @returns original dependency record before handle publication
     */
    function createRecord() : InstructionRecord {
      /**
       Frozen question binding retains original occurrence identity and projection.
       */
      const binding = Object.freeze({
        identity: pair,
        projection: Object.freeze({
          claimScope: 'member-unit-adoption',
          member,
          memberOrdinal: memberProjection(originalMemberRecord)
            .memberOrdinal,
          adopter: adopterProjection,
          target: targetProjection
        })
      });
      return {
        kind: 'unit-adoption' as const,
        member: originalMember,
        adopter,
        target,
        adopterProjection,
        targetProjection,
        binding
      };
    }
    /**
     Canonical opaque handle preserves original scope identity across repeated declarations.
     */
    const bindingHandle = retainInstructionHandle({
      state,
      map: state.programInstructionPairs,
      key: pair,
      createRecord
    });
    return knownSelection()
      .declare({
        definitionId: 'unit_adoption',
        bindingHandle
      });
  }
  return {
    requestMaterialFor,
    claimRequestMaterial,
    claimHeadingContext,
    claimProgramRuleCandidate,
    claimUnitAdoption
  };
}
//endregion

/**
 Original program claim functions share canonical source and request ownership.
 */
export type ProgramInstructions = ReturnType<typeof createProgramInstructions>;
