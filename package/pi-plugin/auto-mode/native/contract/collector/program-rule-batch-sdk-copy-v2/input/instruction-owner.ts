/**
 Original instruction owner composes retained identities without reading lazy dependencies. @module
 */
import type { JudgmentInstructions } from './instruction-api.ts';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { createInstructionState } from './instruction-ownership.ts';
import { createInstructionSources } from './instruction-sources.ts';
import { createInstructionResolver } from './instruction-resolver.ts';
import { createProgramInstructions } from './instruction-program.ts';
import { createMemberInstructions } from './instruction-member.ts';
import { createInstructionBatches } from './instruction-batches.ts';
import type { JudgmentInstructionsInput } from './instruction-types.ts';

/**
 Ownership diagnostics never include original request or governing-source contents.
 */
const l = tagged({ tag: 'native-judgment-instructions' });

//region Public selectors share one original request, member, source, and question owner.
/**
 Own original instruction bindings and their shared semantic claim selectors.

 @param input - original judgment capabilities with lazy source ownership

 @returns frozen original instruction operations
 
 @example createJudgmentInstructions(input);
 */
export function createJudgmentInstructions(input: JudgmentInstructionsInput) : JudgmentInstructions {
  /**
   Original bootstrap properties are read once in the incumbent constructor order.
   */
  const {
    ready,
    bindingSegment,
    isBindingSegmentActive,
    readJudgmentSources,
    declaredNames,
    byMember,
    bindings,
    knownSelection,
    parsePolicy,
    receipt,
    issue
  } = input;
  /**
   Helpers share captured capabilities without rereading caller-owned accessors.
   */
  const originalInput: JudgmentInstructionsInput = {
    ready,
    bindingSegment,
    isBindingSegmentActive,
    readJudgmentSources,
    declaredNames,
    byMember,
    bindings,
    knownSelection,
    ...(parsePolicy === undefined ? {} : { parsePolicy }),
    receipt,
    issue,
  };
  /**
   Function-specific diagnostics contain operation names without source or request material.
   */
  const rl = tagged({
    tag: createJudgmentInstructions.name,
    l
  });
  rl.debug('retaining original instruction ownership');
  /**
   Private maps retain original publication timing and lazy dependency ownership.
   */
  const state = createInstructionState();
  /**
   Shared helpers borrow the same original capabilities and private state.
   */
  const context = {
    input: originalInput,
    state
  };
  /**
   Lazy source selectors retain original parser and source-occurrence checks.
   */
  const sources = createInstructionSources(context);
  /**
   Original dependency resolver authenticates retained member, request, and source records.
   */
  const resolveBinding = createInstructionResolver(context);
  /**
   Program selectors share original request, clause, heading, and adoption identities.
   */
  const program = createProgramInstructions({
    context,
    sources
  });
  /**
   Original prepared-member selection remains separate from source ownership.
   */
  const member = createMemberInstructions({
    context,
    sources
  });
  /**
   Batch selectors retain complete claim order and original bounds.
   */
  const batches = createInstructionBatches({
    input: originalInput,
    sources,
    program,
    member
  });
  return Object.freeze({
    resolveBinding,
    indexedUnitAdoptionPairs: sources.indexedUnitAdoptionPairs,
    claimUnitAdoption: program.claimUnitAdoption,
    requestMaterialFor: program.requestMaterialFor,
    claimRequestMaterial: program.claimRequestMaterial,
    claimOperationDecision: program.claimOperationDecision,
    claimHeadingContext: program.claimHeadingContext,
    issueBoundPolicyBatch: batches.issueBoundPolicyBatch,
    claim: member.claim,
    indexedRuleCandidates: sources.indexedRuleCandidates,
    readRuleCandidate: sources.readRuleCandidate,
    indexedInstructionCandidates: sources.indexedInstructionCandidates,
    indexedHeadingContextCandidates: sources.indexedHeadingContextCandidates,
    inspectRuleSources: sources.inspectRuleSources,
    readPolicySelection: sources.readPolicySelection,
    claimProgramRuleCandidate: program.claimProgramRuleCandidate,
    issueProgramRuleBatch: batches.issueProgramRuleBatch,
    issueRuleAssessmentBatch: batches.issueRuleAssessmentBatch,
    claimRuleCandidate: member.claimRuleCandidate,
    claimInstruction: member.claimInstruction,
  });
}
//endregion
