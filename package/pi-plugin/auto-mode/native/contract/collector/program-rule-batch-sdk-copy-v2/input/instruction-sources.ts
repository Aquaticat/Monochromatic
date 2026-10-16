/**
 Lazy original policy selection stays inside synchronous dependency boundaries. @module
 */
import type {
  InstructionSourceOperations,
  InstructionPolicySelection
} from './instruction-api.ts';
import type {
  GoverningRuleSet,
  GoverningSetInput,
  GoverningSetProjection,
  GoverningSetSnapshot
} from '../../../lifecycle/governing-rule-candidates/set-types.ts';
import type {
  InstructionAdoptionPair,
  InstructionContext
} from './instruction-types.ts';
import { selectUnitAdoptionPairs } from '../../../integration/action-policy/unit-adoption-profile.mjs';
import { createGoverningRuleSet } from '../../../lifecycle/governing-rule-candidates/set-owner.ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { firstInstructionMemberId } from './instruction-ownership.ts';

//region Enumeration selects source-owned structure without establishing authority or permission.
/**
 Retain original source selection and lazy bounded adoption opportunities.

 @param input - original judgment capabilities

 @param state - private lazy owner records

 @returns original source operations
 
 @example createInstructionSources({ input, state });
 */
export function createInstructionSources({
  input,
  state
}: InstructionContext) : InstructionSourceOperations {
  /**
   Original judgment capabilities remain borrowed without reading lazy request or source content.
   */
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
       Source reads retain the original judgment lifetime check.
       
       @returns exact original governing-source list
       */
      function readGoverningSources() : ReturnType<GoverningSetInput['readSources']> {
        ready();
        /** Current selected inputs are distinct from the retained provenance archive. */
        const sources=readJudgmentSources();
        return sources.decisionContext?.sources ?? sources.governingSources;
      }
/**
   Initialize original governing sources once under the existing dependency segment.
   
   @returns retained original source owner
   */
  function ensureRuleBindings() : GoverningRuleSet {
    ready();
    if (state.ruleBindings) return state.ruleBindings;
      if ((typeof parsePolicy) !== 'function') throw new JudgmentConstructionError('Original host-selected policy and qualified parser are required for instruction claims');
      /**
       Original host selection uses native truthiness after parser admission.
       */
      const hostSelected = Boolean(readJudgmentSources()
        .hostGoverningPolicy);
      if (!hostSelected) throw new JudgmentConstructionError('Original host-selected policy and qualified parser are required for instruction claims');
      /**
       Qualified parser remains narrowed inside original source construction.
       */
      const parse: NonNullable<InstructionContext['input']['parsePolicy']> = parsePolicy;
      
      /**
       Capture original source ownership without moving its publication point.

       @returns new original source owner before publication
       */
      function createRuleBindings(): GoverningRuleSet {
        return createGoverningRuleSet({
          parse,
          excludedRules:readJudgmentSources().decisionContext?.selection?.excluded?.map(function excludedRootRule(rule){return {...rule,sourceOrdinal:0};})??[],
          readSources: readGoverningSources
        });
      }
      state.ruleBindings = isBindingSegmentActive() ? createRuleBindings() : bindingSegment(createRuleBindings);
    return state.ruleBindings;
  }
  /**
   Enumerate original tagged candidates without assigning authority.
   
   @returns original tagged clause handles
   */
  function indexedRuleCandidates() : readonly object[] { 
    return ensureRuleBindings()
      .indexedCandidates(); 
  }
  /**
   Keep original reads inside fresh entry and exit dependency checks.
   
   @returns original source projection
   
   @param rule - original candidate handle
   */
  function readRuleCandidate(rule: object) : GoverningSetProjection {
    /**
     Read the original source projection inside its selected segment.
     
     @returns original authenticated source projection
     */
    function readOwnedRule() : GoverningSetProjection { 
      return ensureRuleBindings()
        .read(rule); 
    }
    return isBindingSegmentActive() ? readOwnedRule() : bindingSegment(readOwnedRule);
  }
  /**
   Retain every original instruction candidate, including unclassified units.
   
   @returns all original instruction candidate handles
   */
  function indexedInstructionCandidates() : readonly object[] { 
    return ensureRuleBindings()
      .indexedInstructionCandidates(); 
  }
  /**
   Keep contextual heading aggregates distinct from individual clauses.
   
   @returns original contextual-heading aggregate handles
   */
  function indexedHeadingContextCandidates() : readonly object[] { 
    return ensureRuleBindings()
      .indexedHeadingContextCandidates(); 
  }
  /**
   Preserve original structural coverage diagnostics without claiming authority.
   
   @returns retained original structural coverage records
   */
  function inspectRuleSources() : readonly GoverningSetSnapshot[] { 
    return ensureRuleBindings()
      .inspect(); 
  }
  /**
       Selection remains inside one original synchronous source boundary.
       
       @returns original bounded structural opportunities
       */
      function selectAdoptionCandidates() : readonly InstructionAdoptionPair[] {
        return declaredNames.length === 1 ? selectUnitAdoptionPairs({
          candidates: indexedInstructionCandidates(),
          readRule: readRuleCandidate,
          member: byMember.get(firstInstructionMemberId(declaredNames[0])),
        }) : Object.freeze([]);
      }
/**
   Select structural opportunities only for the original sole declared member.
   
   @returns retained original structural opportunities
   */
  function indexedUnitAdoptionPairs() : readonly InstructionAdoptionPair[] {
    ready();
    if (state.unitAdoptionPairs) return state.unitAdoptionPairs;
    state.unitAdoptionPairs = isBindingSegmentActive() ? selectAdoptionCandidates() : bindingSegment(selectAdoptionCandidates);
    return state.unitAdoptionPairs;
  }
  /**
     Preserve original selection order before freezing its public aggregate.
     
     @returns frozen original candidate and coverage aggregate
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
/**
   Read related selections inside one synchronous dependency boundary.
   
   @returns original selection from one synchronous source boundary
   */
  function readPolicySelection() : InstructionPolicySelection {
    
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
