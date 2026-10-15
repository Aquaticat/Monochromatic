/**
 Borrowed source and publication references are authenticated by native owners, not these types.

 @module
 */
import type { RequestSourceDerivation } from './request-source-derivation-types.ts';

//region Original input and publication identities are not authority declarations

/**
 Original captured input fields inspected by contribution accounting.
 */
export type ContributionSource = {
  /**
   Original source occurrence, never equal-content identity.
   */
  readonly occurrence: object;
  /**
   Original emitting run when this input was produced by a run.
   */
  readonly runOccurrence?: object;
  /**
   Original session input occurrence retained by the manager publication.
   */
  readonly sessionInputOccurrence?: object;
  /**
   Original builder render when this input was generated.
   */
  readonly renderOccurrence?: object;
  /**
   Native processing location selects a supported contribution profile, not authority.
   */
  readonly inputLocation: {
    readonly field?: string;
    readonly slot?: string
  };
  /**
   Native insertion observation, independent of semantic interpretation.
   */
  readonly nativeRuleInsertion?: string;
};

/**
 Original publication retains the occurrence identities supplied by its owner.
 */
export type ContributionPublication = {
  /**
   Original manager input whose declaration objects this publication retains.
   */
  readonly sessionInputOccurrence?: object;
  /**
   Source occurrence authenticated by message publication.
   */
  readonly sourceOccurrence?: object;
  /**
   Emitting run occurrence, absent for input-only Session origins.
   */
  readonly runOccurrence?: object;
  /**
   Builder render whose generated contribution was published.
   */
  readonly renderOccurrence?: object;
};

/**
 Original same-root historical message origin, not active run ancestry.
 */
export type RetainedContributionOrigin = {
  /**
   Original manager input identity remains separate from active run ancestry.
   */
  readonly sessionInputOccurrence?: object;
  /**
   Original input reference.
   */
  readonly source: ContributionSource;
  /**
   Original publication reference.
   */
  readonly publication?: ContributionPublication;
  /**
   Required for a retained run material contribution.
   */
  readonly runOccurrence?: object;
};

/**
 Flat emitting-run reference used by message accounting; no ancestor traversal is exposed.
 */
export type ContributionMessageRun = {
  /**
   Original emitting run identity.
   */
  readonly occurrence: object;
  /**
   Original handler message inputs on this run.
   */
  readonly handlerMessageInputs?: readonly ContributionSource[];
  /**
   Original handler message publications on this run.
   */
  readonly handlerPublications?: readonly ContributionPublication[];
  /**
   Original expanded prompt input.
   */
  readonly expandedPromptInput?: ContributionSource;
  /**
   Original expanded prompt publication.
   */
  readonly expandedPromptPublication?: ContributionPublication;
};

/**
 Original run composition exposes its existing source memberships without another registry.
 */
export type ContributionRun = ContributionMessageRun & {
  /**
   Original native builder render.
   */
  readonly renderOccurrence?: object;
  /**
   Published system composition.
   */
  readonly systemPublication?: ContributionPublication;
  /**
   Original system replacements, including distinct equal inputs.
   */
  readonly replacementInputs: readonly ContributionSource[];
  /**
   Original forced input and its publication remain paired.
   */
  readonly forcedPromptInput?: ContributionSource;
  /**
   Original publication of the forced system message.
   */
  readonly forcedPublication?: ContributionPublication;
  /**
   Original mapped sections and tool snippets.
   */
  readonly mappedPromptInputs?: readonly ContributionSource[];
  /**
   Original generated builder fragments.
   */
  readonly builtInPromptInputs?: readonly ContributionSource[];
  /**
   Original skill descriptions.
   */
  readonly skillDescriptionInputs?: readonly ContributionSource[];
  /**
   Original prompt guidelines, separately observed for insertion.
   */
  readonly promptGuidelineInputs?: readonly ContributionSource[];
  /**
   Original tool guidelines, separately observed for insertion.
   */
  readonly toolGuidelineInputs?: readonly ContributionSource[];
  /**
   Active original ancestors, excluding retained history.
   */
  readonly ancestors?: readonly ContributionMessageRun[];
  /**
   Existing owner-retained historical message origins.
   */
  readonly retainedMessageOrigins?: readonly RetainedContributionOrigin[];
};

/**
 Original source carrier from the base composition.
 */
export type ContributionCarrier = {
  /**
   Original source reference rather than matching text.
   */
  readonly source: ContributionSource;
};

/**
 Original run carrier retains membership of source occurrences.
 */
export type ContributionRunCarrier = {
  /**
   Source occurrences authenticated by the native composition owner.
   */
  readonly sourceOccurrences: readonly object[];
};

//endregion Borrowed source and publication references

//region Associations retain native references and do not certify request completeness

/**
 Original serialized contribution's source association.
 */
export type SourceContributionAssociation = {
  /**
   Original manager system publication authenticated at native serialization.
   */
  readonly systemInputPublication?: ContributionPublication;
  /**
   Original manager declaration publication authenticated at native serialization.
   */
  readonly toolPublication?: ContributionPublication;
  /**
   Original source input reference.
   */
  readonly source: ContributionSource;
  /**
   Original source occurrence used to select its bound view.
   */
  readonly sourceOccurrence: object;
  /**
   Original base run carrier, when present.
   */
  readonly runCarrier?: ContributionRunCarrier;
  /**
   Original base source carrier, when present.
   */
  readonly carrier?: ContributionCarrier;
  /**
   Original current run composition.
   */
  readonly run?: ContributionRun;
  /**
   Original system publication.
   */
  readonly publication?: ContributionPublication;
  /**
   Original forced publication.
   */
  readonly forcedPublication?: ContributionPublication;
  /**
   Original current or ancestor run that emitted a message.
   */
  readonly emittingRun?: ContributionMessageRun;
  /**
   Original handler message publication.
   */
  readonly handlerPublication?: ContributionPublication;
  /**
   Original expanded prompt publication.
   */
  readonly expandedPromptPublication?: ContributionPublication;
  /**
   Original retained historical message origin.
   */
  readonly retainedMessageOrigin?: RetainedContributionOrigin;
};

/**
 Original serialized contribution is retained without parsing or re-encoding its request.
 */
export type SourceContribution = {
  /**
   Original serialized request occurrence.
   */
  readonly request: object;
  /**
   Original contribution occurrence.
   */
  readonly contribution: object;
  /**
   Original containing-field location remains opaque to this consumer.
   */
  readonly location: object;
  /**
   Missing association remains an unresolved origin, never guessed from role or text.
   */
  readonly association?: SourceContributionAssociation;
};

/**
 Original request receipt exposes its owner's contribution list.
 */
export type ContributionRequestObservation = {
  /**
   Complete native field derivation is separate from partial contribution records.
   */
  readonly sourceDerivation?: RequestSourceDerivation;
  /**
   Unsupported native request fields retain their original diagnostic.
   */
  readonly sourceDerivationFailure?: string;
  /**
   Original serialized request occurrence.
   */
  readonly request: object;
  /**
   Original contribution-list identity must match the captured policy input.
   */
  readonly sourceContributions: readonly SourceContribution[];
  /**
   Original request's captured sources, not the current live run.
   */
  readonly sources?: { readonly nativeRunComposition?: ContributionRun; };
};

/**
 Native-bound source view remains distinct from the original input.
 */
export type ContributionSourceView = {
  /**
   Original source input reference.
   */
  readonly source: ContributionSource;
  /**
   Original source occurrence selected by the association.
   */
  readonly sourceOccurrence: object;
  /**
   Original request receipt to which this view belongs.
   */
  readonly request: ContributionRequestObservation;
  /**
   Original historical origin, when the view binds a retained message.
   */
  readonly retainedMessageOrigin?: RetainedContributionOrigin;
};

/**
 Original policy-input references supplied after native owner authentication.
 */
export type SourceContributionInputs = {
  /**
   Missing request receipt cannot authenticate a nonempty contribution list.
   */
  readonly requestObservation?: ContributionRequestObservation;
  /**
   Absent contributions produce an empty partial result, not a completeness claim.
   */
  readonly requestSourceContributions?: readonly SourceContribution[];
  /**
   Original source views used by this judgment.
   */
  readonly instructionSources: readonly ContributionSourceView[];
  /**
   Original base carriers used by this judgment.
   */
  readonly instructionCarriers: readonly ContributionCarrier[];
  /**
   Original run carriers used by this judgment.
   */
  readonly runInstructionCarriers: readonly ContributionRunCarrier[];
};

//endregion Original partial contribution accounting
