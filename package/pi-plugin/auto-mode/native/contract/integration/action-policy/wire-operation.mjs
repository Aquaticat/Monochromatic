import {RuleAssessmentWireError} from './wire-source.mjs';

//region The original judgment supplies complete operation content through its immutable envelope.
/** Publish only the original complete-operation claim and its fixed decision vocabulary. */
export function appendOperationDecisionQuestion({head,binding,definition,index,membership,questions,pairs,proposedOperation}){
 if(!binding||Object.keys(binding).join(',')!=='claimScope'
   ||binding.claimScope!=='complete-prepared-operation')throw new RuleAssessmentWireError('Operation decision requires its original complete prepared-group binding');
 if(membership.hasOperationDecision)throw new RuleAssessmentWireError('A batch cannot repeat its original whole-operation decision');
 membership.hasOperationDecision=true;
 const slot=`head_${index}`;
 questions[slot]={
  type:definition.type,
  instructions:{predicate:definition.instructions,selectedMaterial:'completePreparedOperation',proposedOperation},
  criteria:definition.criteria
 };
 pairs.push({slot,id:head.id,type:definition.type});
}
//endregion
