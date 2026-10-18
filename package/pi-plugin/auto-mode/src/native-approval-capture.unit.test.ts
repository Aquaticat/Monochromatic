/** Built operation captures retain one presentation view and release it at closure. @module */
import assert from 'node:assert/strict';
import {describe,it} from '@monochromatic-dev/module-test/ts';

//region Narrow the shipped protocol without importing source-only implementation helpers.
/** Consumer-visible operation capabilities exercised through the actual built module. */
interface ApprovalOperation extends Disposable {
 /** Read the original presentation view, including its absence or original capture failure. */
 readonly captureHost:()=>unknown;
}

/**
 Check the callable built protocol before a consumer borrows its lifetime.

 @param value - original factory result before narrowing
 @returns whether both original capabilities are callable
 */
function isOperation(value:unknown):value is ApprovalOperation{
 return value!==null&&typeof value==='object'
  &&'captureHost' in value&&typeof value.captureHost==='function'
  &&Symbol.dispose in value&&typeof value[Symbol.dispose]==='function';
}

/**
 Create an operation through the shipped module and retain its original receiver.

 @param capture - original bootstrap capability reader
 @returns actual built operation after consumer protocol checks
 */
async function operation(capture:()=>unknown):Promise<ApprovalOperation>{
 const namespace:unknown=await import(new URL(
  '../dist/native/contract/integration/action-policy/approval.mjs',import.meta.url,
 ).href);
 assert.ok(namespace!==null&&typeof namespace==='object'&&'createApprovalHostOperation' in namespace);
 const factory:unknown=namespace.createApprovalHostOperation;
 assert.ok(typeof factory==='function');
 const result:unknown=Reflect.apply(factory,undefined,[capture]);
 assert.ok(isOperation(result));
 return result;
}

/**
 Match the closed-operation diagnostic without accepting unrelated failures.

 @param error - actual value thrown by the shipped capability
 @returns whether the original closed-scope category and complete explanation agree
 */
function closedOperation(error:unknown):boolean{
 return Error.isError(error)&&error.name==='PolicyApprovalError'
  &&error.message==='The original approval capability scope has ended';
}
//endregion Built protocol and exact closed-scope diagnostic

//region Original host identity and absent or failed capture behavior.
await describe({
 name:'built original approval capability capture',
 children:[
  it({name:'shares one borrowed host through repeated reads without freezing it',fn:async function captureOriginalHost(){
   const counts={calls:0};
   const host={current:'original native capabilities'};
   using scope=await operation(function capture(){counts.calls++;return host;});
   assert.equal(scope.captureHost(),host);
   host.current='borrowed capabilities remain mutable';
   assert.equal(scope.captureHost(),host);
   assert.equal(counts.calls,1);
   assert.equal(Object.isFrozen(host),false);
  }}),
  it({name:'retains absent presentation capability without querying its source again',fn:async function captureAbsentHost(){
   const counts={calls:0};
   using scope=await operation(function captureMissing(){counts.calls++;return undefined;});
   assert.equal(scope.captureHost(),undefined);
   assert.equal(scope.captureHost(),undefined);
   assert.equal(counts.calls,1);
  }}),
  it({name:'retains original failed capture identity including falsy thrown values',fn:async function captureFailedHost(){
   const failures:readonly unknown[]=[undefined,null,false,'original capture failure',Symbol('original failed presentation capture'),new Error('original capture error')];
   await Promise.all(failures.map(async function verifyFailure(failure){
    const counts={calls:0};
    using scope=await operation(function failCapture(){counts.calls++;throw failure;});
    assert.throws(function captureFirst(){scope.captureHost();},function originalFirst(error:unknown){return error===failure;});
    assert.throws(function captureAgain(){scope.captureHost();},function originalAgain(error:unknown){return error===failure;});
    assert.equal(counts.calls,1);
   }));
  }}),
  it({name:'captures fresh capabilities for the next operation and rejects reads after closure',fn:async function closeAndRecapture(){
   const counts={calls:0};
   const hosts=[{name:'original context'},{name:'reloaded context'}];
   function capture(){const host=hosts[counts.calls];counts.calls++;return host;}
   using first=await operation(capture);
   assert.equal(first.captureHost(),hosts[0]);
   first[Symbol.dispose]();
   first[Symbol.dispose]();
   assert.throws(function readClosed(){first.captureHost();},closedOperation);
   assert.equal(counts.calls,1);
   using next=await operation(capture);
   assert.equal(next.captureHost(),hosts[1]);
   assert.equal(counts.calls,2);
  }}),
  it({name:'closing before the first read never queries the bootstrap source',fn:async function closeUnreadCapture(){
   const counts={calls:0};
   using scope=await operation(function unusedCapture(){counts.calls++;return {};});
   scope[Symbol.dispose]();
   assert.throws(function readClosed(){scope.captureHost();},closedOperation);
   assert.equal(counts.calls,0);
  }}),
 ],
});
//endregion Built host identity, absence, failure, next-operation freshness and closure
