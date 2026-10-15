/**
 Terminal answer retention belongs to the original selected claims. @module
 */
import type {
  ChoiceEstimate,
  RelationDefinition
} from './selection-value-types.ts';

/**
 Admitted values remain unqualified estimates, explicit uncertainty, or retained failures.
 */
export type QuestionAnswer = Readonly<
  {
    status: 'estimate';
    value: number | ChoiceEstimate
  }
  | {
    status: 'unresolved';
    reason: string
  }
  | { status: 'malformed' | 'discarded' }
>;

/**
 Settlement writes only the original claim's answer and successful model attribution.
 */
export type SettlementClaim = {
  readonly definition: RelationDefinition;
  answer?: QuestionAnswer;
  model?: string;
};

/**
 Terminal diagnostics retain bounded raw text when present and preserve the original caught failure value.
 */
export type QuestionSettlementRecord = Readonly<{
  answers: readonly QuestionAnswer[];
  raw?: string;
  malformed: boolean;
  discarded: boolean;
  failure: unknown;
  model?: string;
  semanticQualification: 'not-established';
  instructionAuthority: 'not-established';
}>;

/**
 The selection owner supplies original membership and retains the terminal record.
 */
export type SettlementBatch<Claim extends SettlementClaim> = {
  readonly selected: readonly Claim[];
  settled: boolean;
  record?: QuestionSettlementRecord;
};

/**
 Original owner operations authenticate handles, prevent reentry, and check lifetime.
 */
export type QuestionSettlementOwner<Claim extends SettlementClaim> = Readonly<{
  knownBatch: (handle: unknown) => SettlementBatch<Claim>;
  retainedOperation: <Result>(operation: () => Result) => Result;
  budget: Readonly<{ checkpoint: () => void }>;
  current: (claim: Claim) => void;
}>;

/**
 Transport values remain untrusted until the complete response is admitted.
 */
export type QuestionSettlementInput = Readonly<{
  batch: unknown;
  answerText: unknown;
  model?: unknown;
}>;

/**
 Original parse failure remains available without converting it into a successful answer.
 */
export type DecodedQuestionAnswers = Readonly<{
  failure: unknown;
  values: readonly QuestionAnswer[];
}>;
