/**
 Partial original contribution accounting does not close a governing domain.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { PolicyInputBindingError, } from './policy-input-binding-error.ts';
import { inspectMessageContribution, } from './source-contribution-message.ts';
import { inspectToolContribution } from './source-contribution-tool.ts';
import { inspectRunContribution, } from './source-contribution-run.ts';
import type {
  SourceContributionIssue,
  SourceContributionResult,
  SourceContributionUse,
} from './source-contribution-result.ts';
import type { SourceContributionInputs, } from './source-contribution-types.ts';

/**
 Lifecycle diagnostics exclude original content and borrowed references.
 */
const l = tagged({ tag: 'auto-mode-source-contribution', },);

/**
 Account for original serialized contributions using existing native-owned reference memberships.
 Native callers authenticate the request, source and carrier owners and revalidate their dependencies.
 This consumer neither authenticates fabricated owners nor certifies exhaustive receipt or delegation.
 Only newly owned uses, issues and result lists are frozen; borrowed inputs remain unchanged.

 @param inputs - authenticated original policy capture with its original contribution-list identity

 @returns partial contribution uses and unresolved-origin diagnostics without authority or permission

 @throws PolicyInputBindingError for a foreign request or contribution list

 @throws original reader failure without replacing its value

 @example
 ```ts
 const result = consumeSourceAssociations(inputs);
 // Even an empty issue list does not discharge request-source-domain.
 ```
 */
export function consumeSourceAssociations(inputs: SourceContributionInputs,): SourceContributionResult {
  /**
   Log consumption boundaries without exposing the original serialized request.
   */
  const rl = tagged({
    tag: consumeSourceAssociations.name,
    l,
  },);
  rl.debug('consuming original serialized contribution associations',);
  /**
   Owned results retain issuance order and distinct equal original occurrences.
   */
  const uses: SourceContributionUse[] = [];
  /**
   Unresolved original associations remain independent domain obligations.
   */
  const issues: SourceContributionIssue[] = [];
  for (const contribution of inputs.requestSourceContributions ?? []) {
    if ((inputs.requestObservation === undefined)
      || (inputs.requestObservation
        .sourceContributions
        !== inputs.requestSourceContributions)
      || (contribution.request
        !== inputs.requestObservation
        .request)) {
      throw new PolicyInputBindingError('Source contribution belongs to a different original serialized request',);
    }
    /**
     Association remains the original record, not a reconstruction from serialized text.
     */
    const association = contribution.association ?? undefined;
    /**
     Occurrence selects a view, then exact input identity is checked independently.
     */
    const source = association === undefined ? undefined : inputs.instructionSources
      .find(function sourceView(value,) {
      return value.sourceOccurrence === association.sourceOccurrence;
    },);
    if ((source !== undefined) && (source.request !== inputs.requestObservation))
      throw new PolicyInputBindingError('Associated source view belongs to a different original request',);
    /**
     Captured request state remains separate from a later active run.
     */
    const run = inputs.requestObservation
      .sources
      ?.nativeRunComposition;
    /**
     Original base carrier membership cannot be replaced with equal-content objects.
     */
    const base = (association !== undefined)
      && (association.runCarrier !== undefined)
      && inputs.runInstructionCarriers
      .includes(association.runCarrier,)
      && (source !== undefined)
      && association.runCarrier
      .sourceOccurrences
      .includes(source.sourceOccurrence,)
      && ((association.carrier === undefined)
        || (inputs.instructionCarriers
          .includes(association.carrier,)
          && (association.carrier
            .source
            === source.source)));
    /**
     Run-level profiles preserve their own independent publication checks.
     */
    const runLinked = (source !== undefined) && (run !== undefined)
      && (association !== undefined)
      && inspectRunContribution({
        association,
        run,
      },);
    /**
     Historical message membership never becomes active ancestry.
     */
    const messageLinked = (source !== undefined) && (run !== undefined)
      && (association !== undefined)
      && inspectMessageContribution({
        association,
        source,
        run,
      },);
    /** Original manager tool inputs have their own input-only publication membership. */
    const toolLinked = (source !== undefined) && (run !== undefined)
      && (association !== undefined)
      && inspectToolContribution({ association, source, run });
    /** Exact source identity is required independently of any supporting link. */
    const accounted = (source !== undefined) && (association !== undefined)
      && (association.source === source.source)
      && (base || runLinked
        || messageLinked || toolLinked);
    uses.push(Object.freeze({
      contribution: contribution.contribution,
      request: contribution.request,
      location: contribution.location,
      state: accounted ? 'accounted' : 'unresolved',
      ...(accounted ? {
        sourceOccurrence: source.sourceOccurrence,
        ...(association.runCarrier === undefined ? {} : { runCarrier: association.runCarrier, }),
        ...(association.run === undefined ? {} : { runPublication: association.run, }),
        ...(association.carrier === undefined ? {} : { carrier: association.carrier, }),
      } : {}),
      coverage: 'partial-original-prompt-input-contribution',
      permission: false,
    },),);
    if (!accounted) {
      rl.debug('original contribution association remains unresolved',);
      issues.push(Object.freeze({
        premise: 'complete-governing-source-coverage-and-delegation',
        kind: 'request-contribution-source-association',
        contribution: contribution.contribution,
        reason: 'This serialized contribution has no preserved original source association. Equal text and transport role do not supply its origin, authority or delegation.',
      },),);
    }
  }
  rl.debug('original contribution association consumption completed',);
  return Object.freeze({
    uses: Object.freeze(uses,),
    issues: Object.freeze(issues,),
  },);
}
