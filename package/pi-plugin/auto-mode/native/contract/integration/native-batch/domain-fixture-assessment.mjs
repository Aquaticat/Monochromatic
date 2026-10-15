import assert from 'node:assert/strict';
import {createAssessmentSender} from '../maintained-policy.mjs';

//region Authored relation answers retain original request bytes and supplied HTTP protocol controls.
export function createDomainFixtureAssessment({settings,observations}){
 const {nextDecision,nextInput,nextResult,unresolvedClause,relation,operatingPolicy,lowConfidenceClause,httpTransport}=settings;
function authoredWireAnswer({body}){
  observations.assessments++;const wire=JSON.parse(body);assert.equal(
    wire.state
      .originalRequestBody,
    observations.originalBody
  );
  const answers=Object.fromEntries(Object.entries(wire.questions)
    .map(function answerAuthoredDomainQuestion([slot,question]) {
   assert.notEqual(
     question.instructions
       .selectedMaterial,
     'originalRequestBody',
     'Tool policy must not issue a whole-model-request approval question'
   );
   const selectedClause=question.instructions
     .selectedRule
     ?.id
     ==='RUL';
   const laterInstruction=nextDecision&&[
     nextInput,
     nextResult
   ].some(function receivedLater(text){return question.instructions
     .selectedRule
     ?.text
     .includes(text);});
   if(laterInstruction){assert.equal(
     observations.assessments,
     2,
     'Later receipts must not revise the first assessment'
   );observations.nextInputQuestions++;}
   const choice=laterInstruction?'prohibition':selectedClause?(unresolvedClause??relation):'none';
   const score=operatingPolicy?(selectedClause&&lowConfidenceClause?0.599999:(choice==='unknown')||(choice==='unsupported')?1:0.6):1;
   assert.ok(Object.hasOwn(
     question.criteria,
     choice
   ));
   return [
     slot,
     {
       type:'choice',
       choice,
       probabilities:Object.fromEntries(Object.keys(question.criteria)
         .map(function scoreAuthoredDomainChoice(label) { return ([
           label,
           label===choice?score:label==='unknown'?1-score:0
         ]); }))
     }
   ];
  }));
  return JSON.stringify({
    model:wire.model,
    answers,
    usage:{
      input_tokens:100,
      output_tokens:10
    }
  });
}
const sendAssessment=httpTransport?createAssessmentSender({
 now:function originalAssessmentClock(){return performance.now();},
 readCredential:function fixtureAssessmentCredential(){return 'native-http-fixture-key';},
 async fetchImpl(
   url,
   options
 ){
  observations.httpCalls++;
  assert.equal(
    url,
    'https://api.llmgateway.io/v1/decisions'
  );
  assert.equal(
    options.method,
    'POST'
  );
  assert.equal(
    options.redirect,
    'error'
  );
  assert.equal(
    options.headers
      .authorization,
    'Bearer native-http-fixture-key'
  );
  assert.equal(
    options.signal
      .aborted,
    false
  );
  const decisionRequest=JSON.parse(options.body);
  const nativeRequest={
    model:decisionRequest.model,
    state:JSON.parse(decisionRequest.input),
    questions:Object.fromEntries(decisionRequest.questions
      .map(function originalQuestion(question){return [
        question.name,
        {
          type:question.type,
          instructions:JSON.parse(question.instructions),
          criteria:Object.fromEntries(question.choices
            .map(function originalCriterion(choice){return [
              choice.value,
              choice.description??null
            ];}))
        }
      ];}))
  };
  const nativeResponse=JSON.parse(authoredWireAnswer({body:JSON.stringify(nativeRequest)}));
  return new Response(JSON.stringify({
    model:nativeResponse.model,
    usage:nativeResponse.usage,
    answers:Object.entries(nativeResponse.answers)
      .map(function providerAnswer([name,answer]){return {
        type:'choice',
        name,
        choice:answer.choice,
        confidence:0.6,
        probabilities:Object.entries(answer.probabilities)
          .map(function providerProbability([value,probability]){return {
            value,
            probability
          };})
      };})
  }));
 }
}):authoredWireAnswer;
 return sendAssessment;
}
//endregion
