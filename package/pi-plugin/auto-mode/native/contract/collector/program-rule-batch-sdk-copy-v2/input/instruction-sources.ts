/**
 Lazy original policy selection stays inside synchronous dependency boundaries. @module
 */
import type { InstructionSourceOperations, InstructionPolicySelection } from './instruction-api.ts';
import type { GoverningRuleSet, GoverningSetInput, GoverningSetProjection, GoverningSetSnapshot } from '../../../lifecycle/governing-rule-candidates/set-types.ts';
import type { InstructionAdoptionPair } from './instruction-types.ts';
import { selectUnitAdoptionPairs } from '../../../integration/action-policy/unit-adoption-profile.mjs';
import { createGoverningRuleSet } from '../../../lifecycle/governing-rule-candidates/set-owner.ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { firstInstructionMemberId } from './instruction-ownership.ts';
import type { InstructionContext } from './instruction-types.ts';

//region Enumeration selects source-owned structure without establishing authority or permission.
/**
 Retain original source selection and lazy bounded adoption opportunities.

 @param input - original judgment capabilities

 @param state - private lazy owner records

 @returns original source operations
 */
export function createInstructionSources({
  input,
  state
}: InstructionContext) : InstructionSourceOperations {
  const {
    ready,
    bindingSegment,
    isBindingSegmentActive,
    readJudgmentSources,
    parsePolicy,
    declaredNames,
    byMember
  } = input;
  /**
   Initialize original governing sources once under the existing dependency segment.
   */
  function ensureRuleBindings() : GoverningRuleSet {
    ready();
    if (!state.ruleBindings) {
      if (((typeof parsePolicy) !== 'function') || (!Boolean(readJudgmentSources().hostGoverningPolicy))) throw new JudgmentConstructionError('Original host-selected policy and qualified parser are required for instruction claims');
      const parse: NonNullable<InstructionContext['input']['parsePolicy']> = parsePolicy;
      /**
       Source reads retain the original judgment lifetime check.
       */
      function readGoverningSources() : ReturnType<GoverningSetInput['readSources']> {
        ready();
        return readJudgmentSources()
          .governingSources;
      }
      /**
       Capture original source ownership without moving its publication point.
       */
      function createRuleBindings() : GoverningRuleSet {
        return createGoverningRuleSet({
          parse,
          readSources: readGoverningSources
        });
      }
      state.ruleBindings = isBindingSegmentActive() ? createRuleBindings() : bindingSegment(createRuleBindings);
    }
    return state.ruleBindings;
  }
  /**
   Enumerate original tagged candidates without assigning authority.
   */
  function indexedRuleCandidates() : readonly object[] { return ensureRuleBindings()
    .indexedCandidates(); }
  /**
   Keep original reads inside fresh entry and exit dependency checks.
   */
  function readRuleCandidate(rule: object) : GoverningSetProjection {
    /**
     Read the original source projection inside its selected segment.
     */
    function readOwnedRule() : GoverningSetProjection { return ensureRuleBindings()
      .read(rule); }
    return isBindingSegmentActive() ? readOwnedRule() : bindingSegment(readOwnedRule);
  }
  /**
   Retain every original instruction candidate, including unclassified units.
   */
  function indexedInstructionCandidates() : readonly object[] { return ensureRuleBindings()
    .indexedInstructionCandidates(); }
  /**
   Keep contextual heading aggregates distinct from individual clauses.
   */
  function indexedHeadingContextCandidates() : readonly object[] { return ensureRuleBindings()
    .indexedHeadingContextCandidates(); }
  /**
   Preserve original structural coverage diagnostics without claiming authority.
   */
  function inspectRuleSources() : readonly GoverningSetSnapshot[] { return ensureRuleBindings()
    .inspect(); }
  /**
   Select structural opportunities only for the original sole declared member.
   */
  function indexedUnitAdoptionPairs() : readonly InstructionAdoptionPair[] {
    ready();
    if (!state.unitAdoptionPairs) {
      /**
       Selection remains inside one original synchronous source boundary.
       */
      function selectAdoptionCandidates() : readonly InstructionAdoptionPair[] {
        return declaredNames.length === 1 ? selectUnitAdoptionPairs({
          candidates: indexedInstructionCandidates(),
          readRule: readRuleCandidate,
          member: byMember.get(firstInstructionMemberId(declaredNames[0])),
        }) : Object.freeze([]);
      }
      state.unitAdoptionPairs = isBindingSegmentActive() ? selectAdoptionCandidates() : bindingSegment(selectAdoptionCandidates);
    }
    return state.unitAdoptionPairs;
  }
  /**
   Read related selections inside one synchronous dependency boundary.
   */
  function readPolicySelection() : InstructionPolicySelection {
    /**
     Preserve original selection order before freezing its public aggregate.
     */
    function readOriginalPolicySelection() : InstructionPolicySelection {
      return Object.freeze({
        ruleCandidates: indexedRuleCandidates(),
        instructionCandidates: indexedInstructionCandidates(),
        headingContextCandidates: indexedHeadingContextCandidates(),
        unitAdoptionPairs: indexedUnitAdoptionPairs(),
        ruleSourceCoverage: inspectRuleSources(),
      });
    }
    return bindingSegment(readOriginalPolicySelection);
  }
  return {
    ensureRuleBindings,
    indexedRuleCandidates,
    readRuleCandidate,
    indexedInstructionCandidates,
    indexedHeadingContextCandidates,
    inspectRuleSources,
    indexedUnitAdoptionPairs,
    readPolicySelection
  };
}
//endregion

/**
 Source operations retain one original lazy governing-rule owner.
 */
export type InstructionSources = ReturnType<typeof createInstructionSources>;
