/**
 Borrowed source and publication references are authenticated by native owners, not these types.

 @module
 */

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
  readonly runOccurrence?: object | undefined;
  /**
   Original builder render when this input was generated.
   */
  readonly renderOccurrence?: object | undefined;
  /**
   Native processing location selects a supported contribution profile, not authority.
   */
  readonly inputLocation: {
    readonly field?: string | undefined;
    readonly slot?: string
  };
  /**
   Native insertion observation, independent of semantic interpretation.
   */
  readonly nativeRuleInsertion?: string | undefined;
};

/**
 Original publication retains the occurrence identities supplied by its owner.
 */
export type ContributionPublication = {
  /**
   Source occurrence authenticated by message publication.
   */
  readonly sourceOccurrence?: object | undefined;
  /**
   Emitting run occurrence, absent for input-only Session origins.
   */
  readonly runOccurrence?: object | undefined;
  /**
   Builder render whose generated contribution was published.
   */
  readonly renderOccurrence?: object | undefined;
};

/**
 Original same-root historical message origin, not active run ancestry.
 */
export type RetainedContributionOrigin = {
  /**
   Original input reference.
   */
  readonly source: ContributionSource;
  /**
   Original publication reference.
   */
  readonly publication?: ContributionPublication | undefined;
  /**
   Required for a retained run material contribution.
   */
  readonly runOccurrence?: object | undefined;
};

/**
 Original run composition exposes its existing source memberships without another registry.
 */
export type ContributionRun = {
  /**
   Original run identity.
   */
  readonly occurrence: object;
  /**
   Original native builder render.
   */
  readonly renderOccurrence?: object | undefined;
  /**
   Published system composition.
   */
  readonly systemPublication?: ContributionPublication | undefined;
  /**
   Original system replacements, including distinct equal inputs.
   */
  readonly replacementInputs: readonly ContributionSource[];
  /**
   Original forced input and its publication remain paired.
   */
  readonly forcedPromptInput?: ContributionSource | undefined;
  /**
   Original publication of the forced system message.
   */
  readonly forcedPublication?: ContributionPublication | undefined;
  /**
   Original mapped sections and tool snippets.
   */
  readonly mappedPromptInputs?: readonly ContributionSource[] | undefined;
  /**
   Original generated builder fragments.
   */
  readonly builtInPromptInputs?: readonly ContributionSource[] | undefined;
  /**
   Original skill descriptions.
   */
  readonly skillDescriptionInputs?: readonly ContributionSource[] | undefined;
  /**
   Original prompt guidelines, separately observed for insertion.
   */
  readonly promptGuidelineInputs?: readonly ContributionSource[] | undefined;
  /**
   Original tool guidelines, separately observed for insertion.
   */
  readonly toolGuidelineInputs?: readonly ContributionSource[] | undefined;
  /**
   Active original ancestors, excluding retained history.
   */
  readonly ancestors?: readonly ContributionRun[] | undefined;
  /**
   Original handler message inputs on this run.
   */
  readonly handlerMessageInputs?: readonly ContributionSource[] | undefined;
  /**
   Original handler message publications on this run.
   */
  readonly handlerPublications?: readonly ContributionPublication[] | undefined;
  /**
   Original expanded prompt input.
   */
  readonly expandedPromptInput?: ContributionSource | undefined;
  /**
   Original expanded prompt publication.
   */
  readonly expandedPromptPublication?: ContributionPublication | undefined;
  /**
   Existing owner-retained historical message origins.
   */
  readonly retainedMessageOrigins?: readonly RetainedContributionOrigin[] | undefined;
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
  readonly runCarrier?: ContributionRunCarrier | undefined;
  /**
   Original base source carrier, when present.
   */
  readonly carrier?: ContributionCarrier | undefined;
  /**
   Original current run composition.
   */
  readonly run?: ContributionRun | undefined;
  /**
   Original system publication.
   */
  readonly publication?: ContributionPublication | undefined;
  /**
   Original forced publication.
   */
  readonly forcedPublication?: ContributionPublication | undefined;
  /**
   Original current or ancestor run that emitted a message.
   */
  readonly emittingRun?: ContributionRun | undefined;
  /**
   Original handler message publication.
   */
  readonly handlerPublication?: ContributionPublication | undefined;
  /**
   Original expanded prompt publication.
   */
  readonly expandedPromptPublication?: ContributionPublication | undefined;
  /**
   Original retained historical message origin.
   */
  readonly retainedMessageOrigin?: RetainedContributionOrigin | undefined;
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
  readonly association?: SourceContributionAssociation | null | undefined;
};

/**
 Original request receipt exposes its owner's contribution list.
 */
export type ContributionRequestObservation = {
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
  readonly retainedMessageOrigin?: RetainedContributionOrigin | undefined;
};

/**
 Original policy-input references supplied after native owner authentication.
 */
export type SourceContributionInputs = {
  /**
   Missing request receipt cannot authenticate a nonempty contribution list.
   */
  readonly requestObservation?: ContributionRequestObservation | undefined;
  /**
   Absent contributions produce an empty partial result, not a completeness claim.
   */
  readonly requestSourceContributions?: readonly SourceContribution[] | undefined;
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
