import assert from 'node:assert/strict';
import {assertDomainReview} from './domain-frontier-assertions.mjs';
import {readDomainFixtureSettings} from './domain-fixture-settings.mjs';
import {createDomainFixtureEnvironment} from './domain-fixture-environment.mjs';
import {createDomainFixtureRuntime} from './domain-fixture-runtime.mjs';

//region Native fixture lifetime owns its counters and disposable session.
/** Run one original native decision with the selected authored contrast. */
async function runDomainFrontier(){
 const settings=await readDomainFixtureSettings();
 const {relation,requireResolution,unobservedContext,observedContext,observedProgress,nextDecision,approvedChange,changeControl,nextInput,nextResult,throwingContext,httpTransport,operatingPolicy,unconfiguredPolicies,singleCall,expectedExecutions,lowConfidenceClause,unresolvedClause,sdkStream,receiptControl,providerMetadata}=settings;
const observations={
  contextCalls:0,
  lateContextMutations:0,
  progressCalls:0,
  assessments:0,
  executions:0,
  requests:0,
  httpCalls:0,
  originalBody:undefined,
  firstDecision:undefined,
  nextInputQuestions:0
};
 const {env,session,root,lifecycle}=await createDomainFixtureEnvironment({settings,observations,readRuntime(){return runtime;}});
const code=singleCall==='direct'?'return await tools.fixture_value({path:"seed"});':singleCall==='binding'?'const value = await tools.fixture_value({path:"seed"}); return value;':'const value = await tools.fixture_value({path:"seed"});\nreturn await Promise.allSettled([tools.fixture_value({path:value}),tools.fixture_value({path:"second"})]);';
const programProfile=singleCall===undefined?'awaited-string-result-then-literal-parallel':'awaited-literal-single-call';
 const runtime=createDomainFixtureRuntime({settings,observations,env,session,root,lifecycle,code,programProfile});
await using cleanup={async [Symbol.asyncDispose](){await changeControl.drain();session.dispose();await session.agent
  .waitForIdle();runtime.detach();await env.drain();}};
try{
 await session.prompt('Exercise the original request-specific policy domain.');
 const current=runtime.inspect();
 if(unconfiguredPolicies){
  const review=current.lastReview;
  assert.ok(
    review,
    'The original native operation must reach policy review'
  );
  assert.equal(
    review.outcome
      .state,
    'unresolved'
  );
  assert.equal(
    review.semanticAdmission
      .state,
    'not-configured'
  );
  assert.equal(
    Object.hasOwn(
      review,
      'requestMaterialAdmission'
    ),
    false
  );
  assert.equal(
    review.headingContextAdmission
      .state,
    'not-configured'
  );
  assert.equal(
    review.unitAdoptionAdmission
      .state,
    'not-configured'
  );
  assert.equal(
    observations.assessments,
    0
  );
  assert.equal(
    observations.httpCalls,
    0
  );
  assert.equal(
    observations.executions,
    0
  );
  assert.ok(
    current.lastJudgment
      .inspect()
      .finalRecord,
    'The unconfigured original judgment must close'
  );
  console.log(JSON.stringify({
    complete:true,
    unconfiguredPolicies:true,
    outcome:review.outcome,
    assessments:observations.assessments,
    httpCalls:observations.httpCalls,
    executions:observations.executions
  }));
  return;
 }
 if((approvedChange==='policy')||(approvedChange==='cancel')){
  changeControl.verify({
    judgment:current.lastJudgment,
    observations
  });
  return;
 }
 const first=nextDecision?observations.firstDecision:undefined;
 if(nextDecision)assert.ok(
   first,
   'The next request must follow a completed original operation'
 );
 const {
   lastReview:review,
   lastJudgment:judgment
 }=first??current;
 const measures=first?.measures??observations;
 assertDomainReview({
   env,
   review,
   judgment,
   session,
   originalBody:measures.originalBody,
   settings:{
     relation,
     requireResolution,
     unobservedContext,
     observedContext,
     observedProgress,
     throwingContext,
     httpTransport,
     operatingPolicy,
     lowConfidenceClause,
     unresolvedClause,
     sdkStream,
     receiptControl,
     providerMetadata,
     expectedExecutions
   },
   measures
 });
 if(singleCall&&(relation==='permission')){
  const programs=judgment.inspect()
    .rootPrograms;
  assert.equal(
    programs.length,
    1
  );
  assert.equal(
    programs[0]
      .groups
      .length,
    1
  );
  assert.equal(
    programs[0]
      .declaration
      .profile,
    'awaited-literal-single-call'
  );
  assert.ok(
    session.messages
      .some(function hasSuccessfulFixtureResult(message) { return ((message.role==='toolResult')
        &&(!message.isError)
        &&message.content
        .some(function hasFixtureValueText(part) { return ((part.type==='text')
          &&part.text
          .includes('fixture child value')); })); }),
    'The original single-call result must reach its consumer'
  );
 }
 if(approvedChange==='arguments')changeControl.verify({
   judgment,
   observations
 });
 if(nextDecision){
  if(observations.assessments!==2){
   for(const record of current.lastJudgment
     ?.inspect()
     .accounting
     .records
     ??[])if(record.error)console.error(record.error);
   console.error(JSON.stringify({
     requests:observations.requests,
     assessments:observations.assessments,
     review:current.lastReview
       ?.outcome,
     judgment:current.lastJudgment
       ?.inspect(),
     messages:session.messages
       .slice(-3)
   }));
  }
  assert.equal(
    observations.assessments,
    2,
    'Each original decision gets one assessment'
  );
  assert.equal(
    observations.executions,
    expectedExecutions,
    'Later received instructions must prevent the next operation from executing'
  );
  assert.ok(
    observations.nextInputQuestions>0,
    'The second assessment must select the later instruction'
  );
  const sources=current.lastReview
    .inputs
    .instructionSources
    .map(function originalText(view){return view.source
      .content;});
  for(const text of [
    nextInput,
    nextResult
  ])assert.ok(
    sources.some(function retainedText(content){return content.includes(text);}),
    text
  );
  assert.notEqual(
    current.lastReview
      .outcome
      .verdict,
    'approve'
  );
  assert.notEqual(
    current.lastJudgment,
    judgment
  );
  assert.equal(
    judgment.inspect()
      .accounting
      .attempts,
    1
  );
  assert.equal(
    current.lastJudgment
      .inspect()
      .accounting
      .attempts,
    1
  );
  console.log(JSON.stringify({
    nextDecisionReceipts:true,
    assessments:observations.assessments,
    executions:observations.executions,
    nextInputQuestions:observations.nextInputQuestions,
    outcome:current.lastReview
      .outcome
  }));
 }
}catch(error){console.error(error);throw error;}
}

await runDomainFrontier();

//endregion Native fixture lifetime owns its counters and disposable session
