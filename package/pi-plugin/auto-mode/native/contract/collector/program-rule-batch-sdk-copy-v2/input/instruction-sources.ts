/**
 Lazy original policy selection stays inside synchronous dependency boundaries. @module
 */
import { selectUnitAdoptionPairs } from '../../../integration/action-policy/unit-adoption-profile.mjs';
import { createGoverningRuleSet } from '../../../lifecycle/governing-rule-candidates/set-owner.ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import type { InstructionContext } from './instruction-types.ts';

//region Enumeration selects source-owned structure without establishing authority or permission.
/**
 Retain original source selection and lazy bounded adoption opportunities.
 @param input - original judgment capabilities
 @param state - private lazy owner records
 @returns original source operations
 */
export function createInstructionSources({ input, state }: InstructionContext) {
  const { ready, bindingSegment, isBindingSegmentActive, readJudgmentSources, parsePolicy, declaredNames, byMember } = input;
  /** Initialize original governing sources once under the existing dependency segment. */
  function ensureRuleBindings() {
    ready();
    if (!state.ruleBindings) {
      if ((typeof parsePolicy !== 'function') || !readJudgmentSources().hostGoverningPolicy) throw new JudgmentConstructionError('Original host-selected policy and qualified parser are required for instruction claims');
      /** Source reads retain the original judgment lifetime check. */
      function readGoverningSources() {
        ready();
        return readJudgmentSources().governingSources;
      }
      /** Capture original source ownership without moving its publication point. */
      function createRuleBindings() {
        return createGoverningRuleSet({ parse: parsePolicy, readSources: readGoverningSources });
      }
      state.ruleBindings = isBindingSegmentActive() ? createRuleBindings() : bindingSegment(createRuleBindings);
    }
    return state.ruleBindings;
  }
  /** Enumerate original tagged candidates without assigning authority. */
  function indexedRuleCandidates() { return ensureRuleBindings().indexedCandidates(); }
  /** Keep original reads inside fresh entry and exit dependency checks. */
  function readRuleCandidate(rule: object) {
    /** Read the original source projection inside its selected segment. */
    function readOwnedRule() { return ensureRuleBindings().read(rule); }
    return isBindingSegmentActive() ? readOwnedRule() : bindingSegment(readOwnedRule);
  }
  /** Retain every original instruction candidate, including unclassified units. */
  function indexedInstructionCandidates() { return ensureRuleBindings().indexedInstructionCandidates(); }
  /** Keep contextual heading aggregates distinct from individual clauses. */
  function indexedHeadingContextCandidates() { return ensureRuleBindings().indexedHeadingContextCandidates(); }
  /** Preserve original structural coverage diagnostics without claiming authority. */
  function inspectRuleSources() { return ensureRuleBindings().inspect(); }
  /** Select structural opportunities only for the original sole declared member. */
  function indexedUnitAdoptionPairs() {
    ready();
    if (!state.unitAdoptionPairs) {
      /** Selection remains inside one original synchronous source boundary. */
      function selectAdoptionCandidates() {
        return declaredNames.length === 1 ? selectUnitAdoptionPairs({
          candidates: indexedInstructionCandidates(), readRule: readRuleCandidate, member: byMember.get(declaredNames[0].id),
        }) : Object.freeze([]);
      }
      state.unitAdoptionPairs = isBindingSegmentActive() ? selectAdoptionCandidates() : bindingSegment(selectAdoptionCandidates);
    }
    return state.unitAdoptionPairs;
  }
  /** Read related selections inside one synchronous dependency boundary. */
  function readPolicySelection() {
    /** Preserve original selection order before freezing its public aggregate. */
    function readOriginalPolicySelection() {
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
  return { ensureRuleBindings, indexedRuleCandidates, readRuleCandidate, indexedInstructionCandidates, indexedHeadingContextCandidates, inspectRuleSources, indexedUnitAdoptionPairs, readPolicySelection };
}
//endregion

/** Source operations retain one original lazy governing-rule owner. */
export type InstructionSources = ReturnType<typeof createInstructionSources>;
