/**
 Disposable original-reference graphs for built contribution-consumer tests.

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
 Build an independently owned fixture graph for one contribution path.

 @param profile - supported fixture path whose original identities are under test

 @returns mutable disposable originals plus their native-shaped consumer input

 @example
 ```ts
 const fixture = createContributionFixture('retained-handler');
 fixture.run.retainedMessageOrigins = [];
 ```
 */
export function createContributionFixture(profile: ContributionFixtureProfile,): ContributionFixture {
  /**
   Original request, run and render identities are distinct disposable objects.
   */
  const request = {},
    occurrence = {},
    renderOccurrence = {};
  /**
   Field and insertion metadata only select the original contribution profile.
   */
  const source = {
    occurrence: {},
    runOccurrence: occurrence,
    renderOccurrence,
    inputLocation: {
      field: profile === 'skill' ? 'skills' : profile === 'snippet' ? 'toolSnippets' : 'sections',
      slot: profile,
    },
    nativeRuleInsertion: 'inserted',
  };
  /**
   Publication references point to the same original source and run.
   */
  const publication = {
    sourceOccurrence: source.occurrence,
    runOccurrence: occurrence,
    renderOccurrence,
  };
  /**
   Separate retained origin does not add an ancestor.
   */
  const retained = {
    source,
    publication,
    runOccurrence: occurrence,
  };
  /**
   Fixture paths populate only their corresponding membership.
   */
  const emitting: ContributionFixture['emitting'] = {
    occurrence,
    renderOccurrence,
    systemPublication: publication,
    replacementInputs: profile === 'replacement' ? [source,] : [],
    ...(profile === 'forced' ? { forcedPromptInput: source, forcedPublication: publication } : {}),
    mappedPromptInputs: ['section', 'snippet',].includes(profile,) ? [source,] : [],
    builtInPromptInputs: ['default-preamble', 'tool-discovery-guidance', 'documentation-guidance',
      'project-context-introduction', 'skill-usage-guidance', 'default-rule',].includes(profile,) ? [source,] : [],
    skillDescriptionInputs: profile === 'skill' ? [source,] : [],
    promptGuidelineInputs: profile === 'prompt-guideline' ? [source,] : [],
    toolGuidelineInputs: profile === 'tool-guideline' ? [source,] : [],
    ...(profile.endsWith('handler',) ? { handlerMessageInputs: [source], handlerPublications: [publication] } : {}),
    ...(profile.endsWith('expanded',) ? { expandedPromptInput: source, expandedPromptPublication: publication } : {}),
  };
  /**
   Retained histories and active ancestor paths are deliberately disjoint.
   */
  const run: ContributionFixture['run'] = profile.startsWith('ancestor-',)
    ? {
      occurrence: {},
      replacementInputs: [],
      ancestors: [emitting,],
    }
    : profile.startsWith('retained-',)
    ? {
      occurrence: {},
      replacementInputs: [],
      ancestors: [],
      retainedMessageOrigins: [retained,],
    }
    : emitting;
  /**
   Base input publication uses existing original carrier membership.
   */
  const carrier = { source, }; const runCarrier = { sourceOccurrences: [source.occurrence,], };
  /**
   Association fields retain originals rather than constructing equal replacements.
   */
  const association: ContributionFixture['association'] = {
    source,
    sourceOccurrence: source.occurrence,
    ...(profile.startsWith('base',) ? { runCarrier } : { run, publication }),
    ...(profile === 'base' ? { carrier } : {}),
    ...(profile === 'forced' ? { forcedPublication: publication } : {}),
    ...(profile.endsWith('handler',) ? { handlerPublication: publication } : {}),
    ...(profile.endsWith('expanded',) ? { expandedPromptPublication: publication } : {}),
    ...(profile.startsWith('retained-',) ? { retainedMessageOrigin: retained } : { emittingRun: emitting }),
  };
  /**
   Original contribution list and receipt are paired by reference.
   */
  const contribution = {
    request,
    contribution: {},
    association,
    location: { field: 'messages', ordinal: 0, },
  };
  /**
   Original request's run snapshot, not a current-state reader.
   */
  const observation = {
    request,
    sourceContributions: [contribution,],
    sources: { nativeRunComposition: run, },
  };
  /**
   Original view optionally authenticates the separate retained-origin reference.
   */
  const view = {
    source,
    sourceOccurrence: source.occurrence,
    request: observation,
    ...(profile.startsWith('retained-',) ? { retainedMessageOrigin: retained } : {}),
  };
  /**
   All input containers belong solely to this fixture invocation.
   */
  const inputs = {
    requestObservation: observation,
    requestSourceContributions: observation.sourceContributions,
    instructionSources: [view,],
    instructionCarriers: [carrier,],
    runInstructionCarriers: profile.startsWith('base',) ? [runCarrier,] : [],
  };
  return {
    source,
    view,
    publication,
    run,
    emitting,
    retained,
    carrier,
    runCarrier,
    association,
    contribution,
    observation,
    inputs,
  };
}
