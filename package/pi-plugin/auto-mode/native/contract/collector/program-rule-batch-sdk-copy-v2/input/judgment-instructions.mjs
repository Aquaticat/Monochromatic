import {selectUnitAdoptionPairs} from "../../../integration/action-policy/unit-adoption-profile.mjs";
import {createGoverningRuleSet} from "../../../lifecycle/governing-rule-candidates/set.mjs";
import {JudgmentConstructionError} from './judgment-input.mjs';

//region Instruction claims retain original source, member and question identities

/** Own original instruction bindings and their shared semantic claim selectors. */
export function createJudgmentInstructions({
  ready,
  bindingSegment,
  isBindingSegmentActive,
  readJudgmentSources,
  declaredNames,
  byMember,
  bindings,
  knownSelection,
  parsePolicy,
  receipt,
  issue
}) {
  const instructionBindings=new WeakMap(),instructionPairs=new WeakMap(),instructionMeaningPairs=new WeakMap(),programInstructionPairs=new WeakMap();
  const retained={ruleBindings:undefined,unitAdoptionPairs:undefined,requestMaterialBinding:undefined};
  /** Publish a binding once after its original source and member checks succeed. */
  function retainInstructionHandle({map,key,createRecord}) {
    const existing=map.get(key);
    if(existing)return existing;
    const bindingHandle=Object.freeze({});
    instructionBindings.set(bindingHandle,createRecord());
    map.set(key,bindingHandle);
    return bindingHandle;
  }
  /** Each member owns a separate original rule-to-claim mapping. */
  function memberInstructionPairs(member) {
    const existing=instructionPairs.get(member);
    if(existing)return existing;
    const pairs=new WeakMap();
    instructionPairs.set(member,pairs);
    return pairs;
  }
function resolveBinding(bindingHandle){
      ready();const instruction=instructionBindings.get(bindingHandle);
      if(instruction){
        if(instruction.kind==='unit-adoption'){
          if(!bindings.has(instruction.member)||retained.ruleBindings.read(instruction.adopter)!==instruction.adopterProjection||retained.ruleBindings.read(instruction.target)!==instruction.targetProjection)throw new JudgmentConstructionError('Unit adoption lost its original member or source units');
          return instruction.binding;
        }
        if(instruction.kind==='whole-request-material'){
          if(instruction.request!==receipt.request)throw new JudgmentConstructionError('Whole-request material lost its original request occurrence');
          return instruction.binding;
        }
        if((instruction.member!==undefined&&!bindings.has(instruction.member))||retained.ruleBindings.read(instruction.rule)!==instruction.projection)throw new JudgmentConstructionError('Instruction claim lost its original member or source clause');
        return instruction.binding;
      }
      const value=bindings.get(bindingHandle);if(!value)throw new JudgmentConstructionError('Prepared member binding is not owned by this judgment');return value.binding;
    }
function indexedUnitAdoptionPairs(){
      ready();
      if(!retained.unitAdoptionPairs){
        function selectAdoptionCandidates() { return (declaredNames.length===1?selectUnitAdoptionPairs({
          candidates:indexedInstructionCandidates(),readRule:readRuleCandidate,member:byMember.get(declaredNames[0].id)
        }):Object.freeze([])); }
        retained.unitAdoptionPairs=isBindingSegmentActive()?selectAdoptionCandidates():bindingSegment(selectAdoptionCandidates);
      }
      return retained.unitAdoptionPairs;
    }
function claimUnitAdoption({pair}){
      if(!indexedUnitAdoptionPairs().includes(pair))throw new JudgmentConstructionError('Unit adoption requires an original selected pair from this judgment');
      const {adopter,target,member}=pair;
      const adopterProjection=ensureRuleBindings().read(adopter),targetProjection=ensureRuleBindings().read(target);
      const memberRecord=bindings.get(member);
      if(!memberRecord||adopterProjection.sourceOccurrence!==targetProjection.sourceOccurrence)throw new JudgmentConstructionError('Unit adoption requires its original member and same-source units');
      const bindingHandle=retainInstructionHandle({map:programInstructionPairs,key:pair,createRecord(){
        const binding=Object.freeze({identity:pair,projection:Object.freeze({
          claimScope:'member-unit-adoption',member,memberOrdinal:memberRecord.binding.projection.memberOrdinal,adopter:adopterProjection,target:targetProjection
        })});
        return {kind:'unit-adoption',member,adopter,target,adopterProjection,targetProjection,binding};
      }});
      return knownSelection().declare({definitionId:'unit_adoption',bindingHandle});
    }
function requestMaterialFor(){ready();return receipt.request;}
function claimRequestMaterial(){
      ready();
      if(!retained.requestMaterialBinding){
        retained.requestMaterialBinding=Object.freeze({});
        const request=receipt.request;
        const binding=Object.freeze({identity:request,projection:Object.freeze({claimScope:'program-request',requestMaterial:request})});
        instructionBindings.set(retained.requestMaterialBinding,{kind:'whole-request-material',request,binding});
      }
      return knownSelection().declare({definitionId:'request_instruction_content',bindingHandle:retained.requestMaterialBinding});
    }
function claimHeadingContext({candidate}){
      const projection=ensureRuleBindings().read(candidate);
      if(projection.kind!=='source-heading-context')throw new JudgmentConstructionError('Heading content requires an original contextual-heading group');
      const bindingHandle=retainInstructionHandle({map:programInstructionPairs,key:candidate,createRecord(){
        const binding=Object.freeze({identity:candidate,projection:Object.freeze({claimScope:'program-heading-context',headingContext:projection})});
        return {member:undefined,rule:candidate,projection,binding};
      }});
      return knownSelection().declare({definitionId:'heading_instruction_content',bindingHandle});
    }
function issueBoundPolicyBatch({clauseRelations,requestMaterial,headingContexts=false,unitAdoptions=false}){
      if(typeof clauseRelations!=='boolean'||typeof requestMaterial!=='boolean'||typeof headingContexts!=='boolean'||typeof unitAdoptions!=='boolean'||(!clauseRelations&&!requestMaterial&&!headingContexts&&!unitAdoptions))throw new JudgmentConstructionError('Bound policy batch requires explicit code-selected semantic uses');
      const candidates=clauseRelations?indexedInstructionCandidates():[];
      const headings=headingContexts?indexedHeadingContextCandidates():[];
      const adoptions=unitAdoptions?indexedUnitAdoptionPairs():[];
      if(unitAdoptions&&!adoptions.length)throw new JudgmentConstructionError('No bounded original same-source adoption pairs are available');
      if(clauseRelations&&(candidates.length===0||candidates.length>256))throw new JudgmentConstructionError('Clause relation requires one through 256 original instruction candidates');
      if(headingContexts&&(headings.length===0||headings.length>64))throw new JudgmentConstructionError('Heading content requires one through 64 original source groups');
      return bindingSegment(function buildRuleAssessmentClaims() {
        const claims=candidates.map(function claimOperationRelation(rule) { return (claimProgramRuleCandidate({definitionId:'clause_operation_relation',rule})); });
        if(requestMaterial)claims.push(claimRequestMaterial());
        for(const candidate of headings)claims.push(claimHeadingContext({candidate}));
        for(const pair of adoptions)claims.push(claimUnitAdoption({pair}));
        return issue(claims);
      });
    }
function claim({definitionId,memberId}){ready();if(['request_instruction_content','heading_instruction_content','unit_adoption'].includes(definitionId))throw new JudgmentConstructionError('Whole-request material requires its original request selector; heading content requires its original source-group selector');if(definitionId==='operation_violates_rule')throw new JudgmentConstructionError('Whole-program rule relation requires claimProgramRuleCandidate');if(definitionId==='states_approval_prerequisite')throw new JudgmentConstructionError('Instruction meaning requires claimInstruction and its original clause');const bindingHandle=byMember.get(memberId);if(!bindingHandle)throw new JudgmentConstructionError('Requested member was not in the prepared native group');return knownSelection().declare({definitionId,bindingHandle});}
function ensureRuleBindings(){
      ready();
      if(!retained.ruleBindings){
        if(typeof parsePolicy!=='function'||!readJudgmentSources().hostGoverningPolicy)throw new JudgmentConstructionError('Original host-selected policy and qualified parser are required for instruction claims');
        function createRuleBindings() { return (createGoverningRuleSet({parse:parsePolicy,readSources:function readGoverningSources() {ready();return readJudgmentSources().governingSources;}})); }
        retained.ruleBindings=isBindingSegmentActive()?createRuleBindings():bindingSegment(createRuleBindings);
      }
      return retained.ruleBindings;
    }
/** Enumeration is source-owned selection only, not authority, full-source coverage or permission. */
    function indexedRuleCandidates(){return ensureRuleBindings().indexedCandidates();}
/** Keep nested rule ownership reads inside fresh entry and exit dependency checks. */
function readRuleCandidate(rule){
  function readOwnedRule(){return ensureRuleBindings().read(rule);}
  return isBindingSegmentActive()?readOwnedRule():bindingSegment(readOwnedRule);
}
function indexedInstructionCandidates(){return ensureRuleBindings().indexedInstructionCandidates();}
function indexedHeadingContextCandidates(){return ensureRuleBindings().indexedHeadingContextCandidates();}
function inspectRuleSources(){return ensureRuleBindings().inspect();}
/** Read related original selections inside one synchronous dependency boundary. */
function readPolicySelection(){
  return bindingSegment(function readOriginalPolicySelection(){
    return Object.freeze({
      ruleCandidates:indexedRuleCandidates(),
      instructionCandidates:indexedInstructionCandidates(),
      headingContextCandidates:indexedHeadingContextCandidates(),
      unitAdoptionPairs:indexedUnitAdoptionPairs(),
      ruleSourceCoverage:inspectRuleSources()
    });
  });
}
/** Canonical whole original program/rule identity cannot be resampled through another member. */
    function claimProgramRuleCandidate({definitionId,rule}){
      if(!['operation_violates_rule','clause_operation_relation'].includes(definitionId))throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');
      const projection=ensureRuleBindings().read(rule);
      if(projection.kind==='source-heading-context')throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');
      const bindingHandle=retainInstructionHandle({map:programInstructionPairs,key:rule,createRecord(){
        const binding=Object.freeze({identity:Object.freeze({}),projection:Object.freeze({claimScope:'program-instruction',governingRule:projection})});
        return {member:undefined,rule,projection,binding};
      }});
      return knownSelection().declare({definitionId,bindingHandle});
    }
/** Enumerate and issue all original indexed program/rule claims under one synchronous source boundary. */
    function issueProgramRuleBatch({definitionId}){
      if(!['operation_violates_rule','clause_operation_relation'].includes(definitionId))throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');
      const candidates=definitionId==='clause_operation_relation'?indexedInstructionCandidates():indexedRuleCandidates();
      if(definitionId==='clause_operation_relation'&&(candidates.length===0||candidates.length>256))throw new JudgmentConstructionError('Clause relation requires one through 256 indexed clauses');
      return bindingSegment(function issueCandidateClaims() { return (issue(candidates.map(function claimCandidateRule(rule) { return (claimProgramRuleCandidate({definitionId,rule})); }))); });
    }
/** Issue fixed independent relation types together inside the existing synchronous binding segment. */
    function issueRuleAssessmentBatch(){
      const candidates=indexedRuleCandidates();
      if(candidates.length===0||candidates.length>256)throw new JudgmentConstructionError('Mixed rule assessment requires one through 256 indexed clauses; unclassified prose and larger batches remain unsupported');
      return bindingSegment(function buildApprovalMeaningClaims() {
        const meanings=candidates.map(function claimApprovalMeaning(rule) { return (claimRuleCandidate({definitionId:'states_approval_prerequisite',memberId:declaredNames[0].id,rule})); });
        const operations=candidates.map(function claimOperationViolation(rule) { return (claimProgramRuleCandidate({definitionId:'operation_violates_rule',rule})); });
        return issue([...meanings,...operations]);
      });
    }
function claimRuleCandidate({definitionId,memberId,rule}){
      ensureRuleBindings().read(rule);
      return claimSelectedInstruction({definitionId,memberId,rule});
    }
function claimInstruction({definitionId,memberId,ruleCode}){
      return claimSelectedInstruction({definitionId,memberId,rule:ensureRuleBindings().select(ruleCode)});
    }
function claimSelectedInstruction({definitionId,memberId,rule}){
      ready();if(['operation_violates_rule','clause_operation_relation','request_instruction_content','heading_instruction_content','unit_adoption'].includes(definitionId))throw new JudgmentConstructionError('Whole-program rule relation cannot be selected through a member');const member=byMember.get(memberId);
      if(!member)throw new JudgmentConstructionError('Instruction claim member is outside the original prepared group');
      ensureRuleBindings();
      const projection=retained.ruleBindings.read(rule);
      if(projection.kind==='source-heading-context')throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');
      const instructionOnly=definitionId==='states_approval_prerequisite';
      const pairs=instructionOnly?instructionMeaningPairs:memberInstructionPairs(member);
      const bindingHandle=retainInstructionHandle({map:pairs,key:rule,createRecord(){
        const memberRecord=bindings.get(member),claimProjection=instructionOnly?{claimScope:'instruction',governingRule:projection}:{...memberRecord.binding.projection,governingRule:projection};
        const binding=Object.freeze({identity:Object.freeze({}),projection:Object.freeze(claimProjection)});
        return {member:instructionOnly?undefined:member,rule,projection,binding};
      }});
      return knownSelection().declare({definitionId,bindingHandle});
    }
  return Object.freeze({
    resolveBinding,
    indexedUnitAdoptionPairs,
    claimUnitAdoption,
    requestMaterialFor,
    claimRequestMaterial,
    claimHeadingContext,
    issueBoundPolicyBatch,
    claim,
    indexedRuleCandidates,
    readRuleCandidate,
    indexedInstructionCandidates,
    indexedHeadingContextCandidates,
    inspectRuleSources,
    readPolicySelection,
    claimProgramRuleCandidate,
    issueProgramRuleBatch,
    issueRuleAssessmentBatch,
    claimRuleCandidate,
    claimInstruction
  });
}

//endregion Instruction claims retain original source, member and question identities
