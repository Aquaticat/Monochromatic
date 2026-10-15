/**
 Original semantic-use batches retain selection limits and declaration order. @module
 */
import type { InstructionBatchOperations } from './instruction-api.ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { firstInstructionMemberId } from './instruction-ownership.ts';
import type {
  JudgmentInstructionsInput,
  BoundPolicySelection
} from './instruction-types.ts';
import type { InstructionSources } from './instruction-sources.ts';
import type { ProgramInstructions } from './instruction-program.ts';
import type { MemberInstructions } from './instruction-member.ts';

/** Original instruction relation profile bounds each candidate collection. */
const MAX_INSTRUCTION_CANDIDATES = 256;
/** Original contextual-heading profile bounds selected source groups. */
const MAX_HEADING_GROUPS = 64;

//region Complete original batches issue inside one synchronous source dependency segment.
/**
 Compose fixed semantic uses without changing original selection or issuance order.

 @param input - original synchronous judgment capabilities

 @param sources - original candidate selection

 @param program - original program claim declaration

 @param member - original member claim declaration

 @returns bounded original batch operations
 */
export function createInstructionBatches({
  input,
  sources,
  program,
  member
}: Readonly<{
  input: JudgmentInstructionsInput;
  sources: InstructionSources;
  program: ProgramInstructions;
  member: MemberInstructions;
}>) : InstructionBatchOperations {
  const {
    bindingSegment,
    issue,
    declaredNames
  } = input;
  const {
    indexedInstructionCandidates,
    indexedHeadingContextCandidates,
    indexedUnitAdoptionPairs,
    indexedRuleCandidates
  } = sources;
  const {
    claimProgramRuleCandidate,
    claimRequestMaterial,
    claimHeadingContext,
    claimUnitAdoption
  } = program;
  const { claimRuleCandidate } = member;
  /**
   Admit explicit code-selected uses before collecting their complete original claims.

   @param clauseRelations - include original instruction-to-operation relations

   @param requestMaterial - include original whole-request content

   @param headingContexts - include original source-wide heading groups

   @param unitAdoptions - include original same-source structural opportunities

   @returns issued original claim batch

   @throws JudgmentConstructionError for missing semantic uses or exceeded selection bounds
   */
  function issueBoundPolicyBatch({
    clauseRelations,
    requestMaterial,
    headingContexts = false,
    unitAdoptions = false
  }: BoundPolicySelection) : object {
    if ((typeof clauseRelations) !== 'boolean' || (typeof requestMaterial) !== 'boolean' || (typeof headingContexts) !== 'boolean' || (typeof unitAdoptions) !== 'boolean' || ((!clauseRelations) && (!requestMaterial) && (!headingContexts) && (!unitAdoptions))) throw new JudgmentConstructionError('Bound policy batch requires explicit code-selected semantic uses');
    const includeClauses: boolean = clauseRelations;
    const includeRequest: boolean = requestMaterial;
    const includeHeadings: boolean = headingContexts;
    const includeAdoptions: boolean = unitAdoptions;
    /**
     Preserve clauses, request, headings, and adoption declaration order.
     */
    function buildRuleAssessmentClaims() : object {
      const candidates = includeClauses ? indexedInstructionCandidates() : [];
      const headings = includeHeadings ? indexedHeadingContextCandidates() : [];
      const adoptions = includeAdoptions ? indexedUnitAdoptionPairs() : [];
      if (includeAdoptions && adoptions.length === 0) throw new JudgmentConstructionError('No bounded original same-source adoption pairs are available');
      if (includeClauses && ((candidates.length === 0) || (candidates.length > MAX_INSTRUCTION_CANDIDATES))) throw new JudgmentConstructionError('Clause relation requires one through 256 original instruction candidates');
      if (includeHeadings && ((headings.length === 0) || (headings.length > MAX_HEADING_GROUPS))) throw new JudgmentConstructionError('Heading content requires one through 64 original source groups');
      const claims = candidates.map(function claimOperationRelation(rule) { return claimProgramRuleCandidate({
        definitionId: 'clause_operation_relation',
        rule
      }); });
      if (includeRequest) claims.push(claimRequestMaterial());
      for (const candidate of headings) claims.push(claimHeadingContext({ candidate }));
      for (const pair of adoptions) claims.push(claimUnitAdoption({ pair }));
      return issue(claims);
    }
    return bindingSegment(buildRuleAssessmentClaims);
  }
  /**
   Issue every original selected clause for one supported program relation.

   @param definitionId - fixed whole-program predicate

   @returns issued original batch

   @throws JudgmentConstructionError for unsupported predicates or clause counts
   */
  function issueProgramRuleBatch({ definitionId }: Readonly<{ definitionId: string }>) : object {
    if (![
      'operation_violates_rule',
      'clause_operation_relation'
    ].includes(definitionId)) throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');
    /**
     Relation predicates differ only in their original candidate enumeration.
     */
    function issueCandidateClaims() : object {
      const candidates = definitionId === 'clause_operation_relation' ? indexedInstructionCandidates() : indexedRuleCandidates();
      if ((definitionId === 'clause_operation_relation') && ((candidates.length === 0) || (candidates.length > MAX_INSTRUCTION_CANDIDATES))) throw new JudgmentConstructionError('Clause relation requires one through 256 indexed clauses');
      return issue(candidates.map(function claimCandidateRule(rule) { return claimProgramRuleCandidate({
        definitionId,
        rule
      }); }));
    }
    return bindingSegment(issueCandidateClaims);
  }
  /**
     Tagged clauses retain independent fixed predicate identities.
     */
    function buildApprovalMeaningClaims() : object {
      const candidates = indexedRuleCandidates();
      if ((candidates.length === 0) || (candidates.length > MAX_INSTRUCTION_CANDIDATES)) throw new JudgmentConstructionError('Mixed rule assessment requires one through 256 indexed clauses; unclassified prose and larger batches remain unsupported');
      const meanings = candidates.map(function claimApprovalMeaning(rule) { return claimRuleCandidate({
        definitionId: 'states_approval_prerequisite',
        memberId: firstInstructionMemberId(declaredNames[0]),
        rule
      }); });
      const operations = candidates.map(function claimOperationViolation(rule) { return claimProgramRuleCandidate({
        definitionId: 'operation_violates_rule',
        rule
      }); });
      return issue([
        ...meanings,
        ...operations
      ]);
    }
/**
   Issue original clause meanings before original operation relations in one batch.
   */
  function issueRuleAssessmentBatch() : object {
    
    return bindingSegment(buildApprovalMeaningClaims);
  }
  return {
    issueBoundPolicyBatch,
    issueProgramRuleBatch,
    issueRuleAssessmentBatch
  };
}
//endregion
