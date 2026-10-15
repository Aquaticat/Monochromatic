/**
 Original claim ownership, request publication, and retained evidence contracts. @module
 */
import type { QuestionDefinition } from './selection-definition-types.ts';
import type {
  SettlementBatch,
  SettlementClaim,
  QuestionSettlementOwner,
} from './selection-settlement-types.ts';

/**
 Resolver retains the original occurrence record and its immutable identity.
 */
export type QuestionBinding = Readonly<{ identity: object; projection: unknown }>;

/**
 Claim membership remains private to one judgment and one fixed predicate.
 */
export type SelectionClaim = SettlementClaim & {
  readonly definitionId: string;
  readonly definition: QuestionDefinition;
  readonly bindingHandle: unknown;
  readonly binding: QuestionBinding;
  issued: boolean;
  evidence?: QuestionEvidence;
};

/**
 Canonical evidence preserves estimates without granting truth, authority, or permission.
 */
export type QuestionEvidence = Readonly<{
  definitionId: string;
  definition: QuestionDefinition;
  binding: unknown;
  envelope: unknown;
  answer: SettlementClaim['answer'];
  model?: string;
  semanticQualification: 'not-established';
  instructionAuthority: 'not-established';
  permission: false;
}>;

/**
 Published request retains original predicate and occurrence projections in issue order.
 */
export type QuestionRequest = Readonly<{
  envelope: unknown;
  catalogSHA256: string;
  questions: readonly Readonly<{
    id: string;
    definitionId: string;
    definition: QuestionDefinition;
    binding: unknown;
  }>[];
  semanticQualification: 'not-established';
  instructionAuthority: 'not-established';
}>;

/**
 Issued membership and request stay fixed while terminal diagnostics are retained.
 */
export type SelectionBatch = SettlementBatch<SelectionClaim> & {
  readonly request: QuestionRequest;
  evidence?: readonly QuestionEvidence[];
};

/**
 One owner serializes synchronous access and authenticates every opaque handle.
 */
export type SelectionOwner = QuestionSettlementOwner<SelectionClaim> & Readonly<{
  claims: WeakMap<object, SelectionClaim>;
  batches: WeakMap<object, SelectionBatch>;
  state: { batchCount: number; declaredCount: number };
  resolve: (handle: unknown) => QuestionBinding;
  knownClaim: (handle: unknown) => SelectionClaim;
  knownBatch: (handle: unknown) => SelectionBatch;
  atomic: <Result>(operation: () => Result) => Result;
}>;

/**
 Catalog bytes remain untrusted while the enclosing judgment owns lifetime and resolution.
 */
export type QuestionSelectionInput = Readonly<{
  catalogText: unknown;
  catalogSHA256: unknown;
  budget: Readonly<{ checkpoint: () => void }>;
  resolveBinding: (handle: unknown) => unknown;
  envelope?: unknown;
}>;

/**
 Declaration selects an admitted predicate for an original occurrence handle.
 */
export type QuestionDeclaration = Readonly<{ definitionId: unknown; bindingHandle: unknown }>;
