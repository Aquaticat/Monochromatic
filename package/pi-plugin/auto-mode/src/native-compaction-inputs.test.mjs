/** Native compaction file collections remain data without broadening the ordinary copier. @module */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {env,fixture} from '../dist/native/contract/integration/native-batch/event-receipt-fixture.mjs';
import {copyToolMetadata} from '../dist/native/contract/collector/run-prompt-custody/messages.mjs';
import {projectNativeCompactionFilePaths} from '../dist/native/contract/collector/run-prompt-custody-v3/compaction-file-paths.ts';

//region Original SDK file-operation sets cross only their declared event input boundary

await using cleanup={async [Symbol.asyncDispose](){await env.drain();}};
const {createFileOps}=await import(pathToFileURL(join(env.packageRoot,'dist/core/compaction/utils.js')).href);
const ordinary=fixture({kind:'session_before_compact',handlers:[function observeOrdinaryData(){}]});
await ordinary.runner.emit({type:'session_before_compact',preparation:{fileOps:{read:[],written:[],edited:[]}},signal:new AbortController().signal});
assert.equal(ordinary.records()[0].length,2);

const fileOps=createFileOps();
const paths=['original/path','quote" backslash\\ newline\n世界','__proto__'];
for(const path of paths)fileOps.read.add(path);
fileOps.written.add('written/path');
const state={callbacks:0};
const input={type:'session_before_compact',preparation:{fileOps,note:'Other preparation fields remain complete'},signal:new AbortController().signal};
const observed=fixture({kind:input.type,handlers:[function updateNativeFiles(event){
 state.callbacks++;
 assert.equal(event,input);
 assert.equal(event.preparation.fileOps,fileOps);
 fileOps.read.add('after/path');
}]});
await observed.runner.emit(input);
assert.equal(state.callbacks,1);
const [records]=observed.records();
assert.equal(records.length,2);
assert.deepEqual(records[0].value.value.preparation.fileOps.read,{nativeCollection:'file-path-set',values:paths});
assert.deepEqual(records[1].value.value.preparation.fileOps.read,{nativeCollection:'file-path-set',values:[...paths,'after/path']});
for(const record of records){
 assert.deepEqual(record.value.value.preparation.fileOps.written,{nativeCollection:'file-path-set',values:['written/path']});
 assert.deepEqual(record.value.value.preparation.fileOps.edited,{nativeCollection:'file-path-set',values:[]});
 assert.equal(record.value.value.preparation.note,input.preparation.note);
 assert.ok(Object.isFrozen(record.value.value.preparation.fileOps.read.values));
}
fileOps.read.add('later/path');
assert.deepEqual(records[1].value.value.preparation.fileOps.read.values,[...paths,'after/path']);
assert.throws(function ordinaryMetadataStillRejectsSets(){copyToolMetadata(fileOps);});

for(const kind of ['session_before_tree','tool_call']){
 const wrong=fixture({kind,handlers:[function preserveOtherEvent(){}]});
 await wrong.runner.emit({type:kind,preparation:{fileOps}});
 assert.throws(function rejectWrongEventRole(){wrong.records();});
}
const output=fixture({kind:'session_before_compact',handlers:[function returnUnsupportedCollections(){return {preparation:{fileOps}};}]});
await output.runner.emit({type:'session_before_compact',preparation:{note:'Ordinary input'}});
assert.throws(function outputStillRejectsSets(){output.records();});
const noSignal=fixture({kind:'session_before_compact',handlers:[function preserveNoSignal(){}]});
await noSignal.runner.emit({type:'session_before_compact',preparation:{fileOps:createFileOps()}});
assert.deepEqual(noSignal.records()[0][0].value.value.preparation.fileOps.read,{nativeCollection:'file-path-set',values:[]});
const reads={unexpected:0};
const accessorSet=Object.defineProperty(new Set(['path']),'extra',{get(){reads.unexpected++;return 'hidden data';}});
const proxySet=new Proxy(new Set(['path']),{getPrototypeOf(){reads.unexpected++;return Set.prototype;}});
for(const invalid of [new Set([{}]),accessorSet,proxySet,Object.create(Set.prototype)]){
 const invalidOps=createFileOps();invalidOps.read=invalid;
 const rejected=fixture({kind:'session_before_compact',handlers:[function preserveInvalidData(){}]});
 await rejected.runner.emit({type:'session_before_compact',preparation:{fileOps:invalidOps}});
 assert.throws(function rejectUnsupportedNativeCollection(){rejected.records();});
}
const getterInput={type:'session_before_compact'};
Object.defineProperty(getterInput,'preparation',{enumerable:true,get(){reads.unexpected++;return {fileOps};}});
const getter=fixture({kind:'session_before_compact',handlers:[function preserveAccessorData(){}]});
await getter.runner.emit(getterInput);
assert.throws(function rejectPreparationAccessor(){getter.records();});
assert.equal(reads.unexpected,0,'Capture must not invoke collection properties, proxy traps or preparation accessors');
for(const preparation of [undefined,null,false,[],{note:'ordinary'},{fileOps:null},{fileOps:[]},{fileOps:{}},{fileOps:{read:null,written:'ordinary',edited:false}}]){
 const ordinaryInput={type:'session_before_compact',preparation};
 const retained=fixture({kind:ordinaryInput.type,handlers:[function preserveOrdinaryFields(){}]});
 await retained.runner.emit(ordinaryInput);
 assert.deepEqual(retained.records()[0][0].value.value,ordinaryInput);
}
for(const value of [undefined,null,false,'ordinary',[],new Set()])assert.equal(projectNativeCompactionFilePaths(value),value);
console.log(JSON.stringify({complete:true,actualSdkFileOperations:true,callbackIdentityPreserved:true,phaseSnapshotsIndependent:true,ordinarySetRejection:true}));

//endregion Original SDK file-operation sets cross only their declared event input boundary
