/**
 Original member claims distinguish clause meaning from member-bound operation predicates. @module
 */
import type { MemberInstructionOperations } from './instruction-api.ts';
import type {
  InstructionRecord,
  InstructionContext,
  InstructionMember,
  SelectedInstruction
} from './instruction-types.ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import {
  retainInstructionHandle,
  memberInstructionPairs,
  retainedInstructionRules
} from './instruction-ownership.ts';
import type { InstructionSources } from './instruction-sources.ts';

/**
 Preserve the native missing-member failure at the original projection access boundary.

 @param memberRecord - original private map read

 @returns original prepared-member projection

 @throws TypeError when original member ownership has disappeared
 */
function memberProjection(memberRecord?: InstructionMember) : NonNullable<InstructionMember['binding']>['projection'] {
  if (memberRecord === undefined) throw new TypeError("Cannot read properties of undefined (reading 'binding')");
  /** Original root projection access fails before claim publication when its binding is absent. */
  const { binding } = memberRecord;
  if (binding === undefined) throw new TypeError("Cannot read properties of undefined (reading 'projection')");
  return binding.projection;
}

//region Instruction meaning shares clause identity while member predicates retain separate original handles.
/**
 Bind member predicates to original prepared membership and source clause selection.

 @param context - original judgment capabilities and private records

 @param sources - original lazy source owner

 @returns member claim operations
 
 @example createMemberInstructions({ context, sources });
 */
export function createMemberInstructions({
  context,
  sources
}: Readonly<{
  context: InstructionContext;
  sources: InstructionSources
}>) : MemberInstructionOperations {
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
    byMember,
    bindings,
    knownSelection
  } = input;
  /**
   Source selectors retain one original lazy governing-rule owner.
   */
  const { ensureRuleBindings } = sources;
  /**
   Select direct prepared-member predicates without bypassing dedicated content selectors.

   @param definitionId - fixed member predicate

   @param memberId - original declared member identifier

   @returns original member claim

   @throws JudgmentConstructionError for dedicated selectors or unknown members
   */
  function claim({
    definitionId,
    memberId
  }: Omit<SelectedInstruction, 'rule'>) : object {
    ready();
    if ([
      'request_instruction_content',
      'heading_instruction_content',
      'unit_adoption'
    ].includes(definitionId)) throw new JudgmentConstructionError('Whole-request material requires its original request selector; heading content requires its original source-group selector');
    if (definitionId === 'operation_violates_rule') throw new JudgmentConstructionError('Whole-program rule relation requires claimProgramRuleCandidate');
    if (definitionId === 'states_approval_prerequisite') throw new JudgmentConstructionError('Instruction meaning requires claimInstruction and its original clause');
    /**
     Canonical opaque handle preserves original scope identity across repeated declarations.
     */
    const bindingHandle = byMember.get(memberId);
    if (!bindingHandle) throw new JudgmentConstructionError('Requested member was not in the prepared native group');
    return knownSelection()
      .declare({
        definitionId,
        bindingHandle
      });
  }
  /**
   Retain canonical clause meaning or member-clause identity before declaration.

   @param definitionId - fixed selected predicate

   @param memberId - original declared member identifier

   @param rule - original selected clause handle

   @returns canonical predicate claim

   @throws JudgmentConstructionError for foreign membership or an invalid selector
   */
  function claimSelectedInstruction({
    definitionId,
    memberId,
    rule
  }: SelectedInstruction) : object {
    ready();
    if ([
      'operation_violates_rule',
      'clause_operation_relation',
      'request_instruction_content',
      'heading_instruction_content',
      'unit_adoption'
    ].includes(definitionId)) throw new JudgmentConstructionError('Whole-program rule relation cannot be selected through a member');
    /**
     Original prepared-member selection remains separate from source ownership.
     */
    const member = byMember.get(memberId);
    if (!member) throw new JudgmentConstructionError('Instruction claim member is outside the original prepared group');
    /**
     Authenticated member identity remains narrowed inside deferred record capture.
     */
    const originalMember: object = member;
    ensureRuleBindings();
    /**
     Original source projection is retained by reference for later revalidation.
     */
    const projection = retainedInstructionRules(state)
      .read(rule);
    if (projection.kind === 'source-heading-context') throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');
    /**
     Clause meaning shares original identity independently of prepared-member selection.
     */
    const instructionOnly = definitionId === 'states_approval_prerequisite';
    /**
     Canonical mapping distinguishes member-bound clauses from member-independent meaning.
     */
    const pairs = instructionOnly ? state.instructionMeaningPairs : memberInstructionPairs({
      state,
      member
    });
    /**
     Capture the original member lookup even for member-independent clause meaning.
     
     @returns original dependency record before handle publication
     */
    function createRecord() : InstructionRecord {
      /**
       Original private member lookup precedes projection capture.
       */
      const memberRecord = bindings.get(originalMember);
      /**
       Member predicates retain original member fields while clause meaning has its own scope.
       */
      const claimProjection = instructionOnly ? {
        claimScope: 'instruction',
        governingRule: projection
      } : {
        ...memberProjection(memberRecord),
        governingRule: projection
      };
      /**
       Frozen question binding retains original occurrence identity and projection.
       */
      const binding = Object.freeze({
        identity: Object.freeze({}),
        projection: Object.freeze(claimProjection)
      });
      return {
        member: instructionOnly ? undefined : member,
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
      map: pairs,
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
   Authenticate original candidate membership before selecting its predicate.

   @param definitionId - original predicate

   @param memberId - original prepared member

   @param rule - original clause

   @returns canonical original claim
   */
  function claimRuleCandidate({
    definitionId,
    memberId,
    rule
  }: SelectedInstruction) : object {
    ensureRuleBindings()
      .read(rule);
    return claimSelectedInstruction({
      definitionId,
      memberId,
      rule
    });
  }
  /**
   Resolve an unambiguous original source tag before selecting its predicate.

   @param definitionId - fixed predicate

   @param memberId - original declared member

   @param ruleCode - original source tag

   @returns canonical original claim
   */
  function claimInstruction({
    definitionId,
    memberId,
    ruleCode
  }: Omit<SelectedInstruction, 'rule'> & Readonly<{ ruleCode: unknown }>) : object {
    return claimSelectedInstruction({
      definitionId,
      memberId,
      rule: ensureRuleBindings()
        .select(ruleCode)
    });
  }
  return {
    claim,
    claimRuleCandidate,
    claimInstruction
  };
}
//endregion

/**
 Member claim operations retain original source and prepared-group selection.
 */
export type MemberInstructions = ReturnType<typeof createMemberInstructions>;
