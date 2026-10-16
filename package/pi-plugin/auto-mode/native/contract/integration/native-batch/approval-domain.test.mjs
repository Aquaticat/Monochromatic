import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {mode, freshSessionApproval, uncertainContext, headless, useNativeContext, reloadContext, fixtureState} from './approval-fixture-options.mjs';
import {session, runtime, env, VERDICT_ENTRY_TYPE, flushPolicyDiagnostics} from './approval-fixture.mjs';

//region Original approval assertions and fixture-owned cleanup.
const handler=session.agent
  .executeToolBatch;
session.agent
  .executeToolBatch=async function retainHandlerFailure(input) {try{return await handler(input);}catch(error){fixtureState.handlerFailure=error;throw error;}};
{
 await using fixtureScope={
  async [Symbol.asyncDispose]() {
   session.agent.executeToolBatch=handler;
   session.dispose();
   await session.agent.waitForIdle();
   runtime.detach();
   await env.drain();
   await flushPolicyDiagnostics();
  }
 };
 assert.equal(
   fixtureState.approvalCaptures,
   0,
   'Binding a runtime must retain its host source without retaining a stale native context'
 );
 if(reloadContext){
  assert.ok(
    useNativeContext,
    'Reload fixture requires the native extension context'
  );
  const originalContext=session.extensionRunner
    .createContext();
  const originalPi=fixtureState.nativePi;
  await session.reload();
  assert.notEqual(
    fixtureState.nativePi,
    originalPi,
    'Native reload must recapture the actual extension API'
  );
  assert.throws(
    function accessRetiredNativeUi() { return (originalContext.ui); },
    function matchesRetiredContext(error) {
      return Error.isError(error) && error.message.includes('This extension ctx is stale after session replacement or reload');
    }
  );
 }
 await session.prompt('Exercise native prerequisite and original approval routing.');
 if(fixtureState.abortTask)await fixtureState.abortTask;
 const {
   lastReview:review,
   lastJudgment:judgment
 }=runtime.inspect();
 const eligible=(!headless)&&(![
   'prohibited',
   ...(uncertainContext?[]:['satisfied'])
 ].includes(mode));
 assert.equal(
   fixtureState.selections,
   eligible?1:0,
   `Confirmation follows unresolved automatic review with no established prohibition and an available UI: ${inspect(
     {
       authorizationCaptures: fixtureState.authorizationCaptures,
       handlerFailure: fixtureState.handlerFailure,
       requests: fixtureState.requests,
       assessments: fixtureState.assessments,
       lastMessage:session.messages
         .at(-1),
       outcome:review?.outcome,
       issues:review?.premiseIssues
     },
     {depth:5}
   )}`
 );
 assert.equal(
   fixtureState.notifications,
   fixtureState.selections
 );
 assert.equal(
   fixtureState.authorizationCaptures,
   freshSessionApproval||(mode==='missing')?0:1
 );
 assert.equal(
   fixtureState.approvalCaptures,
   1,
   'Each review captures its current native capabilities once'
 );
 if([
   'retired',
   'deny',
   'stop',
   'cancelled'
 ].includes(mode)){
  assert.equal(
    fixtureState.executions,
    0
  );
  assert.ok(
    fixtureState.handlerFailure,
    inspect(
    {
      mode,
      review
    },
    {depth:4}
  )
  );
 }else{
  assert.ok(
    review,
    inspect(
    {
      requests: fixtureState.requests,
      assessments: fixtureState.assessments,
      message:session.messages
        .at(-1),
      handlerFailure: fixtureState.handlerFailure,
      judgment:judgment?.inspect()
    },
    {depth:5}
  )
  );
  assert.equal(
    review.premiseIssues
      .some(function isRequestDomainIssue(issue) { return (issue.kind==='request-source-domain'); }),
    false
  );
  assert.equal(
    review.compiledPolicy
      .authorizationRequirements
      .length,
    1
  );
 const unresolved=headless&&(![
   'prohibited',
   'satisfied'
 ].includes(mode));
  assert.equal(
    review.outcome
      .state,
    unresolved?'unresolved':'resolved'
  );
  if(!unresolved)assert.equal(
    review.outcome
      .verdict,
    mode==='prohibited'?'deny':'approve'
  );
  assert.equal(
    fixtureState.executions,
    ((!unresolved)&&(mode!=='prohibited'))?3:0
  );
 }
 const entries=session.sessionManager
   .getEntries()
   .filter(function isOriginalVerdictEntry(entry) { return ((entry.type==='custom')&&(entry.customType===VERDICT_ENTRY_TYPE)); });
 assert.equal(
   entries.length,
   fixtureState.selections
 );
 if(entries.length > 0)assert.equal(
   entries[0]
     .data
     .verdict,
   [
     'deny',
     'stop',
     'cancelled'
   ].includes(mode)?'user-deny':'user-approve'
 );
 console.log(JSON.stringify({
   complete:true,
   mode,
   selections: fixtureState.selections,
   notifications: fixtureState.notifications,
   authorizationCaptures: fixtureState.authorizationCaptures,
   executions: fixtureState.executions,
   assessments: fixtureState.assessments,
   originalNativeVerdictEntries:entries.length,
   canonicalPolicyHandler:true,
   actualAskUser:true,
   nativeContext:useNativeContext,
   reloadedNativeContext:reloadContext,
   presentationIsFixture:true,
   authoredIndependentRequirementFacts:!freshSessionApproval,
   freshSessionApproval,
   uncertainContext,
   headless,
   genuineHumanApprovals:0,
   providerRequests:0
 }));
}

//endregion
