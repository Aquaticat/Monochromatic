import assert from 'node:assert/strict';
import {rename} from 'node:fs/promises';
import {join} from 'node:path';
import {readDomainFixtureSettings} from '../dist/native/contract/integration/native-batch/domain-fixture-settings.mjs';
import {createDomainFixtureEnvironment} from '../dist/native/contract/integration/native-batch/domain-fixture-environment.mjs';
import {createDomainFixtureRuntime} from '../dist/native/contract/integration/native-batch/domain-fixture-runtime.mjs';
import {maintainedPolicyEntry} from '../dist/native/contract/integration/maintained-policy.mjs';

//region Failed automatic evidence falls back to the original manual approval interface.
const {askUser,VERDICT_ENTRY_TYPE}=await import(maintainedPolicyEntry);
const settings=await readDomainFixtureSettings();
const mode=process.argv.find(function modeArgument(value){return value.startsWith('--manual=');})?.slice('--manual='.length)??'allow';
const failure=process.argv.includes('--assessment-failure')?'assessment':'observation';
assert.ok(['allow','stop','cancel','headless'].includes(mode));
const observations={contextCalls:0,lateContextMutations:0,progressCalls:0,assessments:0,executions:0,requests:0,httpCalls:0,warmingUp:true,failAssessment:false,selections:0};
const fixture={pi:undefined,abortTask:undefined};
const {env,session,root,lifecycle}=await createDomainFixtureEnvironment({settings,observations,readRuntime(){return runtime;},extensionFactories:[function capturePi(pi){fixture.pi=pi;}]});
const code='return await tools.fixture_value({path:"seed"});';
const runtime=createDomainFixtureRuntime({settings,observations,env,session,root,lifecycle,code,programProfile:'awaited-literal-single-call',approvalHost(){return {
 pi:fixture.pi,askUser,verdictEntryType:VERDICT_ENTRY_TYPE,trace(value){assert.equal(typeof value,'string');},
 notificationInvoker:async function ignoreFixtureNotification(){return {exitCode:0,stdout:'',stderr:''};},
 ctx:{hasUI:mode!=='headless',abort(){fixture.abortTask=session.abort();},ui:{async select(title,options,selectionOptions){
  observations.selections++;
  assert.deepEqual(options,['Allow','Stop']);
  assert.ok(title.includes('Auto-mode could not assess this operation'));
  assert.ok(title.includes('Complete prepared group:'));
  assert.ok(title.includes(JSON.stringify(code)));
  assert.ok(selectionOptions.signal instanceof AbortSignal);
  if(mode==='cancel'){fixture.abortTask=session.abort();return undefined;}
  return mode==='allow'?'Allow':'Stop';
 }}}
};}});
await using cleanup={async [Symbol.asyncDispose](){await fixture.abortTask;session.dispose();await session.agent.waitForIdle();runtime.detach();await env.drain();}};
const policy=join(env.options.cwd,'AGENTS.md');
const saved=join(env.options.cwd,'policy.saved');
if(failure==='observation')await rename(policy,saved);
await using restore={async [Symbol.asyncDispose](){if(failure==='observation')await rename(saved,policy);}};
await session.prompt('Chat before the tool proposal.');
assert.equal(session.messages.at(-1).stopReason,'stop');
assert.equal(observations.selections,0);
observations.warmingUp=false;
observations.failAssessment=failure==='assessment';
await session.prompt('Propose the tool while automatic assessment is unavailable.');
await fixture.abortTask;
assert.equal(observations.selections,mode==='headless'?0:1);
assert.equal(observations.executions,mode==='allow'?1:0);
assert.equal(observations.assessments,failure==='assessment'?1:0);
if(mode==='allow')assert.equal(runtime.inspect().lastReview.manualFallback,true);
console.log(JSON.stringify({complete:true,failure,manual:mode,chatSurvived:true,selections:observations.selections,executions:observations.executions}));
//endregion
