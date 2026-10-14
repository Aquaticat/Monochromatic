/**
 Original-reference contracts shared by contribution fixture construction stages.

 @module
 */
import type {
  ContributionCarrier,
  ContributionPublication,
  ContributionRequestObservation,
  ContributionRun,
  ContributionRunCarrier,
  ContributionSource,
  ContributionSourceView,
  RetainedContributionOrigin,
  SourceContribution,
  SourceContributionAssociation,
  SourceContributionInputs,
} from '@monochromatic-dev/pi-plugin-auto-mode';

/**
 Native contribution profiles have independently checkable original memberships.
 */
export const contributionProfiles = [
  'base',
  'base-without-carrier',
  'replacement',
  'forced',
  'section',
  'snippet',
  'default-preamble',
  'tool-discovery-guidance',
  'documentation-guidance',
  'project-context-introduction',
  'skill-usage-guidance',
  'default-rule',
  'skill',
  'prompt-guideline',
  'tool-guideline',
  'handler',
  'expanded',
  'ancestor-handler',
  'ancestor-expanded',
  'retained-handler',
  'retained-expanded',
] as const;

/**
 Profile discriminators configure fixture graphs, not production admission policy.
 */
export type ContributionFixtureProfile = typeof contributionProfiles[number];

/**
 Exposed disposable references make copying, mutation and borrowed freezing observable.
 */
export type ContributionFixture = {
  /**
   Original source whose references are reused by all relevant memberships.
   */
  readonly source: { -readonly [Key in keyof ContributionSource]: ContributionSource[Key]; };
  /**
   Original request-bound view.
   */
  readonly view: { -readonly [Key in keyof ContributionSourceView]: ContributionSourceView[Key]; };
  /**
   Original system or message publication.
   */
  readonly publication: { -readonly [Key in keyof ContributionPublication]: ContributionPublication[Key]; };
  /**
   Original captured current run.
   */
  readonly run: { -readonly [Key in keyof ContributionRun]: ContributionRun[Key]; };
  /**
   Original emitting run, possibly distinct from the current run.
   */
  readonly emitting: { -readonly [Key in keyof ContributionRun]: ContributionRun[Key]; };
  /**
   Original retained origin, present independently of active ancestry.
   */
  readonly retained: { -readonly [Key in keyof RetainedContributionOrigin]: RetainedContributionOrigin[Key]; };
  /**
   Original base source carrier.
   */
  readonly carrier: { -readonly [Key in keyof ContributionCarrier]: ContributionCarrier[Key]; };
  /**
   Original base run carrier.
   */
  readonly runCarrier: { -readonly [Key in keyof ContributionRunCarrier]: ContributionRunCarrier[Key]; };
  /**
   Original association may be altered without replacing other owner references.
   */
  readonly association: { -readonly [Key in keyof SourceContributionAssociation]: SourceContributionAssociation[Key]; };
  /**
   Original serialized contribution.
   */
  readonly contribution: { -readonly [Key in keyof SourceContribution]: SourceContribution[Key]; };
  /**
   Original request receipt.
   */
  readonly observation: { -readonly [Key in keyof ContributionRequestObservation]: ContributionRequestObservation[Key]; };
  /**
   Consumer inputs retain the exact original contribution-list reference.
   */
  readonly inputs: { -readonly [Key in keyof SourceContributionInputs]: SourceContributionInputs[Key]; };
};

/**
 Original identities and sources shared by independently constructed publication stages.
 */
export type ContributionFixtureOrigins = Pick<ContributionFixture, 'source' | 'publication' | 'retained'> & {
  /**
   Original serialized request identity.
   */
  readonly request: object;
  /**
   Original emitting run identity.
   */
  readonly occurrence: object;
  /**
   Original builder render identity.
   */
  readonly renderOccurrence: object;
};
