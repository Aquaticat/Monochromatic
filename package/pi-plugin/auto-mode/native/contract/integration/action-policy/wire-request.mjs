import {RuleAssessmentWireError} from './wire-source.mjs';

//region Validate the original binding before publishing its correlated wire question.
export function appendRequestQuestion({envelope,head,binding,definition,index,membership,questions,pairs}){
   if((!binding)||(Object.keys(binding)
     .toSorted()
     .join(',')
     !=='claimScope,requestMaterial')
     ||(binding.claimScope!=='program-request')
     ||(binding.requestMaterial
       ?.body
       !==envelope.requestBody))throw new RuleAssessmentWireError('Whole-request question differs from its retained complete request material');
   if(membership.hasRequestMaterial)throw new RuleAssessmentWireError('Mixed batch repeats the original whole-request material question');
   membership.hasRequestMaterial=true;
   const slot=`head_${index}`;
   questions[slot]={
     type:definition.type,
     instructions:{
       predicate:'Use requestInstructionDefinition in shared state to assess the complete exact originalRequestBody for this proposal; this is not source authority or governing completeness.',
       selectedMaterial:'originalRequestBody'
     },
     criteria:Object.fromEntries(Object.keys(definition.criteria)
       .map(function initializeRequestChoice(label) { return ([
         label,
         null
       ]); }))
   };
   pairs.push({
     slot,
     id:head.id,
     type:definition.type
   });
}
//endregion
