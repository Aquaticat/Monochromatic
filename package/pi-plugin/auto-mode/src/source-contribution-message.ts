/**
 Retained message history is not active ancestry or source authority.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  ContributionRun,
  ContributionSourceView,
  SourceContributionAssociation,
} from './source-contribution-types.ts';

/**
 Consumer lifecycle logging never serializes borrowed message sources.
 */
const l = tagged({ tag: 'auto-mode-source-contribution-message', },);

/**
 Check current, ancestor or separately retained original message publications.
 Input-only Session origins cannot impersonate a run by comparing absent run identifiers.

 @param association - original source association

 @param source - original source view for this request

 @param run - original captured run composition, not current live state

 @returns whether an original emitted or retained message link is established

 @example
 ```ts
 const linked = inspectMessageContribution({ association, source, run });
 // Historical origin membership does not add active ancestry.
 ```
 */
export function inspectMessageContribution({
  association,
  source,
  run,
}: {
  readonly association: SourceContributionAssociation;
  readonly source: ContributionSourceView;
  readonly run: ContributionRun;
},): boolean {
  /**
   Log no borrowed source content or capability values.
   */
  const rl = tagged({
    tag: inspectMessageContribution.name,
    l,
  },);
  rl.debug('checking original message contribution publications',);
  /**
   Identity membership, not a matching occurrence field, selects the emitting run.
   */
  const emittingRun = [
    run,
    ...(run.ancestors ?? []),
  ].find(function originalRun(value,) {
    return value === association.emittingRun;
  },);
  /**
   Preserve the original precedence between handler and expanded-prompt publications.
   */
  const messagePublication = association.handlerPublication ?? association.expandedPromptPublication;
  /**
   Current or ancestor emission still requires original source and publication memberships.
   */
  const message = (association.run === run) && (emittingRun !== undefined)
    && (messagePublication !== undefined)
    && (((emittingRun.handlerMessageInputs
      ?.includes(association.source,)
      === true)
      && (emittingRun.handlerPublications
        ?.includes(messagePublication,)
        === true))
      || ((emittingRun.expandedPromptInput === association.source)
        && (emittingRun.expandedPromptPublication === messagePublication)))
    && (messagePublication.sourceOccurrence === source.sourceOccurrence)
    && (association.source
      .runOccurrence
      === emittingRun.occurrence)
    && (messagePublication.runOccurrence === emittingRun.occurrence);
  /**
   Existing original history membership must also match the source view.
   */
  const retained = association.retainedMessageOrigin;
  /**
   Explicit run occurrence excludes input-only origins even if other references match.
   */
  const historical = (association.run === run) && (retained !== undefined)
    && (retained.runOccurrence !== undefined)
    && (messagePublication !== undefined)
    && (run.retainedMessageOrigins
      ?.includes(retained,)
      === true)
    && (source.retainedMessageOrigin === retained)
    && (retained.source === association.source)
    && (retained.publication === messagePublication)
    && (retained.runOccurrence
      === association.source
      .runOccurrence)
    && (messagePublication.runOccurrence === retained.runOccurrence)
    && (messagePublication.sourceOccurrence === source.sourceOccurrence);
  return message || historical;
}
