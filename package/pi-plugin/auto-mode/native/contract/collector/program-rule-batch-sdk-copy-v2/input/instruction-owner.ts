/**
 Original instruction owner composes retained identities without reading lazy dependencies. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { createInstructionState } from './instruction-ownership.ts';
import { createInstructionSources } from './instruction-sources.ts';
import { createInstructionResolver } from './instruction-resolver.ts';
import { createProgramInstructions } from './instruction-program.ts';
import { createMemberInstructions } from './instruction-member.ts';
import { createInstructionBatches } from './instruction-batches.ts';
import type { JudgmentInstructionsInput } from './instruction-types.ts';

/** Ownership diagnostics never include original request or governing-source contents. */
const l = tagged({ tag: 'native-judgment-instructions' });

//region Public selectors share one original request, member, source, and question owner.
/**
 Own original instruction bindings and their shared semantic claim selectors.
 @param input - original judgment capabilities with lazy source ownership
 @returns frozen original instruction operations
 */
export function createJudgmentInstructions(input: JudgmentInstructionsInput) {
  const rl = tagged({ tag: createJudgmentInstructions.name, l });
  rl.debug('retaining original instruction ownership');
  const state = createInstructionState();
  const context = { input, state };
  const sources = createInstructionSources(context);
  const resolveBinding = createInstructionResolver(context);
  const program = createProgramInstructions({ context, sources });
  const member = createMemberInstructions({ context, sources });
  const batches = createInstructionBatches({ input, sources, program, member });
  return Object.freeze({
    resolveBinding,
    indexedUnitAdoptionPairs: sources.indexedUnitAdoptionPairs,
    claimUnitAdoption: program.claimUnitAdoption,
    requestMaterialFor: program.requestMaterialFor,
    claimRequestMaterial: program.claimRequestMaterial,
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
