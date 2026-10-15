import {QuestionSelectionError} from './selection-error.ts';
import {object,text,readRelationEstimate} from './selection-values.ts';

//region Retain terminal original answers or their malformed and discarded diagnostics.
export function createQuestionSettlement({knownBatch,retainedOperation,budget,current}){
  function settle({
    batch:handle,
    answerText,
    model
  }){return retainedOperation(function settleOriginalQuestionBatch() {
    const batch=knownBatch(handle);if(batch.settled)throw new QuestionSelectionError('Question batch already has a terminal response');
    const retainedRaw=((typeof answerText)==='string')&&(Buffer.byteLength(answerText)<=65_536)?answerText:undefined;
    try {
    budget.checkpoint();for(const claim of batch.selected)current(claim);
    const response={failure:undefined,values:undefined};
    try{
      if((model!==undefined)&&((!text(model))||(Buffer.byteLength(model)>256)))throw new QuestionSelectionError('Assessment model attribution is malformed');
      if((retainedRaw===undefined)||(!answerText.isWellFormed()))throw new QuestionSelectionError('Answer text exceeds the declared JSON response profile');
      const answers=JSON.parse(answerText);if((!Array.isArray(answers))||(answers.length
        !==batch.selected
        .length))throw new QuestionSelectionError('Answer membership differs from the issued question batch');
      response.values=answers.map(function validateOriginalAnswer(
        answer,
        index
      ) {
        if((!object(answer))||Array.isArray(answer)
          ||(answer.id!==(`q${
            index}`)))throw new QuestionSelectionError('Answer identity differs from the issued question');
        if((answer.status==='estimate')&&(Object.keys(answer)
          .toSorted()
          .join(',')
          ==='id,status,value'))return Object.freeze({
          status:'estimate',
          value:readRelationEstimate({
            definition:batch.selected[index]
              .definition,
            value:answer.value
          })
        });
        if((answer.status==='unresolved')&&(Object.keys(answer)
          .toSorted()
          .join(',')
          ==='id,reason,status')
          &&text(answer.reason))return Object.freeze({
          status:'unresolved',
          reason:answer.reason
        });
        throw new QuestionSelectionError('Answer is neither a bounded estimate nor an explicit unresolved result');
      });
    }catch(error){response.failure=error;response.values=batch.selected
      .map(function createMalformedAnswer() { return (Object.freeze({status:'malformed'})); });}
    budget.checkpoint();
    for(const [index,claim] of batch.selected
      .entries()){claim.answer=response.values[index];if((response.failure===undefined)&&(model!==undefined))claim.model=model;}
    batch.settled=true;batch.record=Object.freeze({
      answers:Object.freeze(response.values),
      raw:retainedRaw,
      malformed:response.failure!==undefined,
      discarded:false,
      failure:response.failure,
      ...((response.failure===undefined)&&(model!==undefined)?{model}:{}),
      semanticQualification:'not-established',
      instructionAuthority:'not-established'
    });return batch.record;
    } catch(error) {
      const values=batch.selected
        .map(function createDiscardedAnswer() { return (Object.freeze({status:'discarded'})); });
      for(const [index,claim] of batch.selected
        .entries())claim.answer=values[index];
      batch.settled=true;batch.record=Object.freeze({
        answers:Object.freeze(values),
        raw:retainedRaw,
        malformed:false,
        discarded:true,
        failure:error,
        semanticQualification:'not-established',
        instructionAuthority:'not-established'
      });
      throw error;
    }
  });}
 return settle;
}
//endregion
