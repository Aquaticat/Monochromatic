/**
 Typed instruction operations expose original selection and claim boundaries. @module
 */
import type {
  GoverningRuleSet,
  GoverningSetProjection,
  GoverningSetSnapshot
} from '../../../lifecycle/governing-rule-candidates/set-types.ts';
import type { QuestionBinding } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner-types.ts';
import type {
  InstructionAdoptionPair,
  SelectedInstruction,
  ProgramInstruction,
  BoundPolicySelection,
  InstructionMember
} from './instruction-types.ts';

/**
 Claimed instructions have canonical bindings; reached-child member records retain their absent binding result.
 */
export type InstructionBindingLookup = QuestionBinding | InstructionMember['binding'];

/**
 One frozen selection retains every independently owned source subject and coverage record.
 */
export type InstructionPolicySelection = Readonly<{
  ruleCandidates: readonly object[];
  instructionCandidates: readonly object[];
  headingContextCandidates: readonly object[];
  unitAdoptionPairs: readonly InstructionAdoptionPair[];
  ruleSourceCoverage: readonly GoverningSetSnapshot[];
}>;

/**
 Lazy source reads remain authenticated by the same original judgment lifetime.
 */
export type InstructionSourceOperations = Readonly<{
  ensureRuleBindings: () => GoverningRuleSet;
  indexedRuleCandidates: () => readonly object[];
  readRuleCandidate: (rule: object) => GoverningSetProjection;
  indexedInstructionCandidates: () => readonly object[];
  indexedHeadingContextCandidates: () => readonly object[];
  inspectRuleSources: () => readonly GoverningSetSnapshot[];
  indexedUnitAdoptionPairs: () => readonly InstructionAdoptionPair[];
  readPolicySelection: () => InstructionPolicySelection;
}>;

/**
 Program selectors retain original request, source-group, clause, and pair handles.
 */
export type ProgramInstructionOperations = Readonly<{
  requestMaterialFor: () => object;
  claimRequestMaterial: () => object;
  claimHeadingContext: (input: Readonly<{ candidate: object }>) => object;
  claimProgramRuleCandidate: (input: ProgramInstruction) => object;
  claimUnitAdoption: (input: Readonly<{ pair: InstructionAdoptionPair }>) => object;
}>;

/**
 Member selectors retain dedicated handling for member-independent clause meaning.
 */
export type MemberInstructionOperations = Readonly<{
  claim: (input: Omit<SelectedInstruction, 'rule'>) => object;
  claimRuleCandidate: (input: SelectedInstruction) => object;
  claimInstruction: (input: Omit<SelectedInstruction, 'rule'> & Readonly<{ ruleCode: unknown }>) => object;
}>;

/**
 Original batch construction enforces explicit semantic uses and original bounded profiles.
 */
export type InstructionBatchOperations = Readonly<{
  issueBoundPolicyBatch: (input: BoundPolicySelection) => object;
  issueProgramRuleBatch: (input: Readonly<{ definitionId: string }>) => object;
  issueRuleAssessmentBatch: () => object;
}>;

/**
 Public instruction operations share one original owner without exposing private maps.
 */
export type JudgmentInstructions = Omit<InstructionSourceOperations, 'ensureRuleBindings'> & ProgramInstructionOperations & MemberInstructionOperations & InstructionBatchOperations & Readonly<{
  resolveBinding: (handle: object) => InstructionBindingLookup;
}>;
