/** Built request observation retains valid provider bodies independently of conversation size. @module */
import assert from 'node:assert/strict';
import {describe,expect,it} from '@monochromatic-dev/module-test/ts';

//region The consumer calls the shipped observer without asserting its implementation types.
/**
 Read a member only after its containing object is established.

 @param value - actual built result whose members remain untrusted
 @param key - observed member required by this consumer
 @returns original member without a substitute implementation
 */
function readMember({value,key}:Readonly<{value:unknown;key:string}>):unknown{
 assert.ok((value!==null)&&((typeof value)==='object'));
 const member:unknown=Reflect.get(value,key);
 return member;
}

/**
 Invoke an actual built method with its original receiver.

 @param owner - built receiver retaining observer ownership
 @param name - method required by the consumer protocol
 @param args - original invocation values
 @returns original method result for runtime validation
 */
function invoke({owner,name,args}:Readonly<{owner:unknown;name:string;args:readonly unknown[]}>):unknown{
 const method=readMember({value:owner,key:name});
 assert.ok((typeof method)==='function');
 const result:unknown=Reflect.apply(method,owner,args);
 return result;
}

/**
 Submit one serialized body through the built observer and its original provider sender.

 @param body - complete provider request retained byte for byte
 @param maxBodyBytes - explicit caller limit when deliberately configured
 @returns original owner, response and observed provider requests
 */
async function observe({body,maxBodyBytes}:Readonly<{body:string;maxBodyBytes?:number}>){
 const namespace:unknown=await import(new URL(
  '../dist/native/contract/lifecycle/root-lifecycle-retirement-entry/observer.mjs',import.meta.url,
 ).href);
 const factory=readMember({value:namespace,key:'createRequestObservationOwner'});
 assert.ok((typeof factory)==='function');
 /** The underlying provider retains this exact response object. */
 const response=Object.freeze({role:'assistant',content:[]});
 /** Capture real sender inputs instead of inferring transmission from the receipt. */
 const requests:unknown[]=[];
 /** Synchronous source capture is independent of provider body length. */
 const snapshot=Object.freeze({});
 /** Lifecycle identity remains stable throughout this single request. */
 const lease=Object.freeze({});
 const owner:unknown=Reflect.apply(factory,undefined,[{
  root:{session:{},manager:{}},
  lifecycle:{capture(){return lease;},assertActive(value:unknown){assert.equal(value,lease);}},
  collector:{capture(){return snapshot;},assertObservedFresh(value:unknown){assert.equal(value,snapshot);}},
  ...(maxBodyBytes===undefined?{}:{maxBodyBytes}),
  terminalFetch(_input:unknown,init:unknown){
   requests.push(readMember({value:init,key:'body'}));
   return new Response('{}');
  },
  async originalStream(_model:unknown,_context:unknown,options:unknown){
   await invoke({owner:options,name:'fetch',args:[
    'https://request-size.invalid/v1/chat/completions',{method:'POST',body},
   ]});
   return{
    async result(){return response;},
    async *[Symbol.asyncIterator](){yield response;},
   };
  },
 }]);
 const stream=await invoke({owner,name:'streamFunction',args:[{api:'openai-completions',id:'fixture'}, {}, {}]});
 expect(await invoke({owner:stream,name:'result',args:[]})).toBe(response);
 expect(requests).toEqual([body]);
 return{owner,response,requests};
}

/**
 Read the original retained request without changing observer ownership.

 @param observed - actual completed observer invocation
 @returns original serialized request receipt
 */
function readRequest(observed:Readonly<{owner:unknown;response:unknown}>):unknown{
 return readMember({value:invoke({owner:observed.owner,name:'observationFor',args:[observed.response]}),key:'request'});
}
//endregion

await describe({name:'built request observation size',children:[
 it({name:'retains an unchanged valid provider body larger than the former default ceiling',fn:async function largeDefaultBody(){
  /** This already-serialized primary request exceeds the former one-mebibyte ceiling. */
  const body=JSON.stringify({messages:[{role:'user',content:'界'.repeat(400_000)}]});
  const bytes=Buffer.byteLength(body);expect(bytes>1_048_576).toBe(true);
  const request=readRequest(await observe({body}));
  expect(readMember({value:request,key:'body'})).toBe(body);
  expect(readMember({value:request,key:'bytes'})).toBe(bytes);
 }}),
 it({name:'accepts an explicit UTF-8 byte limit exactly at the serialized body boundary',fn:async function explicitBoundary(){
  const body=JSON.stringify({messages:[{role:'user',content:'界'}]});
  const request=readRequest(await observe({body,maxBodyBytes:Buffer.byteLength(body)}));
  expect(readMember({value:request,key:'body'})).toBe(body);
 }}),
 it({name:'preserves provider success while withholding observation above an explicit byte limit',fn:async function explicitLimit(){
  const body=JSON.stringify({messages:[{role:'user',content:'界'}]});
  const observed=await observe({body,maxBodyBytes:Buffer.byteLength(body)-1});
  assert.throws(function unavailableObservation(){readRequest(observed);},function configuredFailure(error:unknown):boolean{
   assert.ok(Error.isError(error));expect(error.name).toBe('RequestObservationUnavailableError');
   assert.ok(Error.isError(error.cause));
   expect(error.cause.message.includes('observation')).toBe(true);
   return true;
  });
 }}),
 it({name:'accepts a deliberately configured limit larger than the former constructor ceiling',fn:async function configuredLargeBody(){
  const body=JSON.stringify({messages:[{role:'user',content:'x'.repeat(1_048_576)}]});
  const request=readRequest(await observe({body,maxBodyBytes:Buffer.byteLength(body)}));
  expect(readMember({value:request,key:'body'})).toBe(body);
 }}),
]});
