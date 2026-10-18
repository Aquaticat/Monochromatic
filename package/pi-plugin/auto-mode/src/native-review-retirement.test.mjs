/** Completed native groups retain outcomes without retaining every derived review input. @module */
import assert from 'node:assert/strict';
import {
  createPreparedGroup,
  PreparedGroupError
} from '../dist/native/contract/integration/native-batch/prepared-group.mjs';

const GROUP_COUNT=12;
const REVIEW_ITEMS=1_000_000;
const MEBIBYTE=1_048_576;
const sourceState={
  current:true,
  checks:0
};
/** Fixture source dependencies stay live independently of the completed group's execution phase. */
function assertSourceCurrent(){
  sourceState.checks++;
  assert.equal(
    sourceState.current,
    true
  );
}
/** Real native membership and execution owners wrap deliberately visible fixture review storage. */
async function completeGroup(index){
  const id=`fixture-${index}`;
  const group=createPreparedGroup({
    response:{content:[{
      type:'toolCall',
      id,
      name:'fixture',
      arguments:{}
    }]},
    stream:Object.freeze({}),
    signal:new AbortController().signal,
    assertOperationCurrent:assertSourceCurrent,
    captureHost(){return undefined;},
    origins:new WeakMap(),
    constructSource(context){
      context()
        .bindSourceCheck(assertSourceCurrent);
      return Object.freeze({
        prepare(){return undefined;},
        checkpoint(){return undefined;},
        assertDependenciesCurrent:assertSourceCurrent
      });
    },
    async reviewSource(){
      return Object.freeze({
        outcome:Object.freeze({
          state:'resolved',
          verdict:'approve'
        }),
        inputs:Array.from(
          {length:REVIEW_ITEMS},
          function fixtureReviewItem(){return index;}
        ),
        assertCurrent:assertSourceCurrent
      });
    },
    preparePrograms(){return undefined;},
    retainSources(){return undefined;},
    readBypass(){return false;}
  });
  const members=Object.freeze([Object.freeze({
    id,
    name:'fixture',
    input:Object.freeze({})
  })]);
  assert.deepEqual(
    await group.assess({members}),
    {block:false}
  );
  group.current();
  const token=group.beginExecution(group.memberFor(id));
  group.finishExecution(token);
  const review=group.review();
  assert.equal(
    review.inputs
      .length,
    REVIEW_ITEMS
  );
  group.close();
  return {
    group,
    review
  };
}

//region The latest diagnostic keeps its original review while completed contexts retire derived inputs.
globalThis.gc();
const initial=process.memoryUsage()
  .heapUsed;
const groups=[];
const diagnostic={latest:undefined};
for(let index=0;index<GROUP_COUNT;index++){
  const completed=await completeGroup(index);
  groups.push(completed.group);
  diagnostic.latest=completed.review;
}
globalThis.gc();
const retained=process.memoryUsage()
  .heapUsed
  -initial;
assert.equal(
  groups.length,
  GROUP_COUNT
);
assert.equal(
  diagnostic.latest
    .inputs
    .length,
  REVIEW_ITEMS
);
assert.ok(
  retained>(6
    *MEBIBYTE),
  'Positive control: the actual latest review remains retained'
);
assert.ok(
  retained<(32
    *MEBIBYTE),
  `Closed groups retain ${retained} bytes, exceeding 32 MiB`
);
for(const group of groups){
  assert.equal(
    group.review()
      .outcome
      .verdict,
    'approve'
  );
  assert.throws(
    function retiredExecution(){group.current();},
    PreparedGroupError
  );
  group.close();
}
diagnostic.latest
  .assertCurrent();
sourceState.current=false;
assert.throws(function changedLatestSource(){diagnostic.latest
  .assertCurrent();});
console.log(JSON.stringify({
  complete:true,
  groups:groups.length,
  retainedHeapBytes:retained,
  latestDiagnosticPreserved:true,
  terminalOutcomesPreserved:true,
  retiredExecutionRejected:true,
  latestSourceChangesRejected:true
}));
//endregion
