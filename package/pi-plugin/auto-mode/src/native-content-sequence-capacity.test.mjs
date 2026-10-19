/**
 Growing JSON snapshots share chunk-reference storage while preserving every original digest.

 @module
 */
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {nonNullishOrThrow} from '@monochromatic-dev/module-or-throw/ts';
import {
 createInputContentStore
} from '../dist/native/contract/collector/run-prompt-custody-v3/input-content.ts';

//region Unchanged controls separate snapshot growth from initialization and measurement spread

/**
 Repeated short catalog text separates reference storage from unique text storage.
 */
const CATALOG_VARIANTS=16_000;
/**
 Distinct snapshots reproduce complete-reference duplication across retained versions.
 */
const SNAPSHOT_VERSIONS=24;
/**
 Budget separates the measured 23.5-MB regression from unchanged-input spread.
 */
const ADDITIONAL_STORAGE_BUDGET=8_388_608;

/**
 Retain changing prefix or tail versions over the same unique JSON catalog.

 @param {{readonly growing:boolean;readonly prefix:boolean}} input - selected changing region

 @returns {{contents:ReturnType<ReturnType<typeof createInputContentStore>>[],expected:string[],retain:ReturnType<typeof createInputContentStore>}} live store, readers and digests
 */
function workload({
  growing,
  prefix
}) {
 /**
  Actual manager-local interner owns retained content.
  */
 const retain=createInputContentStore();
 /**
  Many short JSON tokens expose reference duplication independently of text duplication.
  */
 const catalog=Array.from(
   {length:16_000},
   function entry(
     _,
     index
   ){
  return {
    kind:'text',
    text:`Unchanged small input ${index%CATALOG_VARIANTS}`
  };
 }
 );
 /**
  All versions remain live through the measurement and independent verification.
  */
 const contents=[];
 /**
  Digests are computed before the original input is passed to storage.
  */
 const expected=[];
 for(let version=0;version<SNAPSHOT_VERSIONS;version++){
  /**
   Only the selected prefix or tail changes; the complete catalog stays unchanged.
   */
  const text=JSON.stringify(prefix?{
   prefix:Array.from(
     {length:growing?version:0},
     function prefixEntry(
       _,
       index
     ){
    return `message-${index}`;
   }
   ),
   catalog
  }:{
    catalog,
    tail:growing?version:0
  });
  expected.push(createHash('sha256')
    .update(text)
    .digest('hex'));
  contents.push(retain({
    text,
    json:true
  }));
 }
 return {
   contents,
   expected,
   retain
 };
}

/**
 Measure retained storage after temporary workload-construction frames have returned.

 @param {{readonly growing:boolean;readonly prefix:boolean}} input - selected changing region

 @returns {{growing:boolean,retainedHeapBytes:number}} measured retained heap and workload identity
 */
function measure({
  growing,
  prefix
}) {
 globalThis.gc();
 /**
  Collection precedes both baseline and final observations.
  */
 const before=process.memoryUsage()
   .heapUsed;
 /**
  Live readers preserve the entire tested history during collection.
  */
 const {
   contents,
   expected,
   retain
 }=workload({
   growing,
   prefix
 });
 globalThis.gc();
 /**
  Reading exact content happens after the retained-allocation measurement.
  */
 const retainedHeapBytes=process.memoryUsage()
   .heapUsed
   -before;
 /**
  Calling the live store after collection proves its maps survived the retained-heap observation.
  */
 const first=nonNullishOrThrow(contents[0]);
 assert.equal(
   retain({
     text:first.read(),
     json:true
   }),
   first
 );
 for(const [index,content]of contents.entries()){
  assert.equal(
    createHash('sha256')
      .update(content.read())
      .digest('hex'),
    expected[index]
  );
  assert.equal(
    content===contents[0],
    (!growing)||(index===0)
  );
 }
 return {
   growing,
   retainedHeapBytes
 };
}

/**
 Repeated identical-input controls establish the unchanged-input measurement spread.

 @type {readonly [ReturnType<typeof measure>,ReturnType<typeof measure>]}
 */
const unchanged=[
  measure({
    growing:false,
    prefix:false
  }),
  measure({
    growing:false,
    prefix:false
  })
];
/**
 Distinct tails expose storage duplicated across otherwise unchanged versions.
 */
const growing=measure({
  growing:true,
  prefix:false
});
/**
 Additional storage is compared with the larger unchanged-input measurement.
 */
const additional=growing.retainedHeapBytes-Math.max(...unchanged.map(function retained(item){
 return item.retainedHeapBytes;
}));
console.log(JSON.stringify({
  unchanged,
  growing,
  additional,
  versions:24,
  catalogEntries:16_000,
  exactOriginalDigests:true
}));
assert.ok(
  additional<ADDITIONAL_STORAGE_BUDGET,
  `Changing input snapshots retain ${additional} additional bytes`
);

/**
 Prefix controls keep the same live interner and unique catalog before changing the message prefix.

 @type {readonly [ReturnType<typeof measure>,ReturnType<typeof measure>]}
 */
const prefixUnchanged=[
 measure({
   growing:false,
   prefix:true
 }),
 measure({
   growing:false,
   prefix:true
 })
];
/**
 Earlier messages shift page alignment while the catalog text stays unchanged.
 */
const prefixGrowing=measure({
  growing:true,
  prefix:true
});
/**
 Additional retained storage excludes the larger unchanged-prefix control.
 */
const prefixAdditional=prefixGrowing.retainedHeapBytes-Math.max(...prefixUnchanged.map(function retained(item){
 return item.retainedHeapBytes;
}));
console.log(JSON.stringify({
 prefixUnchanged,
 prefixGrowing,
 additional:prefixAdditional,
 versions:SNAPSHOT_VERSIONS,
 catalogEntries:CATALOG_VARIANTS,
 exactOriginalDigests:true,
 liveStore:true
}));
assert.ok(
 prefixAdditional<ADDITIONAL_STORAGE_BUDGET,
 `Changing input prefixes retain ${prefixAdditional} additional bytes`
);

//endregion Unchanged controls separate snapshot growth from initialization and measurement spread
