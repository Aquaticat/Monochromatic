/**
 Growing JSON snapshots share chunk-reference storage while preserving every original digest.

 @module
 */
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {
 createInputContentStore
} from '../dist/native/contract/collector/run-prompt-custody-v3/input-content.ts';

//region Unchanged controls separate snapshot growth from initialization and measurement spread

/**
 Retain changing tails over the same generated JSON catalog.

 @param {boolean} growing - changing tail forces distinct immutable snapshots

 @returns {{contents:ReturnType<ReturnType<typeof createInputContentStore>>[],expected:string[]}} readers and digests
 */
function workload(growing) {
 /**
  Actual manager-local interner owns retained content.
  */
 const retain=createInputContentStore();
 /**
  Many short JSON tokens expose reference duplication independently of text duplication.
  */
 const catalog=Array.from({length:16_000},function entry(_,index){
  return {kind:'text',text:`Unchanged small input ${index%3}`};
 });
 /**
  All versions remain live through the measurement and independent verification.
  */
 const contents=[];
 /**
  Digests are computed before the original input is passed to storage.
  */
 const expected=[];
 for(let version=0;version<24;version++){
  /**
   Only the version tail changes between complete snapshots.
   */
  const text=JSON.stringify({catalog,tail:growing?version:0});
  expected.push(createHash('sha256').update(text).digest('hex'));
  contents.push(retain({text,json:true}));
 }
 return {contents,expected};
}

/**
 Measure retained storage after temporary workload-construction frames have returned.

 @param {boolean} growing - distinct versions exercise shared-page storage

 @returns {{growing:boolean,retainedHeapBytes:number}} measured retained heap and workload identity
 */
function measure(growing) {
 globalThis.gc();
 /**
  Collection precedes both baseline and final observations.
  */
 const before=process.memoryUsage().heapUsed;
 /**
  Live readers preserve the entire tested history during collection.
  */
 const {contents,expected}=workload(growing);
 globalThis.gc();
 /**
  Reading exact content happens after the retained-allocation measurement.
  */
 const retainedHeapBytes=process.memoryUsage().heapUsed-before;
 for(const [index,content]of contents.entries()){
  assert.equal(createHash('sha256').update(content.read()).digest('hex'),expected[index]);
  assert.equal(content===contents[0],!growing||index===0);
 }
 return {growing,retainedHeapBytes};
}

/**
 Repeated identical-input controls establish the unchanged-input measurement spread.

 @type {readonly [ReturnType<typeof measure>,ReturnType<typeof measure>]}
 */
const unchanged=[measure(false),measure(false)];
/**
 Distinct tails expose storage duplicated across otherwise unchanged versions.
 */
const growing=measure(true);
/**
 Additional storage is compared with the larger unchanged-input measurement.
 */
const additional=growing.retainedHeapBytes-Math.max(...unchanged.map(function retained(item){
 return item.retainedHeapBytes;
}));
console.log(JSON.stringify({unchanged,growing,additional,versions:24,catalogEntries:16_000,exactOriginalDigests:true}));
assert.ok(additional<8*1024*1024,`Changing input snapshots retain ${additional} additional bytes`);

//endregion Unchanged controls separate snapshot growth from initialization and measurement spread
