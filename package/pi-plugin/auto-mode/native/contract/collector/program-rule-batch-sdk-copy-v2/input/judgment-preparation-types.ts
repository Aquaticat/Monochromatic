/**
 Original preparation contracts retain complete member publication and source sealing. @module
 */
import type { JudgmentBudget } from '../../../lifecycle/judgment-budget-error-occurrences/controls-private/types.ts';
import type { QuestionSelection } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner.ts';
import type { QuestionSelectionInput } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner-types.ts';
import type { JudgmentDeclaredMember } from './judgment-member-types.ts';
import type { ProgramPreparedMember } from './program-declaration-types.ts';
import type { ProgramMemberRecord } from './program-state-types.ts';
import type {
  InstructionMember,
  InstructionParserOptions
} from './instruction-types.ts';

/**
 Source sealing retains policy and governing projections without adding authority.
 */
export type JudgmentPreparationSources = Readonly<{
  mandatoryPolicy?: Readonly<{ content?: unknown }>;
  governingSources?: unknown;
  decisionContext?: Readonly<{
    sources: unknown;
    selection?:Readonly<{
      material?:unknown;
      failure?:unknown
    }>
  }>;
}>;

/**
 Preparation and failure state remain available to dependency and retained-inspection owners.
 */
export type JudgmentPreparationState = {
  prepared: boolean;
  preparing: boolean;
  preparationFailed: boolean;
  preparationFailure?: unknown;
  handle?: object;
  selection?: QuestionSelection;
};

/**
 Published root membership shares one original binding across instruction and execution owners.
 */
export type JudgmentPreparedBinding = ProgramMemberRecord & Required<InstructionMember>;

/**
 Original preparation capabilities remain lazy until the corresponding native boundary.
 */
export type JudgmentPreparationInput<Source extends JudgmentPreparationSources = JudgmentPreparationSources> = Readonly<{
  parsePolicy?:InstructionParserOptions['parsePolicy'];
  active: () => void;
  budget: JudgmentBudget;
  declaredNames: readonly JudgmentDeclaredMember[];
  observer: Readonly<{
    beginJudgmentSources?: unknown;
    sealJudgmentSources: (response: object) => Readonly<{
      request: object;
      sources: Source;
    }>;
  }>;
  response: object;
  receipt: Readonly<{ request: Readonly<{ body: unknown }> }>;
  readJudgmentSources: () => Source;
  publishJudgmentSources: (sources: Source) => void;
  facade: Readonly<{
    prepare: (input: Readonly<{ signal: AbortSignal }>) => object;
    finalize: (handle: object) => unknown;
  }>;
  signal: AbortSignal;
  parentJSON: string;
  catalogText: string;
  catalogSHA256: string;
  resolveBinding: QuestionSelectionInput['resolveBinding'];
  bindings: Readonly<{
    set: (
      identity: object,
      record: JudgmentPreparedBinding
    ) => unknown;
  }>;
  byMember: Map<string, object>;
}>;

/**
 Native preparation retains terminal failure, original selection, and complete published membership.
 */
export type JudgmentPreparation = Readonly<{
  state: JudgmentPreparationState;
  prepare: (members: readonly ProgramPreparedMember[]) => void;
  knownSelection: () => QuestionSelection;
}>;
