/**
 Match existing original run memberships without assigning instruction authority.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  ContributionRun,
  SourceContributionAssociation,
} from './source-contribution-types.ts';

/**
 Consumer lifecycle logging excludes original input and publication values.
 */
const l = tagged({ tag: 'auto-mode-source-contribution-run', },);

/**
 Check supported system, builder and guideline contribution paths.
 Every path retains its independent membership, occurrence and publication checks.

 @param association - original association selected by the native request owner

 @param run - original request's run composition

 @returns whether any supported original run contribution path is established

 @example
 ```ts
 const linked = inspectRunContribution({ association, run });
 // A linked contribution does not establish source authority.
 ```
 */
export function inspectRunContribution({
  association,
  run,
}: {
  readonly association: SourceContributionAssociation;
  readonly run: ContributionRun;
},): boolean {
  /**
   Logging records entry without reflecting borrowed source material.
   */
  const rl = tagged({
    tag: inspectRunContribution.name,
    l,
  },);
  rl.debug('checking original run contribution memberships',);
  /**
   Original replacement publication remains distinct from current system text.
   */
  const replacement = (association.run === run)
    && (association.publication !== undefined)
    && (association.publication === run.systemPublication)
    && run.replacementInputs
    .includes(association.source,)
    && (association.source
      .runOccurrence
      === run.occurrence);
  /**
   Forced-message publication must be the original run's publication.
   */
  const forced = (association.run === run) && (association.forcedPublication !== undefined)
    && (association.forcedPublication === run.forcedPublication)
    && (association.source === run.forcedPromptInput)
    && (association.source
      .runOccurrence
      === run.occurrence);
  /**
   Only supported mapped fields participate in this original publication profile.
   */
  const mapped = (association.run === run) && (association.publication !== undefined)
    && (association.publication === run.systemPublication)
    && (run.mappedPromptInputs
      ?.includes(association.source,)
      === true)
    && ([
      'sections',
      'toolSnippets',
    ].includes(association.source
      .inputLocation
      .field
      ?? '',))
    && (association.source
      .runOccurrence
      === run.occurrence);
  /**
   Generated fragments additionally retain the original observed builder render.
   */
  const generated = (association.run === run) && (association.publication !== undefined)
    && (association.publication === run.systemPublication)
    && (run.builtInPromptInputs
      ?.includes(association.source,)
      === true)
    && (run.renderOccurrence !== undefined)
    && (association.source
      .runOccurrence
      === run.occurrence)
    && (association.source
      .renderOccurrence
      === run.renderOccurrence)
    && (association.publication
      .renderOccurrence
      === run.renderOccurrence)
    && ([
      'default-preamble',
      'tool-discovery-guidance',
      'documentation-guidance',
      'project-context-introduction',
      'skill-usage-guidance',
    ].includes(association.source
      .inputLocation
      .slot
      ?? '',)
      || ((association.source
        .inputLocation
        .slot
        === 'default-rule') && (association.source
          .nativeRuleInsertion
          === 'inserted')));
  /**
   Skill description membership does not confer authority on skill prose.
   */
  const skill = (association.run === run) && (association.publication !== undefined)
    && (association.publication === run.systemPublication)
    && (run.skillDescriptionInputs
      ?.includes(association.source,)
      === true)
    && (association.source
      .inputLocation
      .field
      === 'skills')
    && (association.source
      .runOccurrence
      === run.occurrence);
  /**
   Guideline membership requires insertion and the same original render.
   */
  const guideline = (association.run === run) && (association.publication !== undefined)
    && (association.publication === run.systemPublication)
    && ((run.promptGuidelineInputs
      ?.includes(association.source,)
      === true)
      || (run.toolGuidelineInputs
        ?.includes(association.source,)
        === true))
    && (association.source
      .nativeRuleInsertion
      === 'inserted')
    && (run.renderOccurrence !== undefined)
    && (association.source
      .runOccurrence
      === run.occurrence)
    && (association.source
      .renderOccurrence
      === run.renderOccurrence)
    && (association.publication
      .renderOccurrence
      === run.renderOccurrence);
  return replacement || forced
    || mapped
    || generated
    || skill
    || guideline;
}
