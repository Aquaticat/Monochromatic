import assert from 'node:assert/strict';

function once({
  source,
  before,
  after
}){
 assert.equal(
   source.split(before)
     .length,
   2,
   `Original judgment multi-source edit: ${before}`
 );
 return source.replace(
   before,
   after
 );
}

/** Keep the incumbent judgment implementation and budget; extend its internal rule owner only. */
export function judgmentSource({
  source,
  indexUrl
}){
 const first=source.split('\n')[0];
 let value=once({
   source,
   before:first,
   after:`import {createGoverningRuleSet} from ${JSON.stringify(indexUrl)};`
 });
 value=once({
   source:value,
   before:'import {createQuestionSelection} from ',
   after:'import {createQuestionSelection,readAssessmentResponse} from '
 });
 value=once({
   source:value,
   before:'const input={producerOwner,observer,stream,response},receipt=readMainAgentRequest(input);',
   after:'const input={producerOwner,observer,stream,response};\n    const sourceBinding=observer.bindJudgmentSources?.(response);\n    const receipt=readMainAgentRequest(input),judgmentSources=sourceBinding?.sources??receipt.sources;\n    if(sourceBinding&&sourceBinding.request!==receipt)throw new JudgmentConstructionError("Judgment sources do not belong to the original request receipt");'
 });
 value=once({
   source:value,
   before:'const mandatoryPolicy=receipt.sources.mandatoryPolicy;',
   after:'const mandatoryPolicy=judgmentSources.mandatoryPolicy;'
 });
 value=once({
   source:value,
   before:"if(typeof parsePolicy!=='function'||!receipt.sources.hostGoverningPolicy)",
   after:"if(typeof parsePolicy!=='function'||!judgmentSources.hostGoverningPolicy)"
 });
 value=once({
   source:value,
   before:'        const answerText=await budget.dispatch(attempt=>send(Object.freeze({request,...attempt})));\n        return bindingSegment(()=>selection.settle({batch,answerText}));',
   after:'        const answer=await budget.dispatch(attempt=>send(Object.freeze({request,...attempt})));\n        return bindingSegment(()=>selection.settle({batch,...readAssessmentResponse(answer)}));'
 });
 value=once({
   source:value,
   before:"const envelope=Object.freeze({parentJSON,preparedJSON,requestBody:receipt.request.body,mandatoryPolicy,instructionAuthority:'not-established'});",
   after:"const envelope=Object.freeze({parentJSON,preparedJSON,requestBody:receipt.request.body,mandatoryPolicy,governingSources:judgmentSources.governingSources,instructionAuthority:'not-established'});"
 });
 value=once({
   source:value,
   before:"ruleBindings=createGoverningRuleBindings({parse:parsePolicy,readSource:()=>{ready();return receipt.sources.hostGoverningPolicy;}});",
   after:"const indexSources=()=>createGoverningRuleSet({parse:parsePolicy,readSources:()=>{ready();return judgmentSources.governingSources;}});\n        ruleBindings=bindingSegmentActive?indexSources():bindingSegment(indexSources);"
 });
 value=once({
   source:value,
   before:'      if(instruction){',
   after:`      if(instruction){
        if(instruction.kind==='unit-adoption'){
          if(!bindings.has(instruction.member)||ruleBindings.read(instruction.adopter)!==instruction.adopterProjection||ruleBindings.read(instruction.target)!==instruction.targetProjection)throw new JudgmentConstructionError('Unit adoption lost its original member or source units');
          return instruction.binding;
        }
        if(instruction.kind==='whole-request-material'){
          if(instruction.request!==receipt.request)throw new JudgmentConstructionError('Whole-request material lost its original request occurrence');
          return instruction.binding;
        }`
 });
 value=once({
   source:value,
   before:'    function knownSelection(){',
   after:`    let unitAdoptionPairs;
    function indexedUnitAdoptionPairs(){
      ready();
      if(!unitAdoptionPairs){
        const selectPairs=()=>declaredNames.length===1?selectUnitAdoptionPairs({
          candidates:indexedInstructionCandidates(),readRule:readRuleCandidate,member:byMember.get(declaredNames[0].id)
        }):Object.freeze([]);
        unitAdoptionPairs=bindingSegmentActive?selectPairs():bindingSegment(selectPairs);
      }
      return unitAdoptionPairs;
    }
    function claimUnitAdoption({pair}){
      if(!indexedUnitAdoptionPairs().includes(pair))throw new JudgmentConstructionError('Unit adoption requires an original selected pair from this judgment');
      const {adopter,target,member}=pair;
      const adopterProjection=ensureRuleBindings().read(adopter),targetProjection=ensureRuleBindings().read(target);
      const memberRecord=bindings.get(member);
      if(!memberRecord||adopterProjection.sourceOccurrence!==targetProjection.sourceOccurrence)throw new JudgmentConstructionError('Unit adoption requires its original member and same-source units');
      let bindingHandle=programInstructionPairs.get(pair);
      if(!bindingHandle){
        bindingHandle=Object.freeze({});
        const binding=Object.freeze({identity:pair,projection:Object.freeze({
          claimScope:'member-unit-adoption',member,memberOrdinal:memberRecord.binding.projection.memberOrdinal,adopter:adopterProjection,target:targetProjection
        })});
        instructionBindings.set(bindingHandle,{kind:'unit-adoption',member,adopter,target,adopterProjection,targetProjection,binding});
        programInstructionPairs.set(pair,bindingHandle);
      }
      return knownSelection().declare({definitionId:'unit_adoption',bindingHandle});
    }
    let requestMaterialBinding;
    function requestMaterialFor(){ready();return receipt.request;}
    function claimRequestMaterial(){
      ready();
      if(!requestMaterialBinding){
        requestMaterialBinding=Object.freeze({});
        const request=receipt.request;
        const binding=Object.freeze({identity:request,projection:Object.freeze({claimScope:'program-request',requestMaterial:request})});
        instructionBindings.set(requestMaterialBinding,{kind:'whole-request-material',request,binding});
      }
      return knownSelection().declare({definitionId:'request_instruction_content',bindingHandle:requestMaterialBinding});
    }
    function claimHeadingContext({candidate}){
      const projection=ensureRuleBindings().read(candidate);
      if(projection.kind!=='source-heading-context')throw new JudgmentConstructionError('Heading content requires an original contextual-heading group');
      let bindingHandle=programInstructionPairs.get(candidate);
      if(!bindingHandle){
        bindingHandle=Object.freeze({});
        const binding=Object.freeze({identity:candidate,projection:Object.freeze({claimScope:'program-heading-context',headingContext:projection})});
        instructionBindings.set(bindingHandle,{member:undefined,rule:candidate,projection,binding});
        programInstructionPairs.set(candidate,bindingHandle);
      }
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
      return bindingSegment(()=>{
        const claims=candidates.map(rule=>claimProgramRuleCandidate({definitionId:'clause_operation_relation',rule}));
        if(requestMaterial)claims.push(claimRequestMaterial());
        for(const candidate of headings)claims.push(claimHeadingContext({candidate}));
        for(const pair of adoptions)claims.push(claimUnitAdoption({pair}));
        return issue(claims);
      });
    }
    function knownSelection(){`
 });
 value=once({
   source:value,
   before:'    function claim({definitionId,memberId}){ready();',
   after:"    function claim({definitionId,memberId}){ready();if(['request_instruction_content','heading_instruction_content','unit_adoption'].includes(definitionId))throw new JudgmentConstructionError('Whole-request material requires its original request selector; heading content requires its original source-group selector');"
 });
 value=once({
   source:value,
   before:"    function readRuleCandidate(rule){return ensureRuleBindings().read(rule);}",
   after:"    function readRuleCandidate(rule){return ensureRuleBindings().read(rule);}\n    function indexedInstructionCandidates(){return ensureRuleBindings().indexedInstructionCandidates();}\n    function indexedHeadingContextCandidates(){return ensureRuleBindings().indexedHeadingContextCandidates();}\n    function inspectRuleSources(){return ensureRuleBindings().inspect();}"
 });
 value=once({
   source:value,
   before:"      const projection=ensureRuleBindings().read(rule);\n      return claimInstruction({definitionId,memberId,ruleCode:projection.code});",
   after:"      ensureRuleBindings().read(rule);\n      return claimSelectedInstruction({definitionId,memberId,rule});"
 });
 value=once({
   source:value,
   before:"    function claimInstruction({definitionId,memberId,ruleCode}){\n      ready();",
   after:"    function claimInstruction({definitionId,memberId,ruleCode}){\n      return claimSelectedInstruction({definitionId,memberId,rule:ensureRuleBindings().select(ruleCode)});\n    }\n    function claimSelectedInstruction({definitionId,memberId,rule}){\n      ready();"
 });
 value=once({
   source:value,
   before:"      const rule=ruleBindings.select(ruleCode),projection=ruleBindings.read(rule);",
   after:"      const projection=ruleBindings.read(rule);\n      if(projection.kind==='source-heading-context')throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');"
 });
 value=once({
   source:value,
   before:"    /** Authenticate original batch and terminal phase before any eligibility failure can be retained. */",
   after:`    /** Issue fixed independent relation types together inside the existing synchronous binding segment. */
    function issueRuleAssessmentBatch(){
      const candidates=indexedRuleCandidates();
      if(candidates.length===0||candidates.length>256)throw new JudgmentConstructionError('Mixed rule assessment requires one through 256 indexed clauses; unclassified prose and larger batches remain unsupported');
      return bindingSegment(()=>{
        const meanings=candidates.map(rule=>claimRuleCandidate({definitionId:'states_approval_prerequisite',memberId:declaredNames[0].id,rule}));
        const operations=candidates.map(rule=>claimProgramRuleCandidate({definitionId:'operation_violates_rule',rule}));
        return issue([...meanings,...operations]);
      });
    }
    /** Authenticate original batch and terminal phase before any eligibility failure can be retained. */`
 });
 value=once({
   source:value,
   before:"indexedRuleCandidates:()=>operation(indexedRuleCandidates),",
   after:"sourceSnapshot:judgmentSources,indexedUnitAdoptionPairs:()=>operation(indexedUnitAdoptionPairs),claimUnitAdoption:input=>operation(()=>claimUnitAdoption(input)),requestMaterialFor:()=>operation(requestMaterialFor),claimRequestMaterial:()=>operation(claimRequestMaterial),claimHeadingContext:input=>operation(()=>claimHeadingContext(input)),issueBoundPolicyBatch:input=>operation(()=>issueBoundPolicyBatch(input)),indexedRuleCandidates:()=>operation(indexedRuleCandidates),indexedInstructionCandidates:()=>operation(indexedInstructionCandidates),indexedHeadingContextCandidates:()=>operation(indexedHeadingContextCandidates),inspectRuleSources:()=>operation(inspectRuleSources),issueRuleAssessmentBatch:()=>operation(issueRuleAssessmentBatch),"
 });
 value=once({
   source:value,
   before:'      const projection=ensureRuleBindings().read(rule);\n      let bindingHandle=programInstructionPairs.get(rule);',
   after:"      const projection=ensureRuleBindings().read(rule);\n      if(projection.kind==='source-heading-context')throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');\n      let bindingHandle=programInstructionPairs.get(rule);"
 });
 const programGuard="if(definitionId!=='operation_violates_rule')throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');";
 assert.equal(
   value.split(programGuard)
     .length,
   3,
   'Original program relation guards'
 );
 value=value.replaceAll(
   programGuard,
   "if(!['operation_violates_rule','clause_operation_relation'].includes(definitionId))throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');"
 );
 value=once({
   source:value,
   before:"if(definitionId==='operation_violates_rule')throw new JudgmentConstructionError('Whole-program rule relation cannot be selected through a member');",
   after:"if(['operation_violates_rule','clause_operation_relation','request_instruction_content','heading_instruction_content','unit_adoption'].includes(definitionId))throw new JudgmentConstructionError('Whole-program rule relation cannot be selected through a member');"
 });
 value=once({
   source:value,
   before:"      const candidates=indexedRuleCandidates();\n      return bindingSegment(()=>issue(candidates.map(rule=>claimProgramRuleCandidate({definitionId,rule}))));",
   after:"      const candidates=definitionId==='clause_operation_relation'?indexedInstructionCandidates():indexedRuleCandidates();\n      if(definitionId==='clause_operation_relation'&&(candidates.length===0||candidates.length>256))throw new JudgmentConstructionError('Clause relation requires one through 256 indexed clauses');\n      return bindingSegment(()=>issue(candidates.map(rule=>claimProgramRuleCandidate({definitionId,rule}))));"
 });
 return `import {selectUnitAdoptionPairs} from ${JSON.stringify(new URL(
   '../action-policy/unit-adoption-profile.mjs',
   import.meta.url
 ).href)};\n${value}`;
}
