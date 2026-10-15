import assert from 'node:assert/strict';
import {rename} from 'node:fs/promises';
import {join} from 'node:path';
import {readDomainFixtureSettings} from '../dist/native/contract/integration/native-batch/domain-fixture-settings.mjs';
import {createDomainFixtureEnvironment} from '../dist/native/contract/integration/native-batch/domain-fixture-environment.mjs';
import {createDomainFixtureRuntime} from '../dist/native/contract/integration/native-batch/domain-fixture-runtime.mjs';

//region Observation and assessment failures affect dependent tools, not ordinary chat.
const settings=await readDomainFixtureSettings();
const observations={contextCalls:0,lateContextMutations:0,progressCalls:0,assessments:0,executions:0,requests:0,httpCalls:0,warmingUp:true,failAssessment:false};
const {env,session,root,lifecycle}=await createDomainFixtureEnvironment({settings,observations,readRuntime(){return runtime;}});
const runtime=createDomainFixtureRuntime({settings,observations,env,session,root,lifecycle,code:'return await tools.fixture_value({path:"seed"});',programProfile:'awaited-literal-single-call'});
await using cleanup={async [Symbol.asyncDispose](){session.dispose();await session.agent.waitForIdle();runtime.detach();await env.drain();}};
const policy=join(env.options.cwd,'AGENTS.md');
const saved=join(env.options.cwd,'policy.saved');
await rename(policy,saved);
{
 await using restore={async [Symbol.asyncDispose](){await rename(saved,policy);}};
 await session.prompt('Chat while request evidence is unavailable.');
 assert.equal(session.messages.at(-1).stopReason,'stop');
 observations.warmingUp=false;
 await session.prompt('Propose a tool while request evidence is unavailable.');
 assert.equal(session.messages.at(-1).stopReason,'stop');
 assert.equal(observations.executions,0);
 assert.equal(observations.assessments,0);
 assert.ok(session.messages.some(function withheld(message){return message.role==='toolResult'&&message.isError;}));
}
observations.requests=0;
observations.failAssessment=true;
await session.prompt('Propose a tool while its assessment is unavailable.');
assert.equal(session.messages.at(-1).stopReason,'stop');
assert.equal(observations.executions,0);
assert.equal(observations.assessments,1);
observations.requests=0;
observations.failAssessment=false;
await session.prompt('Propose the permitted tool with current evidence.');
assert.equal(session.messages.at(-1).stopReason,'stop');
assert.equal(observations.executions,1);
assert.equal(runtime.inspect().lastReview.outcome.verdict,'approve');
console.log(JSON.stringify({complete:true,chatSurvivedObservationFailure:true,toolWithheldOnObservationFailure:true,toolWithheldOnAssessmentFailure:true,recoveredExecutions:observations.executions}));
//endregion
