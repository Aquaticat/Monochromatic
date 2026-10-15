import assert from 'node:assert/strict';
import {copyMessageData,copyToolMetadata} from '../../collector/run-prompt-custody/messages.mjs';
import {SourceCollectionError} from '../../collector/collector.mjs';
import {captureFailureMessage} from '../../collector/capture-failure-message.mjs';
import {RunPromptCustodyError} from '../../collector/run-prompt-custody-v3/failures.mjs';
import {SessionInputCaptureError} from '../../collector/run-prompt-custody-v3/loaded-inputs.mjs';

//region Complete capture crosses every former copier ceiling without changing the input.
const text='Original metadata. '.repeat(70_000);
const entries=Array.from({length:4_100},(_,ordinal)=>({ordinal}));
const original={text,entries};
for(const copy of [copyMessageData(original),copyToolMetadata(original)]){
 assert.equal(copy.text,text);
 assert.deepEqual(copy.entries,entries);
 assert.notEqual(copy.entries,entries);
 assert.ok(Object.isFrozen(copy.entries.at(-1)));
}
assert.equal(Object.isFrozen(original),false);
assert.equal(Object.isFrozen(entries),false);
const deep={};
let cursor=deep;
for(let depth=0;depth<10_000;depth++){cursor.next={};cursor=cursor.next;}
cursor.text='complete leaf';
for(const copier of [copyMessageData,copyToolMetadata]){
 cursor=copier(deep);
 for(let depth=0;depth<10_000;depth++){assert.ok(Object.isFrozen(cursor));cursor=cursor.next;}
 assert.equal(cursor.text,'complete leaf');
}
//endregion

//region Shared metadata is distinct from cycles and message aliases.
const shared={description:'complete shared schema'};
const copied=copyToolMetadata({left:shared,right:shared});
assert.deepEqual(copied.left,copied.right);
assert.notEqual(copied.left,copied.right);
assert.notEqual(copied.left,shared);
assert.throws(()=>copyMessageData({left:shared,right:shared}),SourceCollectionError);
const direct={};direct.self=direct;
const mutual={};mutual.child={parent:mutual};
const array=[];array.push(array);
for(const value of [direct,mutual,array]){
 assert.throws(()=>copyToolMetadata(value),/contains a cycle/);
 assert.throws(()=>copyMessageData(value),SourceCollectionError);
}
//endregion

//region Proxy and accessor rejection must precede observation side effects.
let reads=0;
const accessor=Object.defineProperty({},'text',{enumerable:true,get(){reads++;return 'text';}});
let traps=0;
const proxy=new Proxy({},{getPrototypeOf(){traps++;return Object.prototype;}});
for(const copier of [copyMessageData,copyToolMetadata]){
 assert.throws(()=>copier(accessor),SourceCollectionError);
 assert.throws(()=>copier(proxy),SourceCollectionError);
 assert.throws(()=>copier({value:Number.POSITIVE_INFINITY}),SourceCollectionError);
 assert.throws(()=>copier({value:()=>undefined}),SourceCollectionError);
 assert.throws(()=>copier(new Date()),SourceCollectionError);
}
assert.equal(reads,0);assert.equal(traps,0);
assert.equal(accessor.text,'text');Object.getPrototypeOf(proxy);
assert.equal(reads,1);assert.equal(traps,1);
const hidden=Object.defineProperty({},'text',{value:'preserved'});
assert.deepEqual(copyToolMetadata(hidden),{text:'preserved'});
assert.throws(()=>copyMessageData(hidden),SourceCollectionError);
//endregion
//region Host-visible errors retain deciding causes without invoking borrowed getters.
const cause=new SourceCollectionError('Tool metadata contains a cycle');
const sessionFailure=new SessionInputCaptureError(cause);
const runFailure=new RunPromptCustodyError([{at:'session-inputs',error:sessionFailure}]);
assert.ok(runFailure.message.includes(cause.message));
assert.equal(runFailure.errors[0],sessionFailure);
assert.equal(sessionFailure.errors[0],cause);
const hostile=Object.defineProperty(new Error('initial'),'message',{get(){throw new Error('Unexpected getter');}});
assert.equal(captureFailureMessage([hostile]),'');
const recursive=new AggregateError([],'recursive');recursive.errors.push(recursive,cause);
assert.equal(captureFailureMessage([recursive]),'recursive\n'+cause.message);
//endregion
console.log(JSON.stringify({complete:true,completeText:true,completeLists:true,deepCopy:true,cyclesRejected:true,borrowedInputsUnchanged:true}));
