import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,chmod,mkdtemp,rm} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const guard=fileURLToPath(new URL('../dist/native/contract/integration/native-host/process-network-guard.ts',import.meta.url));
const scratch=join(homedir(),'temp','agent');
await mkdir(scratch,{recursive:true,mode:0o700});
await chmod(scratch,0o700);
const directory=await mkdtemp(join(scratch,'native-cli-receipt-contract-'));
await using fixture={async[Symbol.asyncDispose](){await rm(directory,{recursive:true,force:true});}};
const route='https://api.llmgateway.io/v1/decisions';
const request={model:'original-fixture-model',questions:[{name:'first-original-question'},{name:'quoted"\\question\nlast'},{name:"../..;$(printf RECEIPT_SYNTAX_BOUNDARY)'\\u0027</script>\n"}]};
const requestJSON=JSON.stringify(request);

async function run({script,receipt}){
 const child=spawn(process.execPath,['--import',guard,'--input-type=module','--eval',script],{
  cwd:directory,
  env:{...process.env,HOME:directory,PI_AUTO_MODE_CLI_FIXTURE_CHILD:'1',PI_AUTO_MODE_CLI_FIXTURE_REQUESTS:receipt,AUTO_MODE_LLMGATEWAY_API_KEY:'synthetic-local-fixture-only'},
  stdio:['ignore','pipe','pipe'],signal:AbortSignal.timeout(10_000),killSignal:'SIGKILL',
 });
 const output=[],diagnostics=[];
 child.stdout.on('data',chunk=>output.push(chunk));
 child.stderr.on('data',chunk=>diagnostics.push(chunk));
 const[code,signal]=await once(child,'close');
 const stderr=Buffer.concat(diagnostics).toString('utf8');
 assert.equal(signal,null,stderr);
 assert.equal(code,0,stderr);
 assert.equal(stderr,'','The isolated receipt probe must retain complete empty stderr');
 return Buffer.concat(output).toString('utf8');
}

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
assert.equal(await run({script:acceptedScript,receipt:join(directory,'requests.jsonl')}),
 'accepted-original-names-and-standard-jsonl-before-response\n');

const failureScript=`
import assert from 'node:assert/strict';
await assert.rejects(()=>fetch(${JSON.stringify(route)},{method:'POST',body:${JSON.stringify(requestJSON)}}),function receiptWriteFailed(error){return error instanceof Error&&['EISDIR','EPERM'].includes(error.code);});
console.log('receipt-write-failure-prevents-local-response');
`;
assert.equal(await run({script:failureScript,receipt:directory}),
 'receipt-write-failure-prevents-local-response\n');
console.log(JSON.stringify({complete:true,acceptedRoutes:3,originalNames:true,standardJSONLBeforeResponse:true,rejectionsLeaveReceiptUnchanged:true,receiptFailurePreventsResponse:true,completeChildStderrEmpty:true}));
