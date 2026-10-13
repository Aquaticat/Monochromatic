/**
 Owned partial accounting records retain borrowed occurrence references.

 @module
 */
import type { ContributionCarrier, ContributionRun, ContributionRunCarrier, } from './source-contribution-types.ts';

/**
 Particular serialized contribution's accounting state, never exhaustive source-domain evidence.
 */
export type SourceContributionUse = {
  /** Original contribution occurrence. */
  readonly contribution: object;
  /** Original serialized request occurrence. */
  readonly request: object;
  /** Original containing-field location. */
  readonly location: object;
  /** Missing original links remain explicit rather than inferred from equal text. */
  readonly state: 'accounted' | 'unresolved';
  /** Present only for an accounted original association. */
  readonly sourceOccurrence?: object;
  /** Original run carrier, when provided by the accounted association. */
  readonly runCarrier?: ContributionRunCarrier;
  /** Original run composition, when provided by the accounted association. */
  readonly runPublication?: ContributionRun;
  /** Original base carrier, when provided by the accounted association. */
  readonly carrier?: ContributionCarrier;
  /** This contribution says nothing about other received or untransmitted inputs. */
  readonly coverage: 'partial-original-prompt-input-contribution';
  /** Contribution accounting grants no permission. */
  readonly permission: false;
};

/**
 Unresolved origin issue retains the affected original contribution.
 */
export type SourceContributionIssue = {
  /** Source-domain obligations remain separate from semantic meaning. */
  readonly premise: 'complete-governing-source-coverage-and-delegation';
  /** Original contribution lacks a supported preserved association. */
  readonly kind: 'request-contribution-source-association';
  /** Original contribution whose origin remains unresolved. */
  readonly contribution: object;
  /** Code-owned explanation without exposing original content. */
  readonly reason: string;
};

/**
 Owned frozen result lists do not freeze the original referenced records.
 */
export type SourceContributionResult = {
  /** Issuance-ordered partial contribution uses. */
  readonly uses: readonly SourceContributionUse[];
  /** Independent unresolved original-contribution diagnostics. */
  readonly issues: readonly SourceContributionIssue[];
};
