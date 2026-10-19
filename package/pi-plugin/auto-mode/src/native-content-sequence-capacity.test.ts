/**
 Growing JSON snapshots share chunk-reference storage while preserving every original digest.

 @module
 */
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {
 createInputContentStore,
 type RetainedInputContent
} from '../dist/native/contract/collector/run-prompt-custody-v3/input-content.ts';

//region Unchanged controls separate snapshot growth from initialization and measurement spread

/**
 Retained readers keep every version reachable until its post-GC measurement.
 */
type Workload = {
 readonly contents:readonly RetainedInputContent[];
 readonly expected:readonly string[];
};

/**
 Measured heap growth excludes the temporary original serializations.
 */
type Measurement = {
 readonly growing:boolean;
 readonly retainedHeapBytes:number;
};

/**
 Retain changing tails over the same generated JSON catalog.

 @param growing - changing tail forces distinct immutable snapshots

 @returns readers and independent original digests
 */
function workload(growing:boolean): Workload {
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
 const contents:RetainedInputContent[]=[];
 /**
  Digests are computed before the original input is passed to storage.
  */
 const expected:string[]=[];
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

 @param growing - distinct versions exercise shared-page storage

 @returns measured retained heap and workload identity
 */
function measure(growing:boolean): Measurement {
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
 */
const unchanged=[measure(false),measure(false)] as const;
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
