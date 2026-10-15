import assert from 'node:assert/strict';
import {createEnvironment} from './environment.mjs';
import {createRootSessionFactory} from './session-root.ts';
import {bindPolicySessionCollector} from '../policy-source/system-slot.mjs';
import {createOwnedCodemodeDefinition} from './generated/program-definition.mjs';

// Exercise complete native prompt publication with individually bounded inputs whose bundle exceeds one text field.
const policyText='# Policy\n\nRUL:\n Keep the original instruction.\n'+ 'Workspace context.\n'.repeat(1_800);
const forcedPrompt='Native provider prompt.\n'.repeat(1_800);
const env=await createEnvironment({policyText,omitHostPrompt:true,appendPrompts:[],extensionFactories:[
 function providerPrompt(pi){pi.on('before_agent_start',function forcePrompt(event){event.systemPromptOptions.forceSystemPrompt=forcedPrompt;});},
 function observePrompt(pi){pi.on('before_agent_start',function retainPromptInput(){return undefined;});},
 function observePromptAgain(pi){pi.on('before_agent_start',function retainPromptInput(){return undefined;});},
]});
const tools=Array.from({length:12},function declaration(_,ordinal){return {
 ...env.createReadToolDefinition(env.options.cwd),
 name:`fixture_read_${ordinal}`,
 description:'Original tool documentation. '.repeat(200),
};});
const {session}=await createRootSessionFactory(env).create({options:{
 ...env.options,
 tools:['codemode',...tools.map(tool=>tool.name)],
 customTools:[createOwnedCodemodeDefinition(),...tools],
}});
const collector=bindPolicySessionCollector({input:env.policyInput,session});
let requests=0;
session.agent.streamFunction=async function completeOriginalPrompt(model){
 const snapshot=collector.capture();
 collector.assertObservedFresh(snapshot);
 const run=snapshot.nativeRunComposition;
 assert.ok(run.handlerOptionInputs.some(source=>Buffer.byteLength(source.content)>65_536));
 assert.ok(Buffer.byteLength(JSON.stringify(snapshot))>1_048_576);
 assert.ok(snapshot.runMessageInputs.some(source=>source.kind==='native-tool-loadout-input'&&Buffer.byteLength(source.content)>65_536));
 assert.equal(run.options.forceSystemPrompt,forcedPrompt);
 assert.equal(run.options.contextFiles.find(file=>file.path.endsWith('AGENTS.md')).content,policyText);
 requests++;
 const message={role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[{type:'text',text:'done'}],stopReason:'stop',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};
 return {async *[Symbol.asyncIterator](){yield {type:'done',reason:'stop',message};},async result(){return message;}};
};
try{
 await session.prompt('Receive the original workspace prompt.');
 const result=session.messages.at(-1);
 assert.equal(result.stopReason,'stop',result.errorMessage);
 assert.equal(requests,1);
 console.log(JSON.stringify({complete:true,originalPromptPreserved:true,aggregateOptions:true,aggregateLoadout:true,aggregateSnapshot:true,providerRequests:0}));
}finally{
 session.dispose();
 await session.agent.waitForIdle();
 await env.drain();
}
