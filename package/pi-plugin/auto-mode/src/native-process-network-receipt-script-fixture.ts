/** Original subprocess programs retain serialized request boundaries. @module */

//region Programs cross the JavaScript boundary only through complete JSON string literals.
/**
 Preserve original adversarial names while preparing the real child programs.
 @param route - classifier endpoint accepted by the isolated process fixture
 @param request - original model and complete original question names
 @returns executable child programs for successful and failed receipt admission
 @example createReceiptProbeScripts({ route, request });
 */
export function createReceiptProbeScripts({route,request}:Readonly<{
 route:string;
 request:Readonly<{model:string;questions:readonly Readonly<{name:string}>[]}>;
}>):Readonly<{acceptedScript:string;failureScript:string}>{
 /** Encode the complete original request at its final JavaScript interpolation boundary. */
 const requestJSON=JSON.stringify(request);
 /** Real child assertions retain all accepted and rejected request boundaries. */
const acceptedScript=`
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
const route=${JSON.stringify(route)};
const body=${JSON.stringify(requestJSON)};
const expected=${JSON.stringify(request)};
const receipt=process.env.PI_AUTO_MODE_CLI_FIXTURE_REQUESTS;
let accepted=0;
for(const input of [route,new URL(route),new Request(route)]){
 const response=await fetch(input,{method:'POST',body});
 assert.deepEqual(await response.json(),{model:expected.model,answers:expected.questions.map(question=>({name:question.name,type:'predicate',probability:0.9})),usage:{input_tokens:0,output_tokens:0}});
 accepted++;
 const bytes=await readFile(receipt);
 assert.equal(bytes.at(-1),0x0a,'Every accepted response must already have a complete standard JSONL line');
 const entries=[];
 for await(const line of createInterface({input:createReadStream(receipt)}))entries.push(JSON.parse(line));
 assert.deepEqual(entries,Array.from({length:accepted},()=>({url:route,questions:expected.questions.length})));
 assert.equal((await stat(receipt)).mode&0o777,0o600);
}
const before=await readFile(receipt);
const blocked=[
 ['https://invalid.example/decisions',{method:'POST',body}],
 [route,undefined],
 [route,{method:'GET',body}],
 [route,{method:'POST',body:{unexpected:'object'}}],
];
for(const[input,init]of blocked)await assert.rejects(()=>fetch(input,init),{name:'NativeCliFixtureNetworkError',message:'External fetch is disabled in the native CLI process fixture'});
await assert.rejects(()=>fetch(route,{method:'POST',body:'{'}),SyntaxError);
for(const malformed of [null,{}, {model:1,questions:[]},{model:'m',questions:null}]){
 await assert.rejects(()=>fetch(route,{method:'POST',body:JSON.stringify(malformed)}),{name:'NativeCliFixtureNetworkError',message:'Native CLI classifier requires its actual serialized questions'});
}
for(const question of [null,{}, {name:1}]){
 await assert.rejects(()=>fetch(route,{method:'POST',body:JSON.stringify({model:'m',questions:[question]})}),{name:'NativeCliFixtureNetworkError',message:'Native CLI classifier requires named original questions'});
}
process.env.AUTO_MODE_LLMGATEWAY_API_KEY='incorrect-private-fixture-key';
await assert.rejects(()=>fetch(route,{method:'POST',body}),{name:'NativeCliFixtureNetworkError',message:'Native CLI classifier requires its synthetic fixture credential'});
assert.deepEqual(await readFile(receipt),before,'Rejected requests must not append a successful receipt');
console.log('accepted-original-names-and-standard-jsonl-before-response');
`;
/** A failed receipt append must precede any successful response. */
const failureScript=`
import assert from 'node:assert/strict';
await assert.rejects(()=>fetch(${JSON.stringify(route)},{method:'POST',body:${JSON.stringify(requestJSON)}}),function receiptWriteFailed(error){return error instanceof Error&&['EISDIR','EPERM'].includes(error.code);});
console.log('receipt-write-failure-prevents-local-response');
`;
 return Object.freeze({acceptedScript,failureScript});
}
//endregion
