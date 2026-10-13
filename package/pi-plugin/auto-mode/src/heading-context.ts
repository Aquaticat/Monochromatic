/**
 Source-local aggregate heading interpretation remains separate from governing directives.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { SemanticAdmissionPolicyError, } from './semantic-admission-error.ts';
import type {
  HeadingContextAdmission,
  HeadingContextEvidence,
  HeadingContextInterpretation,
} from './heading-context-types.ts';

/**
 Logs contain consumer lifecycle labels, never original heading text or borrowed estimates.
 */
const l = tagged({ tag: 'auto-mode-heading-context', },);

/**
 Consume source-group records from an already-authenticated complete native batch.
 Issuance order correlates records with the original candidate handles; shape alone authenticates neither.
 Native callers retain dependency revalidation after code acceptance callbacks.
 An admitted none concerns only this group's independent heading content, not source-domain completeness.
 Only owned interpretation records and their result list are frozen.

 @param records - original members selected from the authenticated batch

 @param candidates - original source-group handles in their native issuance order

 @param policy - fixed bootstrap acceptance policy, absent only for a disabled empty selection

 @returns original-reference interpretations without lowering directives or granting permission

 @throws SemanticAdmissionPolicyError for mismatched selection, definition, answer or acceptance result

 @throws original policy callback failure without replacing its value

 @example
 ```ts
 const interpretations = consumeHeadingContexts({ records, candidates, policy });
 // No interpretation supplies source authority or complete governing coverage.
 ```
 */
export function consumeHeadingContexts<
  const Candidate extends object,
  const Evidence extends HeadingContextEvidence,
>(
  {
    records,
    candidates,
    policy,
  }: {
    readonly records: readonly Evidence[];
    readonly candidates: readonly Candidate[];
    readonly policy?: HeadingContextAdmission;
  },
): readonly HeadingContextInterpretation<Candidate, Evidence>[] {
  /**
   Attribute this consumption without inspecting or serializing original material.
   */
  const rl = tagged({
    tag: consumeHeadingContexts.name,
    l,
  },);
  rl.debug('consuming original source-local heading groups',);
  if (records.length !== candidates.length)
    throw new SemanticAdmissionPolicyError('Heading estimates differ from the selected original source groups',);
  if ((records.length > 0) && (policy === undefined))
    throw new SemanticAdmissionPolicyError('Selected heading estimates require their configured code policy',);
  /**
   Owned result storage retains borrowed original identities.
   */
  const interpretations: HeadingContextInterpretation<Candidate, Evidence>[] = [];
  for (const [index, record,] of records.entries()) {
    if ((record.definitionId !== 'heading_instruction_content') || (record.definition
      .type
      !== 'choice')
      || (record.binding
        .claimScope
        !== 'program-heading-context')
      || (record.binding
        .headingContext
        .kind
        !== 'source-heading-context')) {
      throw new SemanticAdmissionPolicyError('Heading context requires its original aggregate content question',);
    }
    /**
     Missing handles cannot silently become interpretations of an absent source group.
     */
    const candidate = candidates[index];
    if (candidate === undefined)
      throw new SemanticAdmissionPolicyError('Heading candidate is absent from its selected original source group',);
    if ((record.answer
      .status
      === 'estimate') && (policy !== undefined)
      && (record.model === policy.model)) {
      /**
       Pass the original answer value to code policy rather than a reconstruction.
       */
      const { value, } = record.answer;
      if ((value === undefined) || ((value.choice !== 'none')
        && (value.choice !== 'potential-instruction')
        && (value.choice !== 'unknown'))) {
        throw new SemanticAdmissionPolicyError('Heading answer is outside the fixed aggregate content relationship',);
      }
      /**
       Only Boolean admission may select a relationship for this original source group.
       */
      const admitted = policy.accepts(value,);
      if ((typeof admitted) !== 'boolean') {
        throw new SemanticAdmissionPolicyError(
          'Heading-context policy must synchronously admit or abstain, not classify authoritative directives',
        );
      }
      if (admitted) {
        rl.debug('code policy admitted original heading content relationship',);
        interpretations.push(Object.freeze({
          candidate,
          evidence: record,
          admission: 'admitted',
          relation: value.choice,
          permission: false,
        },),);
        continue;
      }
    }
    else if ((record.answer
      .status
      !== 'estimate') && (record.answer
        .status
        !== 'unresolved')) {
      throw new SemanticAdmissionPolicyError('Heading evidence is not a usable estimate or explicit unresolved answer',);
    }
    rl.debug('abstaining from original heading content relationship',);
    interpretations.push(Object.freeze({
      candidate,
      evidence: record,
      admission: 'abstained',
      permission: false,
    },),);
  }
  return Object.freeze(interpretations,);
}
