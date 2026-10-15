/**
 Independent built-consumer contracts exercise original native instruction boundaries. @module
 */
import type {
  FixtureGoverningProjection,
  FixtureGoverningSnapshot,
  FixtureGoverningSource
} from './native-governing-fixture.ts';

/**
 Fixture declarations retain the exact opaque handle supplied to question selection.
 */
export type FixtureInstructionDeclaration = Readonly<{
  definitionId: string;
  bindingHandle: object
}>;

/**
 Runtime structural opportunities deliberately expose missing-member cases.
 */
export type FixtureInstructionPair = Readonly<{
  adopter: object;
  target: object;
  member?: object
}>;

/**
 Consumer projections expose only fields inspected by the fixture assertions.
 */
export type FixtureInstructionBinding = Readonly<{
  identity: object;
  projection: Readonly<{
    claimScope?: string;
    requestMaterial?: object;
    governingRule?: FixtureGoverningProjection;
    headingContext?: FixtureGoverningProjection;
    member?: object;
    memberOrdinal?: number;
    adopter?: FixtureGoverningProjection;
    target?: FixtureGoverningProjection;
  }>;
}>;

/**
 Independent selectors accept malformed runtime values without importing implementation types.
 */
export type FixtureInstructions = Readonly<{
  resolveBinding: (handle: unknown) => FixtureInstructionBinding;
  indexedRuleCandidates: () => readonly object[];
  indexedInstructionCandidates: () => readonly object[];
  indexedHeadingContextCandidates: () => readonly object[];
  indexedUnitAdoptionPairs: () => readonly FixtureInstructionPair[];
  readRuleCandidate: (rule: unknown) => FixtureGoverningProjection;
  inspectRuleSources: () => readonly FixtureGoverningSnapshot[];
  requestMaterialFor: () => object;
  claimRequestMaterial: () => object;
  claimHeadingContext: (input: Readonly<{ candidate: unknown }>) => object;
  claimUnitAdoption: (input: Readonly<{ pair: unknown }>) => object;
  claim: (input: Readonly<{
    definitionId: string;
    memberId: string
  }>) => object;
  claimRuleCandidate: (input: Readonly<{
    definitionId: string;
    memberId: string;
    rule: unknown
  }>) => object;
  claimInstruction: (input: Readonly<{
    definitionId: string;
    memberId: string;
    ruleCode: unknown
  }>) => object;
  claimProgramRuleCandidate: (input: Readonly<{
    definitionId: string;
    rule: unknown
  }>) => object;
  issueBoundPolicyBatch: (input: Readonly<Record<string, unknown>>) => object;
  issueProgramRuleBatch: (input: Readonly<{ definitionId: string }>) => object;
  issueRuleAssessmentBatch: () => object;
  readPolicySelection: () => Readonly<{
    ruleCandidates: readonly object[];
    instructionCandidates: readonly object[];
    headingContextCandidates: readonly object[];
    unitAdoptionPairs: readonly FixtureInstructionPair[];
    ruleSourceCoverage: readonly FixtureGoverningSnapshot[];
  }>;
}>;

/**
 Built native entry is admitted independently before fixture capability injection.
 */
export type FixtureInstructionModule = Readonly<{
  createJudgmentInstructions: (input: Readonly<Record<string, unknown>>) => FixtureInstructions;
}>;

/**
 Fixture-owned controls permit retirement without mutating shared or installed state.
 */
export type FixtureInstructionState = {
  sources: readonly FixtureGoverningSource[];
  active: boolean;
  failure?: Error;
  issueFailure?: Error;
  hostPolicy: unknown;
};

/**
 Independent harness preserves original capabilities and observable declarations.
 */
export type FixtureInstructionHarness = Readonly<{
  instructions: FixtureInstructions;
  input: Readonly<Record<string, unknown>>;
  events: string[];
  state: FixtureInstructionState;
  members: readonly object[];
  byMember: Map<string, object>;
  bindings: WeakMap<object, Readonly<{ binding: FixtureInstructionBinding }>>;
  receipt: { request: Readonly<{ body: string }> };
  declarations: FixtureInstructionDeclaration[];
  batches: (readonly object[])[];
}>;
