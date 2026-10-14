/** Native tool associations retain original manager input membership without assigning permission. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { ContributionRun, ContributionSourceView, SourceContributionAssociation } from './source-contribution-types.ts';

/** Diagnostics never serialize original declarations or source text. */
const l = tagged({ tag: 'auto-mode-source-contribution-tool' });

/**
 Check an original tool publication against its retained source and captured run memberships.
 @param association - original serializer association authenticated by its native owner
 @param source - original source view for this captured request
 @param run - original captured run composition
 @returns whether the manager input occurrence remains the same across every original reference
 @example
 ```ts
 const linked = inspectToolContribution({ association, source, run });
 ```
 */
export function inspectToolContribution({ association, source, run }: {
  readonly association: SourceContributionAssociation;
  readonly source: ContributionSourceView;
  readonly run: ContributionRun;
}): boolean {
  /** Each membership check has a separate diagnostic boundary. */
  const fl = tagged({ tag: inspectToolContribution.name, l });
  fl.debug('checking original native tool declaration membership');
  /** Original publication identity cannot be inferred from declaration text or tool names. */
  const publication = association.toolPublication;
  /** Input-only manager origins remain distinct from run-emitted handler messages. */
  const retained = association.retainedMessageOrigin;
  return (association.run === run) && (publication !== undefined) && (retained !== undefined)
    && (retained.sessionInputOccurrence !== undefined)
    && (run.retainedMessageOrigins?.includes(retained) === true)
    && (source.retainedMessageOrigin === retained)
    && (retained.source === association.source)
    && (retained.publication === publication)
    && (publication.sourceOccurrence === source.sourceOccurrence)
    && (publication.sessionInputOccurrence === retained.sessionInputOccurrence)
    && (association.source.sessionInputOccurrence === retained.sessionInputOccurrence);
}
