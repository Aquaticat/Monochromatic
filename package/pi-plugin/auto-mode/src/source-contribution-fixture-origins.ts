/**
 Construct the original source identities shared by contribution fixture publications.

 @module
 */
import type {
  ContributionFixtureOrigins,
  ContributionFixtureProfile
} from './source-contribution-fixture-types.ts';

//region Original source and publication references belong to one fixture invocation

/**
 Create distinct original request, source, run, and render references before composing their consumers.

 @param profile - native fixture path selecting original location metadata

 @returns mutable original references shared by the fixture's later ownership stages

 @example
 ```ts
 const originals = createContributionFixtureOrigins('retained-handler');
 ```
 */
export function createContributionFixtureOrigins(profile: ContributionFixtureProfile): ContributionFixtureOrigins {
  /**
   Original serialized request identity stays distinct from all source and run identities.
   */
  const request = {};
  /**
   Original emitting run occurrence is shared by its source and publication.
   */
  const occurrence = {};
  /**
   Original native builder render remains separately observable.
   */
  const renderOccurrence = {};
  /**
   Field and insertion metadata select the original contribution profile.
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
   Publication references retain the same original source and run.
   */
  const publication = {
    sourceOccurrence: source.occurrence,
    runOccurrence: occurrence,
    renderOccurrence
  };
  /**
   Retained history remains a separate origin rather than an active ancestor.
   */
  const retained = {
    source,
    publication,
    runOccurrence: occurrence
  };
  return {
    request,
    occurrence,
    renderOccurrence,
    source,
    publication,
    retained
  };
}

//endregion Original source and publication references belong to one fixture invocation
