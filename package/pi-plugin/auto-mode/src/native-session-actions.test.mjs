import assert from 'node:assert/strict';
import {once} from 'node:events';
import {join} from 'node:path';
import {env,source,createRuntime,nativeHost,fixtureState} from '../dist/native/contract/integration/native-host/lifecycle-fixture.mjs';
import {fixtureResponse} from '../dist/native/contract/integration/native-batch/fixture-response.mjs';
import {nativeOpenAIStream} from '../dist/native/contract/integration/native-batch/source-association.mjs';
import {createOperationCurrentness} from '../dist/native/contract/integration/native-batch/operation-currentness.mjs';
import {assertNativeSessionInputCapture} from '../dist/native/contract/integration/native-batch/generated/session-manager.mjs';

//region Original host actions must leave the next prompt usable.
const mode=process.argv[2];
assert.ok(['switch','tree','retry','reload','abort','inflight','combined','tree-cancel','tree-noop','tree-summary','fork','resume','automatic-retry','provider-retry'].includes(mode));
env.options.modelRuntime.registerProvider('batch-fixture',{
 baseUrl:'https://fixture.invalid/v1',api:'openai-completions',streamSimple:nativeOpenAIStream,models:[{...env.options.model}]
});
const requests=[];
const entered=Promise.withResolvers();
globalThis.fetch=async function fixtureFetch(input,init){
 requests.push(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(['retry','automatic-retry','provider-retry'].includes(mode)&&requests.length===1)throw new TypeError('Fixture connection failure');
 if(['inflight','combined'].includes(mode)&&requests.length===1){
  entered.resolve();
  await once(init.signal,'abort');
  throw init.signal.reason;
 }
 return fixtureResponse({proposal:false});
};
const {createAgentSessionRuntime}=await import(source('core/agent-session-runtime.js'));
const manager=nativeHost.managers.inMemory(env.options.cwd);
const runtime=await createAgentSessionRuntime(createRuntime,{cwd:env.options.cwd,agentDir:env.options.agentDir,sessionManager:manager});
const session=runtime.session;
if(mode==='automatic-retry')session.settingsManager.applyOverrides({retry:{enabled:true,maxRetries:1,baseDelayMs:1,provider:{maxRetries:0}}});
if(mode==='provider-retry')session.settingsManager.applyOverrides({retry:{enabled:false,provider:{maxRetries:1}}});
if(mode==='automatic-retry')assert.equal(session.settingsManager.getRetrySettings().enabled,true);
if(mode==='provider-retry')assert.equal(session.settingsManager.getProviderRetrySettings().maxRetries,1);
session.agent.getApiKey=function credential(){return process.env.FIXTURE_API_KEY;};
const messages=[];
session.subscribe(function response(event){if(event.type==='message_end')messages.push(event.message);});
await using cleanup={async [Symbol.asyncDispose](){await runtime.dispose();await env.drain();}};
const pending=session.prompt('Reply briefly without using tools.');
if(['inflight','combined'].includes(mode)){await entered.promise;await session.abort();}
await pending;
assertNativeSessionInputCapture(manager);
const first=manager.getBranch().find(function firstUser(entry){return entry.type==='message'&&entry.message.role==='user';});
assert.ok(first);
const root={session,manager};
const currentness=createOperationCurrentness(root);
const initial=currentness.capture(root);
assert.equal(messages.at(-1)?.stopReason,mode==='retry'?'error':['inflight','combined'].includes(mode)?'aborted':'stop',messages.at(-1)?.errorMessage);
if(['switch','combined'].includes(mode))await session.setModel({...env.options.model,baseUrl:'https://second.invalid/v1'});
if(['reload','combined'].includes(mode))await session.reload();
if(['tree','combined','tree-cancel','tree-summary'].includes(mode)){
 fixtureState.cancelNavigation=mode==='tree-cancel';
 const result=await session.navigateTree(first.id,{summarize:mode==='tree-summary'});
 assert.equal(result.cancelled,mode==='tree-cancel');
 if(mode==='tree-cancel')currentness.assertActive(initial);
 else{
  assert.equal(result.editorText,'Reply briefly without using tools.');
  assert.throws(function rejectOldBranch(){currentness.assertActive(initial);});
  currentness.assertActive(currentness.capture(root));
 }
}
if(mode==='tree-noop'){
 assert.equal((await session.navigateTree(manager.getLeafId())).cancelled,false);
 currentness.assertActive(initial);
}
if(mode==='abort')await session.abort();
if(mode==='fork'){
 const result=await runtime.fork(first.id);
 assert.equal(result.cancelled,false);
 assert.equal(result.selectedText,'Reply briefly without using tools.');
 assert.throws(function rejectDisposedOperation(){currentness.assertActive(initial);});
}
if(mode==='resume'){
 const persisted=nativeHost.managers.create(env.options.cwd,join(env.options.agentDir,'fixture-sessions'));
 persisted.appendMessage({role:'user',content:'Persisted input',timestamp:1});
 assert.equal((await runtime.switchSession(persisted.getSessionFile())).cancelled,false);
 assert.throws(function rejectReplacedOperation(){currentness.assertActive(initial);});
}
assertNativeSessionInputCapture(runtime.session.sessionManager);
runtime.session.agent.getApiKey=function currentCredential(){return process.env.FIXTURE_API_KEY;};
await runtime.session.prompt('Edited follow-up without tools.');
const last=runtime.session.messages.at(-1);
assertNativeSessionInputCapture(runtime.session.sessionManager);
assert.equal(last?.stopReason,'stop',last?.errorMessage);
assert.equal(requests.length,['automatic-retry','provider-retry','tree-summary'].includes(mode)?3:2);
assert.equal(requests.at(-1),['switch','combined'].includes(mode)?'https://second.invalid/v1/chat/completions':'https://fixture.invalid/v1/chat/completions');
console.log(JSON.stringify({complete:true,mode,requests:requests.length,errors:messages.filter(function failed(message){return message.stopReason==='error';}).map(function diagnostic(message){return message.errorMessage;})}));
//endregion
