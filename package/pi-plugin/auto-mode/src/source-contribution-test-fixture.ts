/**
 Disposable original-reference graphs for built contribution-consumer tests.

 @module
 */
import type { ContributionFixture, ContributionFixtureProfile } from './source-contribution-fixture-types.ts';
import { createContributionFixtureOrigins } from './source-contribution-fixture-origins.ts';
import { createContributionFixtureRuns } from './source-contribution-fixture-runs.ts';
export { contributionProfiles } from './source-contribution-fixture-types.ts';
export type { ContributionFixture, ContributionFixtureProfile } from './source-contribution-fixture-types.ts';

//region Compose original fixture ownership stages without cloning their references

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
export function createContributionFixture(profile: ContributionFixtureProfile): ContributionFixture {
  /** Original source and publication ownership is established before run composition. */
  const originals = createContributionFixtureOrigins(profile);
  /** Existing identities are borrowed by the next composition stage. */
  const { source, publication, retained, request } = originals;
  /** Current run and emitting run remain separate for ancestor and retained-history profiles. */
  const { run, emitting } = createContributionFixtureRuns({ profile, originals });
  /**
   Base input publication uses existing original carrier membership.
   */
  const carrier = { source };
  /** Original run carrier retains the same source occurrence. */
  const runCarrier = { sourceOccurrences: [source.occurrence] };
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

//endregion Compose original fixture ownership stages without cloning their references
