/**
 Retain original judgment budgets and bindings while extending their governing source collection.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { replaceOnce } from './build-rebase.ts';
import { NativeBatchBuildError } from './build-entries.ts';

//region Judgment source transformations retain original request and selection ownership

/**
 Judgment preparation diagnostics remain distinct from runtime policy decisions.
 */
const l = tagged({ tag: 'auto-mode-native-judgment-source' });

/**
 The original judgment contains separate whole-program relation gates at selection and issuance.
 */
const EXPECTED_PROGRAM_RELATION_GUARDS = 2;



/**
 Retain the original judgment implementation and budget while extending its internal source bindings.

 @param source - qualified original judgment constructor module

 @param indexUrl - governing source index retaining original rule occurrences

 @returns generated judgment with original request, policy source, and program bindings

 @throws NativeBatchBuildError when qualified original judgment boundaries change

 @example
 ```ts
 const generated = judgmentSource({ source, indexUrl });
 ```
 */
export function judgmentSource({
  source,
  indexUrl
}: {
  readonly source: string;
  readonly indexUrl: string
}): string {
 /**
  Each original judgment source transformation retains its diagnostic boundary.
  */
 const rl = tagged({
   tag: judgmentSource.name,
   l
 });
 rl.debug('preparing original judgment source bindings');
 /**
  The first original declaration is the qualified governing index import site.
  */
 const first=nonNullishOrThrow(source.split('\n')[0]);
 /**
  Original governing index resolution retains its captured module identity.
  */
 const governingIndex=replaceOnce({
   source,
   from:first,
   to:`import {createGoverningRuleSet} from ${JSON.stringify(indexUrl)};`
 });
 /**
  Assessment settlement retains the original response reader beside question selection.
  */
 const assessmentResponse=replaceOnce({
   source:governingIndex,
   from:'import {createQuestionSelection} from ',
   to:'import {createQuestionSelection,readAssessmentResponse} from '
 });
 /**
  Judgment sources remain attached to the original request receipt.
  */
 const boundSources=replaceOnce({
   source:assessmentResponse,
   from:'const input={producerOwner,observer,stream,response},receipt=readMainAgentRequest(input);',
   to:'const input={producerOwner,observer,stream,response};\n    const sourceBinding=observer.beginJudgmentSources?observer.beginJudgmentSources(response):observer.bindJudgmentSources?.(response);\n    const receipt=readMainAgentRequest(input);\n    let judgmentSources=sourceBinding?.sources??receipt.sources;\n    if(sourceBinding&&sourceBinding.request!==receipt)throw new JudgmentConstructionError("Judgment sources do not belong to the original request receipt");'
 });
 /**
  Mandatory policy reads use the retained governing source snapshot.
  */
 const sealedSources=replaceOnce({
   source:boundSources,
   from:'        const dependencyHandle=facade.prepare({signal});',
   to:'        if(observer.beginJudgmentSources){const binding=observer.sealJudgmentSources(response);if(binding.request!==receipt)throw new JudgmentConstructionError("Prepared sources lost their original request receipt");judgmentSources=binding.sources;}\n        const dependencyHandle=facade.prepare({signal});'
 });
 /**
  Dependency checks retain the same assessed collection rather than taking an independent source snapshot.
  */
 const sharedDependencySources=replaceOnce({
   source:sealedSources,
   from:'const facade=createDependencyFacade({collector,rootAdapter,',
   to:`const judgmentCollector=Object.freeze({
      capture(options){
        if(options.signal!==signal)throw new JudgmentConstructionError('Dependency sources require original judgment cancellation');
        collector.assertObservedFresh(judgmentSources);
        return judgmentSources;
      },
      assertObservedFresh(snapshot){
        if(snapshot!==judgmentSources)throw new JudgmentConstructionError('Dependencies require the original assessed source collection');
        collector.assertObservedFresh(snapshot);
      }
    });
    const facade=createDependencyFacade({collector:judgmentCollector,rootAdapter,`
 });
 /** Mandatory policy and source selection use the final prepared collection. */
 const mandatorySource=replaceOnce({
   source:sharedDependencySources,
   from:'const mandatoryPolicy=receipt.sources.mandatoryPolicy;',
   to:'const mandatoryPolicy=judgmentSources.mandatoryPolicy;'
 });
 /**
  Host policy availability is checked in the same retained source snapshot.
  */
 const hostSource=replaceOnce({
   source:mandatorySource,
   from:"if(typeof parsePolicy!=='function'||!receipt.sources.hostGoverningPolicy)",
   to:"if(typeof parsePolicy!=='function'||!judgmentSources.hostGoverningPolicy)"
 });
 /**
  Settlement consumes the original response together with its assessment metadata.
  */
 const settledResponse=replaceOnce({
   source:hostSource,
   from:'        const answerText=await budget.dispatch(attempt=>send(Object.freeze({request,...attempt})));\n        return bindingSegment(()=>selection.settle({batch,answerText}));',
   to:'        const answer=await budget.dispatch(attempt=>send(Object.freeze({request,...attempt})));\n        return bindingSegment(()=>selection.settle({batch,...readAssessmentResponse(answer)}));'
 });
 /**
  The original request envelope carries the complete governing source collection.
  */
 const sourceEnvelope=replaceOnce({
   source:settledResponse,
   from:"const envelope=Object.freeze({parentJSON,preparedJSON,requestBody:receipt.request.body,mandatoryPolicy,instructionAuthority:'not-established'});",
   to:"const envelope=Object.freeze({parentJSON,preparedJSON,requestBody:receipt.request.body,mandatoryPolicy,governingSources:judgmentSources.governingSources,instructionAuthority:'not-established'});"
 });
 /**
  Rule indexing stays inside the original synchronous binding segment.
  */
 const indexedSources=replaceOnce({
   source:sourceEnvelope,
   from:"ruleBindings=createGoverningRuleBindings({parse:parsePolicy,readSource:()=>{ready();return receipt.sources.hostGoverningPolicy;}});",
   to:"const indexSources=()=>createGoverningRuleSet({parse:parsePolicy,readSources:()=>{ready();return judgmentSources.governingSources;}});\n        ruleBindings=bindingSegmentActive?indexSources():bindingSegment(indexSources);"
 });
 /**
  Unit adoption and request material bindings retain their original source occurrences.
  */
 const bindingOwners=replaceOnce({
   source:indexedSources,
   from:'      if(instruction){',
   to:`      if(instruction){
        if(instruction.kind==='unit-adoption'){
          if(!bindings.has(instruction.member)||ruleBindings.read(instruction.adopter)!==instruction.adopterProjection||ruleBindings.read(instruction.target)!==instruction.targetProjection)throw new JudgmentConstructionError('Unit adoption lost its original member or source units');
          return instruction.binding;
        }
        if(instruction.kind==='whole-request-material'){
          if(instruction.request!==receipt.request)throw new JudgmentConstructionError('Whole-request material lost its original request occurrence');
          return instruction.binding;
        }`
 });
 /**
  Original selector methods bind adoption, request, and heading claims to this judgment.
  */
 const selectionClaims=replaceOnce({
   source:bindingOwners,
   from:'    function knownSelection(){',
   to:`    let unitAdoptionPairs;
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
 /**
  Member selectors cannot supply whole-request, heading, or adoption identities.
  */
 const memberClaims=replaceOnce({
   source:selectionClaims,
   from:'    function claim({definitionId,memberId}){ready();',
   to:"    function claim({definitionId,memberId}){ready();if(['request_instruction_content','heading_instruction_content','unit_adoption'].includes(definitionId))throw new JudgmentConstructionError('Whole-request material requires its original request selector; heading content requires its original source-group selector');"
 });
 /**
  Source candidate views remain available through the original governing rule index.
  */
 const sourceCandidates=replaceOnce({
   source:memberClaims,
   from:"    function readRuleCandidate(rule){return ensureRuleBindings().read(rule);}",
   to:"    function readRuleCandidate(rule){return ensureRuleBindings().read(rule);}\n    function indexedInstructionCandidates(){return ensureRuleBindings().indexedInstructionCandidates();}\n    function indexedHeadingContextCandidates(){return ensureRuleBindings().indexedHeadingContextCandidates();}\n    function inspectRuleSources(){return ensureRuleBindings().inspect();}"
 });
 /**
  Selected candidates retain their source identity rather than being selected again by code.
  */
 const selectedCandidate=replaceOnce({
   source:sourceCandidates,
   from:"      const projection=ensureRuleBindings().read(rule);\n      return claimInstruction({definitionId,memberId,ruleCode:projection.code});",
   to:"      ensureRuleBindings().read(rule);\n      return claimSelectedInstruction({definitionId,memberId,rule});"
 });
 /**
  Legacy instruction selection delegates to the same original candidate binding.
  */
 const selectedInstruction=replaceOnce({
   source:selectedCandidate,
   from:"    function claimInstruction({definitionId,memberId,ruleCode}){\n      ready();",
   to:"    function claimInstruction({definitionId,memberId,ruleCode}){\n      return claimSelectedInstruction({definitionId,memberId,rule:ensureRuleBindings().select(ruleCode)});\n    }\n    function claimSelectedInstruction({definitionId,memberId,rule}){\n      ready();"
 });
 /**
  Contextual headings cannot enter individual clause selection.
  */
 const clauseProjection=replaceOnce({
   source:selectedInstruction,
   from:"      const rule=ruleBindings.select(ruleCode),projection=ruleBindings.read(rule);",
   to:"      const projection=ruleBindings.read(rule);\n      if(projection.kind==='source-heading-context')throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');"
 });
 /**
  Mixed semantic assessments retain the original bounded synchronous issuance.
  */
 const assessmentBatch=replaceOnce({
   source:clauseProjection,
   from:"    /** Authenticate original batch and terminal phase before any eligibility failure can be retained. */",
   to:`    /** Issue fixed independent relation types together inside the existing synchronous binding segment. */
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
 /**
  Public judgment methods expose source-specific selection and inspection bindings.
  */
 const sourceViews=replaceOnce({
   source:assessmentBatch,
   from:"indexedRuleCandidates:()=>operation(indexedRuleCandidates),",
   to:"readSourceSnapshot:()=>judgmentSources,indexedUnitAdoptionPairs:()=>operation(indexedUnitAdoptionPairs),claimUnitAdoption:input=>operation(()=>claimUnitAdoption(input)),requestMaterialFor:()=>operation(requestMaterialFor),claimRequestMaterial:()=>operation(claimRequestMaterial),claimHeadingContext:input=>operation(()=>claimHeadingContext(input)),issueBoundPolicyBatch:input=>operation(()=>issueBoundPolicyBatch(input)),indexedRuleCandidates:()=>operation(indexedRuleCandidates),indexedInstructionCandidates:()=>operation(indexedInstructionCandidates),indexedHeadingContextCandidates:()=>operation(indexedHeadingContextCandidates),inspectRuleSources:()=>operation(inspectRuleSources),issueRuleAssessmentBatch:()=>operation(issueRuleAssessmentBatch),"
 });
 /**
  Whole-program candidate selection retains its original contextual-heading rejection.
  */
 const programGuardSource=replaceOnce({
   source:sourceViews,
   from:'      const projection=ensureRuleBindings().read(rule);\n      let bindingHandle=programInstructionPairs.get(rule);',
   to:"      const projection=ensureRuleBindings().read(rule);\n      if(projection.kind==='source-heading-context')throw new JudgmentConstructionError('Heading groups cannot be selected as individual clauses');\n      let bindingHandle=programInstructionPairs.get(rule);"
 });
 /**
  Both original whole-program selection gates must retain the same definition contract.
  */
 const programGuard="if(definitionId!=='operation_violates_rule')throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');";
 if ((programGuardSource.split(programGuard)
   .length
   - 1)
   !== EXPECTED_PROGRAM_RELATION_GUARDS) throw new NativeBatchBuildError('Original program relation guards must occur exactly twice');
 /**
  The qualified original whole-program gates accept the additional clause relation.
  */
 const programRelations=programGuardSource.replaceAll(
   programGuard,
   "if(!['operation_violates_rule','clause_operation_relation'].includes(definitionId))throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');"
 );
 /**
  Member selection rejects every whole-program and source-level relation.
  */
 const programOnlyClaims=replaceOnce({
   source:programRelations,
   from:"if(definitionId==='operation_violates_rule')throw new JudgmentConstructionError('Whole-program rule relation cannot be selected through a member');",
   to:"if(['operation_violates_rule','clause_operation_relation','request_instruction_content','heading_instruction_content','unit_adoption'].includes(definitionId))throw new JudgmentConstructionError('Whole-program rule relation cannot be selected through a member');"
 });
 /**
  Clause relation batches select the complete bounded original instruction candidates.
  */
 const candidateBatch=replaceOnce({
   source:programOnlyClaims,
   from:"      const candidates=indexedRuleCandidates();\n      return bindingSegment(()=>issue(candidates.map(rule=>claimProgramRuleCandidate({definitionId,rule}))));",
   to:"      const candidates=definitionId==='clause_operation_relation'?indexedInstructionCandidates():indexedRuleCandidates();\n      if(definitionId==='clause_operation_relation'&&(candidates.length===0||candidates.length>256))throw new JudgmentConstructionError('Clause relation requires one through 256 indexed clauses');\n      return bindingSegment(()=>issue(candidates.map(rule=>claimProgramRuleCandidate({definitionId,rule}))));"
 });
 return `import {selectUnitAdoptionPairs} from ${JSON.stringify(new URL(
   '../action-policy/unit-adoption-profile.mjs',
   import.meta.url
 ).href)};\n${candidateBatch}`;
}

//endregion Judgment source transformations retain original request and selection ownership
