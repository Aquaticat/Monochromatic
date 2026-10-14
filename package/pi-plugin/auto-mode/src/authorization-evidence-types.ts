/**
 Original references and borrowed capabilities for prerequisite evidence.

 @module
 */
import type { AuthorizationRequirement, } from './authorization-requirement.ts';

//region Evidence ownership remains independent of instruction interpretation

/**
 Independent condition facts never supply permission or clause meaning.
 */
export type AuthorizationFacts = Pick<AuthorizationRequirement, 'satisfaction' | 'channel'>;

/**
 Original request-bound view already authenticated by its source owner.
 */
export type AuthorizationSourceView = {
  /** Original source occurrence, never equal-content identity. */
  readonly sourceOccurrence: object;
  /** Original request whose source this view binds. */
  readonly request: object;
};

/**
 Candidate context supplied only to the fixed bootstrap factory.
 */
export type AuthorizationOwnerContext = {
  /** Original prepared judgment. */
  readonly judgment: object;
  /** Original indexed clause handle. */
  readonly rule: object;
  /** Missing source bindings cannot support authorization evidence. */
  readonly source: AuthorizationSourceView | undefined;
  /** Missing original requests cannot support authorization evidence. */
  readonly request: object | undefined;
};

/**
 Native source collection exposes existing references and freshness checks.
 */
export type AuthorizationInputSources = {
  /** Complete original indexed instruction candidate set when available. */
  readonly instructionCandidates?: readonly object[] | undefined;
  /** Legacy original rule candidates used only when the complete set is absent. */
  readonly ruleCandidates: readonly object[];
  /** Original source views, without copying their borrowed identities. */
  readonly instructionSources: readonly AuthorizationSourceView[];
  /** Original request observation remains absent when its owner is unavailable. */
  readonly requestObservation?: object | undefined;
  /** Native reader authenticates the candidate before exposing its source occurrence. */
  readonly readRule: (rule: object) => { readonly sourceOccurrence: object };
  /** Original source owner validates current eligibility. */
  readonly assertCurrent: () => void;
};

/**
 Only trusted bootstrap supplies this factory; its output still needs original binding checks.
 */
export type AuthorizationOwnerFactory = (context: AuthorizationOwnerContext) => unknown;

/**
 Retained diagnostic record carries original identities and copied primitive facts.
 */
export type AuthorizationEvidenceRecord = {
  /** Original candidate handle. */
  readonly rule: object;
  /** Original request-bound source view. */
  readonly source: AuthorizationSourceView;
  /** Original request observation. */
  readonly request: object;
  /** Borrowed record authenticated by the original fact owner. */
  readonly evidence: unknown;
  /** Independently validated primitive vocabulary, without a permission verdict. */
  readonly authorization: AuthorizationFacts;
};

/**
 Internal record keeps its original owner's freshness operation beside its evidence.
 */
export type AuthorizationEvidenceBinding = AuthorizationEvidenceRecord & {
  /** Original facts and capability identities must remain current. */
  readonly current: () => void;
};

/**
 Request-local evidence cannot be revived after its first failed eligibility check.
 */
export type AuthorizationEvidenceInputs = {
  /** Missing owner evidence stays absent instead of becoming a satisfied condition. */
  readonly forClause: (rule: object) => AuthorizationFacts | undefined;
  /** Revalidate original dependencies and every captured fact owner. */
  readonly assertCurrent: () => void;
  /** Retained records are diagnostic data, not transferable approval capabilities. */
  readonly records: readonly AuthorizationEvidenceRecord[];
};

//endregion Evidence contracts
