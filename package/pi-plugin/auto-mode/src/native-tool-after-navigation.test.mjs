import assert from 'node:assert/strict';
import {readDomainFixtureSettings} from '../dist/native/contract/integration/native-batch/domain-fixture-settings.mjs';
import {createDomainFixtureEnvironment} from '../dist/native/contract/integration/native-batch/domain-fixture-environment.mjs';
import {createDomainFixtureRuntime} from '../dist/native/contract/integration/native-batch/domain-fixture-runtime.mjs';
import {createOperationCurrentness} from '../dist/native/contract/integration/native-batch/operation-currentness.mjs';
import {registerHostResource} from '../dist/native/contract/integration/native-host/resource-reload.ts';

//region New native branches get new decisions while old operations remain stale.
const settings=await readDomainFixtureSettings();
const observations={contextCalls:0,lateContextMutations:0,progressCalls:0,assessments:0,executions:0,requests:0,httpCalls:0,warmingUp:true};
const {env,session,root,lifecycle}=await createDomainFixtureEnvironment({settings,observations,readRuntime(){return runtime;}});
registerHostResource({loader:env.policyInput.loader,policyInput:env.policyInput});
const runtime=createDomainFixtureRuntime({settings,observations,env,session,root,lifecycle,code:'return await tools.fixture_value({path:"seed"});',programProfile:'awaited-literal-single-call'});
await using cleanup={async [Symbol.asyncDispose](){session.dispose();await session.agent.waitForIdle();runtime.detach();await env.drain();}};
await session.prompt('First ordinary chat.');
assert.equal(session.messages.at(-1).stopReason,'stop');
const currentness=createOperationCurrentness(root);
const old=currentness.capture(root);
const first=root.manager.getBranch().find(function user(entry){return entry.type==='message'&&entry.message.role==='user';});
assert.ok(first);
await session.navigateTree(first.id);
assert.throws(function oldDecision(){currentness.assertActive(old);});
await session.setModel({...env.options.model,baseUrl:'https://second.invalid/v1'});
await session.reload();
const fresh=currentness.capture(root);
currentness.assertActive(fresh);
observations.warmingUp=false;
await session.prompt('Exercise the original request-specific policy domain.');
assert.equal(session.messages.at(-1).stopReason,'stop');
assert.equal(runtime.inspect().lastReview.outcome.verdict,settings.relation==='permission'?'approve':'deny');
assert.equal(observations.assessments,1);
assert.equal(observations.executions,settings.relation==='permission'?1:0);
assert.throws(function stillStale(){currentness.assertActive(old);});
console.log(JSON.stringify({complete:true,relation:settings.relation,executions:observations.executions,assessments:observations.assessments}));
//endregion
