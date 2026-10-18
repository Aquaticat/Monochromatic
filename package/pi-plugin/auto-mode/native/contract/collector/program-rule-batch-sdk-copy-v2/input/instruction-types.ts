/**
 Original instruction claims retain member, source, and selection ownership. @module
 */
import type { UnitAdoptionPair } from '../../../../../src/unit-adoption-binding.ts';
import type {
  GoverningSetInput,
  GoverningRuleSet,
  GoverningSetProjection
} from '../../../lifecycle/governing-rule-candidates/set-types.ts';
import type { QuestionBinding } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner-types.ts';
import type { QuestionSelection } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner.ts';

/**
 Structural opportunities precede original prepared-member authentication.
 */
export type InstructionAdoptionPair = UnitAdoptionPair<ReturnType<ReadonlyMap<string, object>['get']>>;

/**
 Root claim bindings are borrowed; reached child records omit the root-only binding.
 */
export type InstructionMember = Readonly<{
  binding?: Readonly<{
    identity: object;
    projection: Readonly<{ memberOrdinal: number }>
  }>;
}>;

/**
 Optional parser ownership is captured once before individual judgments are constructed.
 */
export type InstructionParserOptions = Readonly<{ parsePolicy?: GoverningSetInput['parse'] }>;

/**
 Bootstrap capabilities retain synchronous dependency boundaries and original request identity.
 */
export type JudgmentInstructionsInput = Readonly<{
  ready: () => void;
  bindingSegment: <Result>(operation: () => Result) => Result;
  isBindingSegmentActive: () => boolean;
  readJudgmentSources: () => Readonly<{
    hostGoverningPolicy: unknown;
    governingSources: ReturnType<GoverningSetInput['readSources']>;
    decisionContext?: Readonly<{
      sources: ReturnType<GoverningSetInput['readSources']>;
      selection?:Readonly<{excluded?:readonly Readonly<{
        start:number;
        end:number;
        text:string
      }>[]}>;
    }>;
  }>;
  declaredNames: readonly Readonly<{
    id: string;
    name: string
  }>[];
  byMember: ReadonlyMap<string, object>;
  bindings: Pick<WeakMap<object, InstructionMember>, 'get' | 'has'>;
  knownSelection: () => Pick<QuestionSelection, 'declare'>;
  parsePolicy?: InstructionParserOptions['parsePolicy'];
  receipt: Readonly<{ request: object }>;
  issue: (claims: readonly object[]) => object;
}>;

/**
 Source and member revalidation keep the original clause projection by reference.
 */
type ClauseInstruction = Readonly<{
  kind?: never;
  member: InstructionAdoptionPair['member'];
  rule: object;
  projection: GoverningSetProjection;
  binding: QuestionBinding;
}>;

/**
 Request claims retain occurrence identity even if another request has equal bytes.
 */
type RequestInstruction = Readonly<{
  kind: 'whole-request-material';
  request: object;
  binding: QuestionBinding;
}>;

/**
 Whole-operation decisions retain original request identity without selecting its archived body.
 */
type OperationDecisionInstruction = Readonly<{
  kind: 'whole-operation-decision';
  request: object;
  binding: QuestionBinding;
}>;

/**
 Adoption retains both independently owned source-unit projections.
 */
type AdoptionInstruction = Readonly<{
  kind: 'unit-adoption';
  member: object;
  adopter: object;
  target: object;
  adopterProjection: GoverningSetProjection;
  targetProjection: GoverningSetProjection;
  binding: QuestionBinding;
}>;

/**
 Private instruction records determine which original dependencies must still match.
 */
export type InstructionRecord = ClauseInstruction | RequestInstruction | OperationDecisionInstruction | AdoptionInstruction;

/**
 Lazy owner state preserves publication timing and separate meaning versus member identities.
 */
export type InstructionState = {
  readonly instructionBindings: WeakMap<object, InstructionRecord>;
  readonly instructionPairs: WeakMap<object, WeakMap<object, object>>;
  readonly instructionMeaningPairs: WeakMap<object, object>;
  readonly programInstructionPairs: WeakMap<object, object>;
  ruleBindings?: GoverningRuleSet;
  unitAdoptionPairs?: readonly InstructionAdoptionPair[];
  requestMaterialBinding?: object;
};

/**
 Helpers borrow the same original capabilities and private mutable owner.
 */
export type InstructionContext = Readonly<{
  input: JudgmentInstructionsInput;
  state: InstructionState
}>;

/**
 Selected original member and clause determine a fixed predicate declaration.
 */
export type SelectedInstruction = Readonly<{
  definitionId: string;
  memberId: string;
  rule: object
}>;

/**
 Whole-program predicates retain original clause identity independently of members.
 */
export type ProgramInstruction = Readonly<{
  definitionId: string;
  rule: object
}>;

/**
 Runtime flags remain untrusted until explicit semantic-use admission succeeds.
 */
export type BoundPolicySelection = Readonly<{
  clauseRelations: unknown;
  requestMaterial: unknown;
  headingContexts?: unknown;
  unitAdoptions?: unknown;
}>;
