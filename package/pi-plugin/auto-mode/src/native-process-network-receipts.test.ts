/** Built process receipts retain exact names, admission order and quiet completion. @module */
import {chmod,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe,expect,it} from '@monochromatic-dev/module-test/ts';
import {createReceiptProbeScripts} from './native-process-network-receipt-script-fixture.ts';
import {runReceiptProbe} from './native-process-network-receipt-process-fixture.ts';

//region All process and file mutations belong to one disposable receipt fixture.
/** Match the real consumer's built network guard. */
const guard=fileURLToPath(new URL('../dist/native/contract/integration/native-host/process-network-guard.ts',import.meta.url));
/** Keep private fixture artifacts inaccessible to other users. */
const PRIVATE_DIRECTORY_MODE=0o700;
/** Derive scratch from the actual current home instead of a named account. */
const scratch=join(homedir(),'temp','agent');
/**
 Exercise receipt admission through the actual built child guard.

 @returns after every child exits and complete output has been checked
 */
export async function runProcessNetworkReceiptCatalog():Promise<void>{
await mkdir(scratch,{recursive:true,mode:PRIVATE_DIRECTORY_MODE});
await chmod(scratch,PRIVATE_DIRECTORY_MODE);
/** Each invocation owns its receipt namespace. */
const directory=await mkdtemp(join(scratch,'native-cli-receipt-contract-'));
/** Cleanup follows complete child output and exit observation. */
await using fixture={
 /** Remove only this invocation's private receipt namespace. */
 async[Symbol.asyncDispose]():Promise<void>{await rm(directory,{recursive:true,force:true});}
};
/** Only the exact classifier endpoint is available to the child. */
const route='https://api.llmgateway.io/v1/decisions';
/** Original names include quotes, escapes and command-looking data. */
const request={
  model:'original-fixture-model',
  questions:[
    {name:'first-original-question'},
    {name:'quoted"\\question\nlast'},
    {name:"../..;$(printf RECEIPT_SYNTAX_BOUNDARY)'\\u0027</script>\n"}
  ]
};


/** Programs preserve their original source text and complete request literals. */
const{acceptedScript,failureScript}=createReceiptProbeScripts({route,request});
await describe({name:'built process network receipts',concurrency:1,children:[
 it({name:'withholds responses when the exact receipt destination cannot be appended',fn:async function failedReceipt():Promise<void>{
  /** A directory cannot be appended as a receipt file. */
  const actual=await runReceiptProbe({guard,directory,script:failureScript,receipt:directory});
  expect(actual).toBe('receipt-write-failure-prevents-local-response\n');
 }}),
 it({name:'retains original names and complete JSONL before responses while rejecting unrelated requests',fn:async function admittedReceipts():Promise<void>{
  /** Successful admissions use a fresh file and never inherit a parent's receipt destination. */
  const actual=await runReceiptProbe({guard,directory,script:acceptedScript,receipt:join(directory,'requests.jsonl')});
  expect(actual).toBe('accepted-original-names-and-standard-jsonl-before-response\n');
 }})
]});
console.log(JSON.stringify({complete:true,acceptedRoutes:3,originalNames:true,standardJSONLBeforeResponse:true,
 rejectionsLeaveReceiptUnchanged:true,receiptFailurePreventsResponse:true,completeChildStderrEmpty:true}));
}
//endregion
