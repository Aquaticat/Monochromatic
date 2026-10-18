/** Loaded history and live manager inputs retain the same supported native content. @module */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {env,nativeHost} from '../dist/native/contract/integration/native-host/lifecycle-fixture.mjs';
import {assertNativeSessionInputCapture,readNativeSessionInputOrigin} from '../dist/native/contract/integration/native-batch/generated/session-manager.mjs';
import {captureLoadedInputs} from '../dist/native/contract/collector/run-prompt-custody-v3/loaded-inputs.mjs';
import {readOriginalMessagePublication} from '../dist/native/contract/collector/run-prompt-custody-v3/handler-publication.mjs';

//region Actual SDK persistence must retain ordinary assistant thinking and tool-call blocks

/** Produce a native assistant message without replacing its supported content. */
function assistant(content){
 return {role:'assistant',content,api:'openai-completions',provider:'batch-fixture',model:'fixture',
  usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},
  stopReason:'toolUse',timestamp:1};
}

/** Invoke the actual live capture with its original argument frame. */
function appended(message){
 const pool=captureLoadedInputs([]);
 function appendMessage(input){pool.captureManagerInput({method:'appendMessage',frame:arguments});}
 appendMessage(message);
 return pool;
}

/** Native load capture receives original entry records, not reconstructed source publications. */
function loaded(message){
 const entry={type:'message',id:'loaded-message',parentId:null,timestamp:'2026-10-18T00:00:00.000Z',message};
 const pool=captureLoadedInputs([entry]);
 return {pool,entry};
}

await using cleanup={async [Symbol.asyncDispose](){await env.drain();}};
const mixed=[
 {type:'thinking',thinking:'Retained private reasoning',thinkingSignature:'retained-thinking-signature',redacted:false},
 {type:'text',text:'Retained assistant prose',textSignature:'retained-text-signature'},
 {type:'toolCall',id:'historical-bash',name:'bash',arguments:{command:'printf HISTORICAL_INPUT'},thoughtSignature:'retained-call-signature',namespace:'fixture'}
];
const persisted=nativeHost.managers.create(env.options.cwd,join(env.options.agentDir,'history-content'));
persisted.appendMessage({role:'user',content:'Original persisted request',timestamp:0});
persisted.appendMessage(assistant(mixed));
assertNativeSessionInputCapture(persisted);
const reopened=nativeHost.managers.open(persisted.getSessionFile());
assertNativeSessionInputCapture(reopened);
const history=reopened.getBranch().find(function originalAssistant(entry){return entry.type==='message'&&entry.message.role==='assistant';});
assert.ok(history);
const persistedOrigin=readNativeSessionInputOrigin(readOriginalMessagePublication(history));
assert.ok(persistedOrigin);
assert.deepEqual(JSON.parse(persistedOrigin.source.content),mixed);
assert.equal(persistedOrigin.source.permission,false);

//endregion Actual SDK persistence must retain ordinary assistant thinking and tool-call blocks

//region Differential catalogs keep live and loaded validation at the same domain boundary

const supported=[
 'Plain assistant text',
 [{type:'text',text:'Plain assistant block'}],
 [{type:'text',text:'Signed assistant block',textSignature:'opaque-text-signature'}],
 [{type:'thinking',thinking:'Private reasoning',thinkingSignature:'opaque-thinking-signature'}],
 [{type:'thinking',thinking:'Redacted reasoning',redacted:true}],
 [{type:'toolCall',id:'plain-call',name:'bash',arguments:{command:'printf PLAIN'}}],
 mixed
];
for(const content of supported){
 const message=assistant(content);
 const live=appended(message);
 live.assertCaptured();
 const {pool,entry}=loaded(message);
 pool.assertCaptured();
 const liveOrigin=live.readConstructedInputs()[0];
 const loadOrigin=pool.lookup(readOriginalMessagePublication(entry));
 assert.ok(liveOrigin&&loadOrigin);
 assert.equal(loadOrigin.source.content,liveOrigin.source.content);
 assert.equal(loadOrigin.source.permission,false);
 assert.notEqual(loadOrigin.source.occurrence,liveOrigin.source.occurrence);
}
const unsupported=[
 [{type:'text',text:'Unexpected field',extra:true}],
 [{type:'thinking',thinking:'Invalid redaction',redacted:'yes'}],
 [{type:'toolCall',id:'bad-arguments',name:'bash',arguments:[]}],
 [{type:'image',data:'unsupported-image',mimeType:'image/png'}]
];
for(const content of unsupported){
 const message=assistant(content);
 const live=appended(message);
 const {pool}=loaded(message);
 assert.throws(function rejectUnsupportedLiveContent(){live.assertCaptured();});
 assert.throws(function rejectUnsupportedLoadedContent(){pool.assertCaptured();});
}
console.log(JSON.stringify({complete:true,sdkPersistence:true,supported:supported.length,unsupported:unsupported.length,retainedOpaqueSignatures:true}));

//endregion Differential catalogs keep live and loaded validation at the same domain boundary
