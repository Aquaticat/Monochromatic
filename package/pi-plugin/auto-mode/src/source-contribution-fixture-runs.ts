/**
 Compose current and emitting fixture runs from their original source publications.

 @module
 */
import type {
  ContributionFixture,
  ContributionFixtureOrigins,
  ContributionFixtureProfile
} from './source-contribution-fixture-types.ts';

//region Current composition and retained history preserve different original memberships

/**
 Populate the selected native run profile without copying any source or publication reference.

 @param profile - original contribution path exercised by the consumer

 @param originals - original source and publication identities retained by this fixture invocation

 @returns original emitting run and current run with the selected membership relationship

 @example
 ```ts
 const runs = createContributionFixtureRuns({ profile: 'retained-handler', originals });
 ```
 */
export function createContributionFixtureRuns({
  profile,
  originals
}: {
  readonly profile: ContributionFixtureProfile;
  readonly originals: ContributionFixtureOrigins;
}): Pick<ContributionFixture, 'run' | 'emitting'> {
  /**
   The run borrows original references rather than creating equal replacements.
   */
  const {
    occurrence,
    renderOccurrence,
    source,
    publication,
    retained
  } = originals;
  /**
   Fixture paths populate only their corresponding original source memberships.
   */
  const emitting: ContributionFixture['emitting'] = {
    occurrence,
    renderOccurrence,
    systemPublication: publication,
    replacementInputs: profile === 'replacement' ? [source] : [],
    ...(profile === 'forced' ? {
      forcedPromptInput: source,
      forcedPublication: publication
    } : {}),
    mappedPromptInputs: [
      'section',
      'snippet'
    ].includes(profile) ? [source] : [],
    builtInPromptInputs: [
      'default-preamble',
      'tool-discovery-guidance',
      'documentation-guidance',
      'project-context-introduction',
      'skill-usage-guidance',
      'default-rule'
    ].includes(profile) ? [source] : [],
    skillDescriptionInputs: profile === 'skill' ? [source] : [],
    promptGuidelineInputs: profile === 'prompt-guideline' ? [source] : [],
    toolGuidelineInputs: profile === 'tool-guideline' ? [source] : [],
    ...(profile.endsWith('handler') ? {
      handlerMessageInputs: [source],
      handlerPublications: [publication]
    } : {}),
    ...(profile.endsWith('expanded') ? {
      expandedPromptInput: source,
      expandedPromptPublication: publication
    } : {}),
  };
  /**
   Active ancestors and retained message histories remain independently testable.
   */
  const run: ContributionFixture['run'] = profile.startsWith('ancestor-')
    ? {
      occurrence: {},
      replacementInputs: [],
      ancestors: [emitting]
    }
    : profile.startsWith('retained-')
    ? {
      occurrence: {},
      replacementInputs: [],
      ancestors: [],
      retainedMessageOrigins: [retained]
    }
    : emitting;
  return {
    run,
    emitting
  };
}

//endregion Current composition and retained history preserve different original memberships
