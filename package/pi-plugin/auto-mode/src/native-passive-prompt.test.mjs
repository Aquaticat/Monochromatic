import assert from 'node:assert/strict';
import {createPassiveBaseOwner,createPassiveRunOwner} from '../dist/native/contract/integration/native-batch/passive-prompt.mjs';

//region Native callbacks retain their exact effect count and thrown values after capture failure.
const nativeFailure=new Error('Original native callback failure');
const base={customPrompt:undefined,forceSystemPrompt:undefined,selectedTools:[],toolSnippets:{},toolGuidelines:{},promptGuidelines:[],appendSystemPrompt:'',sections:{},cwd:'fixture',contextFiles:[],skills:[]};
function options(){return structuredClone(base);}
function createRun({unavailable=false}={}){
 const nativeBase=options();
 const ownedBase=Object.freeze({status:'ready',options:Object.freeze(options())});
 return createPassiveRunOwner({
  assertLive(){assert.ok(ownedBase);},
  readBase(){if(unavailable)throw new Error('Original base evidence unavailable');return ownedBase;},
  readNativeBase(){return nativeBase;}
 });
}
for(const mode of ['capture','read','normalize']){
 const owner=createPassiveBaseOwner();
 const counts={read:0,normalize:0};
 const normalized={native:'value outside capture profile'};
 function build(){return owner.build({read(){
  counts.read++;
  if(mode==='read')throw nativeFailure;
  const contextFiles=[];
  return {input:{contextFiles,customPrompt:undefined,appendSystemPrompt:''},resources:{contextFiles,systemPrompt:undefined,appendSystemPrompt:[]}};
 },normalize(){counts.normalize++;if(mode==='normalize')throw nativeFailure;return normalized;}});}
 if(mode==='capture'){
  assert.equal(build(),normalized);
  assert.throws(function missingCapture(){owner.read({options:normalized});});
 }else assert.throws(build,function exactFailure(error){return error===nativeFailure;});
 assert.equal(counts.read,1);
 assert.equal(counts.normalize,mode==='read'?0:1);
}
for(const mode of ['healthy','before','after','handler-error','report-error']){
 const owner=createRun({unavailable:mode==='before'});
 const runner={};
 const extension={path:'fixture'};
 function handler(){return mode;}
 const run=owner.start({runner,expandedPrompt:'Original prompt'});
 const working=options();
 const messages=[];
 const counts={invoked:0,reported:0};
 owner.enterNative({scope:run.handle,runner,seed:run.seed,working,snapshot:[{ext:extension,handlers:[handler]}],messages});
 async function invoke(){return await owner.invokeHandler({scope:run.handle,runner,extension,handler,messages,
  invoke(){counts.invoked++;if(mode==='after')working.unsupported='capture failure';if(mode==='handler-error'||mode==='report-error')throw nativeFailure;},
  reportError(error){counts.reported++;assert.equal(error,nativeFailure);if(mode==='report-error')throw nativeFailure;}
 });}
 if(mode==='report-error')await assert.rejects(invoke,function exactFailure(error){return error===nativeFailure;});
 else await invoke();
 assert.equal(counts.invoked,1);
 assert.equal(counts.reported,mode==='handler-error'||mode==='report-error'?1:0);
 if(mode==='report-error')continue;
 const result=owner.leaveNative({scope:run.handle,runner,working,messages});
 assert.deepEqual(result.systemPromptOptions,working);
}
for(const mode of ['before','after','native-error']){
 const owner=createRun({unavailable:mode==='before'});
 const runner={};
 const run=owner.start({runner});
 const working=options();
 const messages=[];
 owner.enterNative({scope:run.handle,runner,seed:run.seed,working,snapshot:[],messages});
 const emitted=owner.leaveNative({scope:run.handle,runner,working,messages});
 const sections={preamble:'Original native sections'};
 const counts={build:0,refresh:0};
 function render(){return owner.render({options:emitted.systemPromptOptions,build(){
  counts.build++;
  if(mode==='native-error')throw nativeFailure;
  return {sections,generated:[{slot:'invalid-capture',content:new Date(0)}]};
 }});}
 if(mode==='native-error')assert.throws(render,function exactFailure(error){return error===nativeFailure;});
 else assert.equal(render(),sections);
 assert.equal(counts.build,1);
 const composed={native:'refresh value'};
 assert.equal(owner.refresh({previousOptions:emitted.systemPromptOptions,compose(){counts.refresh++;return composed;}}),composed);
 assert.equal(counts.refresh,1);
}
console.log(JSON.stringify({complete:true,nativeCallbackOnce:true,nativeErrorIdentity:true,captureFailureIsolated:true}));
//endregion
