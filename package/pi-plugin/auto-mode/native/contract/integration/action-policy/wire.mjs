import {createHash} from 'node:crypto';
import {sourceInputLocation} from '../../lifecycle/governing-rule-candidates/input-location.mjs';
import programCatalog from '../../lifecycle/program-rule-wire/catalog.json' with {type:'json'};
import {questions as meaningCatalog} from '../../research/instruction-prerequisite-relation/cases.mjs';
import {parseBatchAnswer} from '../../research/instruction-prerequisite-relation/protocol.mjs';
import {clauseOperationRelation} from './clause-relation.mjs';
import {requestInstructionContent} from './request-relation.mjs';
import {headingInstructionContent} from './heading-relation.mjs';
import {unitAdoptionRelation} from './unit-adoption-relation.mjs';

export class RuleAssessmentWireError extends Error {
 constructor(message){super(message);this.name=this.constructor
   .name;}
}
/** Fixed serving model checked by the existing response parser; not empirical qualification. */
export const ruleAssessmentModel='typesafe/jev-1.13.0';
const model=ruleAssessmentModel;
const definitions=Object.freeze({
 operation_violates_rule:programCatalog.operation_violates_rule,
 states_approval_prerequisite:meaningCatalog.states_approval_prerequisite,
 clause_operation_relation:clauseOperationRelation,
 request_instruction_content:requestInstructionContent,
 heading_instruction_content:headingInstructionContent,
 unit_adoption:unitAdoptionRelation
});
/** Fixed bootstrap catalog, not model-authored definitions or source authority. */
export const ruleAssessmentCatalogText=JSON.stringify(definitions);
const question='Would carrying out the complete proposed operation violate the selected rule, given the supplied established facts?';
const guidance=definitions.operation_violates_rule
  .instructions
  .slice(question.length+1);
if(!definitions.operation_violates_rule
  .instructions
  .startsWith(question+' '))throw new RuleAssessmentWireError('Operation guidance differs from its fixed definition');
function sha(value){return createHash('sha256')
  .update(value)
  .digest('hex');}

/**
 Serialize one original mixed batch without issuing claims or deciding policy.
 Fixed meaning and operation definitions share complete source/program context.
 Wire ordinals correlate data; only the original judgment authenticates handles.
 */
export function bindRuleAssessmentWire(request){
 const envelope=request?.envelope;
 if((!envelope)||(Object.keys(envelope).toSorted().join(',')!=='governingSources,instructionAuthority,mandatoryPolicy,parentJSON,preparedJSON,requestBody'))throw new RuleAssessmentWireError('Mixed assessment requires the original multi-source envelope');
 for(const field of [
   'parentJSON',
   'preparedJSON',
   'requestBody'
 ])if((typeof envelope[field])!=='string')throw new RuleAssessmentWireError(`Original complete operation field is missing: ${field}`);
 const sources=envelope.governingSources;
 if((!Array.isArray(sources))||(sources.length<1)||(sources.length>128)||(Reflect.ownKeys(sources).length!==sources.length+1))throw new RuleAssessmentWireError('Complete governing source list is unavailable');
 for(let index=0;index<sources.length;index++){
  const field=Object.getOwnPropertyDescriptor(
    sources,
    String(index)
  );
  if((!field)||(!Object.hasOwn(field,'value'))||(typeof field.value?.content)!=='string'||(field.value.sha256!==sha(field.value.content)))throw new RuleAssessmentWireError('Governing source is missing or differs from its captured text');
 }
 if(sources[0]
   .content
   !==envelope.mandatoryPolicy
   ?.content)throw new RuleAssessmentWireError('Primary source differs from mandatory policy');
 const input=request.questions;
 if((!Array.isArray(input))||input.length === 0||(input.length>512)||(Reflect.ownKeys(input).length!==input.length+1))throw new RuleAssessmentWireError('One mixed batch requires one through 512 original claims');
 const questions={},
   pairs=[],
   seen=new Set(),
   clauseRelations=new Set();let hasHeadingContent=false,hasOperation=false,hasRequestMaterial=false,unitAdoptionCount=0;
 for(const [index,head] of input.entries()){
  if((head?.id!=='q'+index)||(!Object.hasOwn(definitions,head.definitionId)))throw new RuleAssessmentWireError('Question identity or definition is unsupported');
  const definition=definitions[head.definitionId],
    operation=head.definitionId!=='states_approval_prerequisite',
    categorical=definition.type==='choice';
  if(JSON.stringify(head.definition)!==JSON.stringify(definition))throw new RuleAssessmentWireError('Fixed question definition changed');
  const {binding} = head;
  if(head.definitionId==='unit_adoption'){
   if((!binding)||(Object.keys(binding).toSorted().join(',')!=='adopter,claimScope,member,memberOrdinal,target')||(binding.claimScope!=='member-unit-adoption')||(binding.memberOrdinal!==0)||(!binding.member)||(!Object.isFrozen(binding.member)))throw new RuleAssessmentWireError('Unit adoption lacks its original single-member pair binding');
   const {
     adopter,
     target
   }=binding;
   if((!adopter)||(!target)||(adopter.sourceOrdinal!==target.sourceOrdinal)||(typeof adopter.code)!=='string'||(target.kind!=='unclassified-source-span')||(target.nodeType!=='blockquote'))throw new RuleAssessmentWireError('Unit adoption requires a tagged adopter and quoted target from the same original source');
   for(const unit of [
     adopter,
     target
   ]){
    const source=sources[unit.sourceOrdinal];
    if((!source)||(unit.sourceSHA256!==source.sha256)||(!Number.isSafeInteger(unit.start))||(!Number.isSafeInteger(unit.end))||(unit.start<0)||(unit.end<=unit.start)||(unit.end>source.content.length)||(source.content.slice(unit.start,unit.end)!==unit.text)||(sha(unit.text)!==unit.textSHA256)||(!Array.isArray(unit.headings))||(!unit.headings.every(function isHeadingText(heading) { return (typeof heading==='string'); })))throw new RuleAssessmentWireError('Adoption unit differs from its original source span');
   }
   const key=head.definitionId+':'
     +adopter.sourceOrdinal
     +':'
     +adopter.start
     +':'
     +target.start;
   if(seen.has(key))throw new RuleAssessmentWireError('Mixed batch repeats an original unit-adoption pair');
   seen.add(key);unitAdoptionCount++;
   if(unitAdoptionCount>64)throw new RuleAssessmentWireError('Unit adoption exceeds the original source bound');
   function project(unit) { return {sourceOrdinal:unit.sourceOrdinal,start:unit.start,end:unit.end,text:unit.text,headings:unit.headings}; }
   const slot=`head_${index}`;
   questions[slot]={
     type:definition.type,
     instructions:{predicate:'Use unitAdoptionDefinition in shared state for the complete adopter and exact quoted target. Authority and scope eligibility are code-owned.',memberOrdinal:binding.memberOrdinal,selectedAdopter:project(adopter),selectedTarget:project(target)},
     criteria:Object.fromEntries(Object.keys(definition.criteria).map(function initializeAdoptionChoice(label) { return ([label,null]); }))
   };
   pairs.push({
     slot,
     id:head.id,
     type:definition.type
   });
   continue;
  }
  if(head.definitionId==='request_instruction_content'){
   if((!binding)||(Object.keys(binding).toSorted().join(',')!=='claimScope,requestMaterial')||(binding.claimScope!=='program-request')||(binding.requestMaterial?.body!==envelope.requestBody))throw new RuleAssessmentWireError('Whole-request question differs from its retained complete request material');
   if(hasRequestMaterial)throw new RuleAssessmentWireError('Mixed batch repeats the original whole-request material question');
   hasRequestMaterial=true;
   const slot=`head_${index}`;
   questions[slot]={
     type:definition.type,
     instructions:{predicate:'Use requestInstructionDefinition in shared state to assess the complete exact originalRequestBody for this proposal; this is not source authority or governing completeness.',selectedMaterial:'originalRequestBody'},
     criteria:Object.fromEntries(Object.keys(definition.criteria).map(function initializeRequestChoice(label) { return ([label,null]); }))
   };
   pairs.push({
     slot,
     id:head.id,
     type:definition.type
   });
   continue;
  }
  if(head.definitionId==='heading_instruction_content'){
   if((!binding)||(Object.keys(binding).toSorted().join(',')!=='claimScope,headingContext')||(binding.claimScope!=='program-heading-context'))throw new RuleAssessmentWireError('Heading question lacks its original source-group scope');
   const group=binding.headingContext,
     ordinal=group?.sourceOrdinal;
   if((group?.kind!=='source-heading-context')||(!Number.isSafeInteger(ordinal))||(ordinal<0)||(ordinal>=sources.length)||(group.sourceSHA256!==sources[ordinal].sha256)||(!Array.isArray(group.headings))||(group.headings.length===0)||(Reflect.ownKeys(group.headings).length!==group.headings.length+1))throw new RuleAssessmentWireError('Heading content lacks its complete original source group');
   const source=sources[ordinal];
   for(const heading of group.headings){
    if((!Number.isSafeInteger(heading.start))||(!Number.isSafeInteger(heading.end))||(heading.start<0)||(heading.end<=heading.start)||(heading.end>source.content.length)||(typeof heading.text)!=='string'||(source.content.slice(heading.start,heading.end)!==heading.text)||(!Number.isInteger(heading.depth))||(heading.depth<1)||(heading.depth>6))throw new RuleAssessmentWireError('Selected heading differs from its original source span');
   }
   const key=head.definitionId+':'
     +ordinal;
   if(seen.has(key))throw new RuleAssessmentWireError('Mixed batch repeats an original heading-context group');
   seen.add(key);hasHeadingContent=true;
   const slot=`head_${index}`;
   questions[slot]={
     type:definition.type,
     instructions:{predicate:'Use headingInstructionDefinition in shared state for the complete selected source-local heading group; this is not directive lowering or global coverage.',selectedHeadingContext:{sourceOrdinal:ordinal,headings:group.headings}},
     criteria:Object.fromEntries(Object.keys(definition.criteria).map(function initializeHeadingChoice(label) { return ([label,null]); }))
   };
   pairs.push({
     slot,
     id:head.id,
     type:definition.type
   });
   continue;
  }
  if((!binding)||(Object.keys(binding).toSorted().join(',')!=='claimScope,governingRule')||(binding.claimScope!==(operation?'program-instruction':'instruction')))throw new RuleAssessmentWireError('Question scope differs from its original relation definition');
  const rule=binding.governingRule,
    ordinal=rule?.sourceOrdinal;
  if((!Number.isSafeInteger(ordinal))||(ordinal<0)||(ordinal>=sources.length))throw new RuleAssessmentWireError('Selected clause has no original source ordinal');
  const source=sources[ordinal];
  const unclassified=rule.kind==='unclassified-source-span';
  if(unclassified?((rule.code!==undefined)||(head.definitionId!=='clause_operation_relation')||(typeof rule.nodeType)!=='string'||(!rule.nodeType)):((typeof rule.code)!=='string'||(!/^[A-Z0-9]{3}$/.test(rule.code))))throw new RuleAssessmentWireError('Selected instruction candidate has no supported original classification');
  if((rule.sourceSHA256!==source.sha256)||(!Number.isSafeInteger(rule.start))||(!Number.isSafeInteger(rule.end))||(rule.start<0)||(rule.end<=rule.start)||(rule.end>source.content.length)||(source.content.slice(rule.start,rule.end)!==rule.text)||(sha(rule.text)!==rule.textSHA256)||(!Array.isArray(rule.headings))||(!rule.headings.every(function isRuleHeadingText(value) { return (typeof value==='string'); })))throw new RuleAssessmentWireError('Selected clause differs from its complete source');
  const candidateKey=ordinal+':'
    +(unclassified?'span:'+rule.start+':'+rule.end:'code:'+rule.code);
  const key=head.definitionId+':'
    +candidateKey;
  if(seen.has(key))throw new RuleAssessmentWireError('Mixed batch repeats a source-specific logical question');
  seen.add(key);hasOperation||=head.definitionId==='operation_violates_rule';
  if(categorical)clauseRelations.add(candidateKey);
  if(clauseRelations.size>256)throw new RuleAssessmentWireError('Clause interpretation exceeds the fixed 256-clause profile');
  const slot=`head_${index}`,selectedRule={
    ...(unclassified?{kind:rule.kind,nodeType:rule.nodeType,start:rule.start,end:rule.end}:{id:rule.code}),
    sourceOrdinal:ordinal,
    text:rule.text,
    headings:rule.headings
  };
  const instructions=categorical
   ?{
     predicate:'Estimate the relationship defined by clauseRelationDefinition in the shared state, using its complete instructions and option rubrics.',
     selectedRule
   }
   :operation
    ?{
      question,
      assessmentContext:'Apply `assessmentGuidance` in the shared state to this question.',
      selectedRule
    }
    :{
      predicate:definition.instructions,
      selectedRule
    };
  questions[slot]={
    type:definition.type,
    instructions,
    criteria:categorical?Object.fromEntries(Object.keys(definition.criteria).map(function initializeClauseChoice(label) { return ([label,null]); })):definition.criteria
  };
  pairs.push({
    slot,
    id:head.id,
    type:definition.type
  });
 }
 const state={
   fullPolicy:sources[0].content,
   policySourceSHA256:sources[0].sha256,
   policyInputLocation:sourceInputLocation(sources[0]).inputLocation,
   additionalPolicies:sources.slice(1).map(function describeAdditionalPolicy(source,index) { return (({sourceOrdinal:index+1,content:source.content,sourceSHA256:source.sha256,...sourceInputLocation(source)})); }),
   parentProgram:envelope.parentJSON,
   preparedProgram:envelope.preparedJSON,
   originalRequestBody:envelope.requestBody,
   catalogSHA256:request.catalogSHA256,
   ...(hasOperation?{assessmentGuidance:guidance}:{}),
   ...(clauseRelations.size?{clauseRelationDefinition:clauseOperationRelation}:{}),
   ...(hasRequestMaterial?{requestInstructionDefinition:requestInstructionContent}:{}),
   ...(hasHeadingContent?{headingInstructionDefinition:headingInstructionContent}:{}),
   ...(unitAdoptionCount?{unitAdoptionDefinition:unitAdoptionRelation}:{}),
   establishedEffectFacts:[],
   effectFactCoverage:'not-established',
   authority:'not-established',
   semanticQualification:'not-established',
   permission:false
 };
 const body=JSON.stringify({
   model,
   state,
   questions
 });
 if(Buffer.byteLength(body)>1_048_576)throw new RuleAssessmentWireError('Complete mixed assessment exceeds the one MiB bound');
 function answerText(raw){
  const parsed=parseBatchAnswer({
    raw,
    plan:{model,questions}
  });
  return JSON.stringify(pairs.map(function projectOriginalAnswer({
    slot,
    id,
    type
  }) { return (({
    id,
    status:'estimate',
    value:type==='choice'?parsed.choices[slot]:parsed.scalars[slot]
  })); }));
 }
 return Object.freeze({
   body,
   originalQuestionIDs:Object.freeze(pairs.map(function readOriginalQuestionId(pair) { return (pair.id); })),
   answerText
 });
}
