/** Built cache refresh preserves original policy ownership across every asynchronous stage. @module */
import assert from 'node:assert/strict';
import {describe,it} from '@monochromatic-dev/module-test/ts';
import {cacheFailure,cacheFixture,type CacheView} from './native-relevance-cache-fixture.ts';

//region Successful refreshes reuse complete entries without granting permission.
await describe({name:'',children:[
  it({name:'joins recursive refresh and reuses unchanged rules across original sources',fn:async function reuseRules(){
    await using fixture=await cacheFixture();
    const cache=fixture.open();
    const recursive:{pending?:Promise<CacheView>}={};
    fixture.callbacks.onAssessment=function reenter(){
      recursive.pending=cache.refresh();
    };
    const pending=cache.refresh();
    assert.equal(cache.refresh(),pending);
    const initial=await pending;
    assert.equal(recursive.pending,pending);
    assert.equal(cache.readCurrent(),initial);
    assert.deepEqual(initial.requestedRuleIds,['AAA','BBB']);
    assert.equal(initial.permission,false);
    assert.equal(initial.exclusionsAdmitted,false);
    const second=fixture.open();
    const reused=await second.refresh();
    assert.deepEqual(reused.requestedRuleIds,[]);
    assert.equal(fixture.requests.length,1);
    fixture.replace('AAA: Ask before publishing.\n\nBBB: Require a fresh response.\n');
    assert.throws(function oldView(){
      cache.assertCurrent(initial);
    });
    const changed=await cache.refresh();
    assert.deepEqual(changed.requestedRuleIds,['BBB']);
    assert.deepEqual(changed.candidateRuleIds,['AAA','BBB']);
    assert.equal(fixture.requests.length,2);
    assert.equal(cache.readCurrent(),changed);
  }}),
  //endregion

  //region Original source and cancellation survive newly awaited filesystem stages.
  ...['cache-hit','cache-published','relevance-classify-batch','relevance-view-prepared'].flatMap(function eventCases(boundary){
    return ['policy','cancellation'].map(function mutationCase(mutation){
      return it({name:`rejects ${mutation} changes during ${boundary}`,fn:async function rejectLateChange(){
        await using fixture=await cacheFixture();
        if(boundary==='cache-hit')await fixture.open().refresh();
        const owner=fixture.open();
        const controller=new AbortController();
        const cancellation=new Error('Fixture refresh cancelled');
        const events:string[]=[];
        fixture.callbacks.onEvent=function changeDuringOperation(event){
          if(event!==boundary)return;
          events.push(event);
          if(mutation==='policy')fixture.replace('AAA: Policy replaced during filesystem work.\n');
          else controller.abort(cancellation);
        };
        const error=await cacheFailure(owner.refresh({signal:controller.signal}));
        assert.ok(events.length>0,'The requested asynchronous boundary must be exercised');
        if(mutation==='cancellation')assert.equal(error,cancellation);
        else {
          assert.ok(Error.isError(error));
          assert.equal(error.message,'Fixture original policy changed');
        }
        assert.throws(function noView(){
          owner.readCurrent();
        });
      }});
    });
  }),
  it({name:'rejects source replacement during classifier delivery',fn:async function rejectAssessmentChange(){
    await using fixture=await cacheFixture();
    const owner=fixture.open();
    fixture.callbacks.onAssessment=function replaceSource(){
      fixture.replace('AAA: Replacement policy.\n');
    };
    const error=await cacheFailure(owner.refresh());
    assert.ok(Error.isError(error));
    assert.equal(error.message,'Fixture original policy changed');
    assert.equal(fixture.requests.length,1);
    assert.throws(function noView(){
      owner.readCurrent();
    });
  }}),
  it({name:'captures the caller signal once before recursive and asynchronous work',fn:async function originalSignal(){
    await using fixture=await cacheFixture();
    const owner=fixture.open();
    const controller=new AbortController();
    const cancellation=new Error('Original caller cancelled');
    const reads:string[]=[];
    const input={get signal(){
      reads.push('signal');
      return controller.signal;
    }};
    fixture.callbacks.onAssessment=function cancelOriginal(){
      controller.abort(cancellation);
    };
    assert.equal(await cacheFailure(owner.refresh(input)),cancellation);
    assert.deepEqual(reads,['signal']);
  }}),
  it({name:'retains classifier and failure-reporting errors in their original order',fn:async function reportingFailure(){
    await using fixture=await cacheFixture();
    const original=new Error('Classifier delivery failed');
    const reporting=new Error('Failure reporting failed');
    fixture.callbacks.onAssessment=function rejectDelivery(){
      throw original;
    };
    fixture.callbacks.onEvent=function rejectReporting(event){
      if(event==='relevance-refresh-failed')throw reporting;
    };
    const owner=fixture.open();
    const pending=owner.refresh();
    const error=await cacheFailure(pending);
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors,[original,reporting]);
    assert.equal(owner.refresh(),pending);
    assert.throws(function noView(){
      owner.readCurrent();
    });
  }}),
  //endregion

  //region Untrusted answer membership must be complete before the first publication.
  ...[
    {name:'non-array',answer:null},
    {name:'missing answer',answer:[{id:'AAA',probability:0.25}]},
    {name:'duplicate handle',answer:[{id:'AAA',probability:0.25},{id:'AAA',probability:0.5}]},
    {name:'foreign handle',answer:[{id:'AAA',probability:0.25},{id:'CCC',probability:0.5}]},
    {name:'non-object answer',answer:[{id:'AAA',probability:0.25},null]},
    {name:'missing probability',answer:[{id:'AAA',probability:0.25},{id:'BBB'}]},
    {name:'text probability',answer:[{id:'AAA',probability:0.25},{id:'BBB',probability:'0.5'}]},
    {name:'non-finite probability',answer:[{id:'AAA',probability:0.25},{id:'BBB',probability:Number.NaN}]},
    {name:'negative probability',answer:[{id:'AAA',probability:0.25},{id:'BBB',probability:-0.1}]},
    {name:'oversized probability',answer:[{id:'AAA',probability:0.25},{id:'BBB',probability:1.1}]},
  ].map(function invalidAnswers(testCase){
    return it({name:`rejects ${testCase.name} before publishing any estimate`,fn:async function rejectAnswers(){
      await using fixture=await cacheFixture();
      const events:string[]=[];
      fixture.callbacks.onEvent=function retainEvent(event){
        events.push(event);
      };
      fixture.callbacks.answer=function deliverInvalid(){
        return testCase.answer;
      };
      const owner=fixture.open();
      const pending=owner.refresh();
      const error=await cacheFailure(pending);
      assert.ok(Error.isError(error));
      assert.equal(error.name,'RuleRelevanceCacheError');
      assert.equal(events.includes('cache-published'),false);
      assert.equal(events.includes('relevance-view-prepared'),false);
      assert.equal(owner.refresh(),pending);
      delete fixture.callbacks.answer;
      assert.deepEqual((await fixture.open().refresh()).requestedRuleIds,['AAA','BBB']);
    }});
  }),
  //endregion
]});
