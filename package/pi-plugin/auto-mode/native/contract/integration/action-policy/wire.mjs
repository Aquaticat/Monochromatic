import {RuleAssessmentWireError,sha} from './wire-source.mjs';
import {appendAdoptionQuestion} from './wire-adoption.mjs';
import {appendHeadingQuestion} from './wire-heading.mjs';
import {appendClauseQuestion} from './wire-clause.mjs';
import {appendOperationDecisionQuestion} from './wire-operation.mjs';
import {operationDecisionDefinition} from './operation-decision-definition.ts';
import {captureAssessmentDiagnostics} from './assessment-diagnostics.mjs';
import {projectPolicyMaterial,projectVisibleOperation} from './wire-material.mjs';
import programCatalog from '../../lifecycle/program-rule-wire/catalog.json' with {type:'json'};
import {questions as meaningCatalog} from '../../research/instruction-prerequisite-relation/cases.mjs';
import {parseBatchAnswer} from '../../research/instruction-prerequisite-relation/protocol.mjs';
import {clauseOperationRelation} from './clause-relation.mjs';
import {requestInstructionContent} from './request-relation.mjs';
import {headingInstructionContent} from './heading-relation.mjs';
import {unitAdoptionRelation} from './unit-adoption-relation.mjs';
import {ruleAssessmentModel} from './assessment-model.ts';

export {ruleAssessmentModel} from './assessment-model.ts';

export {RuleAssessmentWireError} from './wire-source.mjs';
const model=ruleAssessmentModel;
const definitions=Object.freeze({
 operation_violates_rule:programCatalog.operation_violates_rule,
 states_approval_prerequisite:meaningCatalog.states_approval_prerequisite,
 clause_operation_relation:clauseOperationRelation,
 request_instruction_content:requestInstructionContent,
 heading_instruction_content:headingInstructionContent,
 unit_adoption:unitAdoptionRelation,
 operation_decision:operationDecisionDefinition
});
/** Fixed bootstrap catalog, not model-authored definitions or source authority. */
export const ruleAssessmentCatalogText=JSON.stringify(definitions);
const question='Would carrying out the complete proposed operation violate the selected rule, given the supplied established facts?';
const guidance=definitions.operation_violates_rule
  .instructions
  .slice(question.length+1);
if(!definitions.operation_violates_rule
  .instructions
  .startsWith(`${question} `))throw new RuleAssessmentWireError('Operation guidance differs from its fixed definition');


/**
 Serialize one original mixed batch without issuing claims or deciding policy.
 Fixed meaning and operation definitions share complete source/program context.
 Wire ordinals correlate data; only the original judgment authenticates handles.
 */
export function bindRuleAssessmentWire(request){
 const envelope=request?.envelope;
 if((!envelope)||(![
   'governingSources,instructionAuthority,mandatoryPolicy,parentJSON,preparedJSON,requestBody',
   'governingSources,instructionAuthority,mandatoryPolicy,parentJSON,policyMaterial,preparedJSON,requestBody'
 ].includes(Object.keys(envelope)
   .toSorted()
   .join(','))))throw new RuleAssessmentWireError('Mixed assessment requires the original multi-source envelope');
 for(const field of [
   'parentJSON',
   'preparedJSON',
   'requestBody'
 ])if((typeof envelope[field])!=='string')throw new RuleAssessmentWireError(`Original complete operation field is missing: ${field}`);
 // Keep the exact operation beside each clause so its meaning is assessed against the proposed action.
 const proposedOperation=Object.freeze({
   parent:projectVisibleOperation(JSON.parse(envelope.parentJSON)),
   prepared:JSON.parse(envelope.preparedJSON)
 });
 const sources=envelope.governingSources;
 if((!Array.isArray(sources))||(sources.length === 0)
   ||(Reflect.ownKeys(sources)
     .length
     !==(sources.length
     +1)))throw new RuleAssessmentWireError('Complete governing source list is unavailable');
 for(let index=0;index<sources.length;index++){
  const field=Object.getOwnPropertyDescriptor(
    sources,
    String(index)
  );
  if((!field)||(!Object.hasOwn(
    field,
    'value'
  ))
    ||((typeof field.value
      ?.content)!=='string')
    ||(field.value
      .sha256
      !==sha(field.value
        .content)))throw new RuleAssessmentWireError('Governing source is missing or differs from its captured text');
 }
 if(sources[0]
   .content
   !==envelope.mandatoryPolicy
   ?.content)throw new RuleAssessmentWireError('Primary source differs from mandatory policy');
 const input=request.questions;
 if((!Array.isArray(input))||(input.length === 0)
   ||(Reflect.ownKeys(input)
     .length
     !==(input.length
     +1)))throw new RuleAssessmentWireError('Mixed assessment requires a complete dense original claim list');
 const questions={};
   const pairs=[];
   const seen=new Set();
   const clauseRelations=new Set();
 const membership={hasHeadingContent:false,hasOperation:false,hasRequestMaterial:false,hasOperationDecision:false,unitAdoptionCount:0};
 for(const [index,head] of input.entries()){
  if((head?.id!==`q${
    index}`)||(!Object.hasOwn(
    definitions,
    head.definitionId
  )))throw new RuleAssessmentWireError('Question identity or definition is unsupported');
  const definition=definitions[head.definitionId];
    const operation=head.definitionId!=='states_approval_prerequisite';
    const categorical=definition.type==='choice';
  if(JSON.stringify(head.definition)!==JSON.stringify(definition))throw new RuleAssessmentWireError('Fixed question definition changed');
  const {binding} = head;
  if(head.definitionId==='operation_decision'){
   appendOperationDecisionQuestion({head,binding,definition,index,membership,questions,pairs,proposedOperation});
   continue;
  }
  if(head.definitionId==='unit_adoption'){
   appendAdoptionQuestion({sources,head,binding,definition,index,seen,membership,questions,pairs});
   continue;
  }
  if(head.definitionId==='request_instruction_content'){
   throw new RuleAssessmentWireError('Complete hidden provider requests are outside human-readable approval inputs');
  }
  if(head.definitionId==='heading_instruction_content'){
   appendHeadingQuestion({sources,head,binding,definition,index,seen,membership,questions,pairs});
   continue;
  }
  appendClauseQuestion({sources,head,binding,definition,index,seen,membership,questions,pairs,operation,categorical,clauseRelations,question,proposedOperation});
 }
 const state={
   selectedPolicyMaterial:projectPolicyMaterial({sources,material:envelope.policyMaterial,questions:input}),
   parentProgram:JSON.stringify(proposedOperation.parent),
   preparedProgram:envelope.preparedJSON,
   catalogSHA256:request.catalogSHA256,
   ...(membership.hasOperation?{assessmentGuidance:guidance}:{}),
   ...(clauseRelations.size > 0?{clauseRelationDefinition:clauseOperationRelation}:{}),
   ...(membership.hasRequestMaterial?{requestInstructionDefinition:requestInstructionContent}:{}),
   ...(membership.hasHeadingContent?{headingInstructionDefinition:headingInstructionContent}:{}),
   ...(membership.unitAdoptionCount?{unitAdoptionDefinition:unitAdoptionRelation}:{}),
   ...(membership.hasOperationDecision?{reviewPurpose:'Final decision for the complete prepared operation under current instructions and selected user authorization'}:{
   establishedEffectFacts:[],
   effectFactCoverage:'not-established',
   authority:'not-established',
   semanticQualification:'not-established',
   permission:false})
 };
 const body=JSON.stringify({
   model,
   state,
   questions
 });
 const recordResponse=captureAssessmentDiagnostics({request:{...request,model},state,questions});
 function answerText(raw){
  function parseOriginalResponse(){
   try{return parseBatchAnswer({
    raw,
    plan:{
      model,
      questions
    }
   });}
   catch(error){recordResponse({error,raw});throw error;}
  }
  const parsed=parseOriginalResponse();
  recordResponse({parsed});
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
