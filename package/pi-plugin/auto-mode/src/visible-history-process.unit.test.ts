/** Known earlier process metadata keeps visible fields when its command syntax is unavailable. @module */
import {describe,expect,it} from '@monochromatic-dev/module-test/ts';
import {buildVisibleContext} from '../dist/final/node/index.mjs';
import {contextFromBranch} from './visible-context-fixture.ts';
import type {MockBranchEntry} from './visible-context-fixture-types.ts';

/** Incomplete earlier source is never passed to a shell by this catalog. */
const partial="printf 'UNFINISHED_PROCESS_HISTORY";
/** Process identities and ordinary data survive every supported result shape. */
const record={id:'retained-process',command:partial,status:'retained-status'};
/** Renderer metadata locations retain their original discriminators and payload. */
const cases=[
 {name:'start',notification:false,details:{process:record}},
 {name:'list',notification:false,details:{processes:[record]}},
 {name:'stop',notification:false,details:{result:{info:record,success:true}}},
 {name:'write',notification:false,details:{process:record,bytesWritten:4}},
 {name:'notification',notification:true,details:{...record,notification:'retained-notification'}}
] as const;

await describe({name:'historical process metadata',children:cases.map(function metadataCase({name,notification,details}){
 return it({
  name:`retains incomplete ${name} command metadata and complete visible output`,
  fn:async function retainHistoricalProcessMetadata():Promise<void>{
   /** Actual Pi projection selects the process role before inspecting named command fields. */
   const branch:readonly MockBranchEntry[]=notification
    ?[{type:'custom_message',customType:'ad-process:notification',content:'Original visible process output',details,display:true,timestamp:'2026-10-18T00:00:00.000Z'}]
    :[{type:'message',message:{role:'toolResult',toolName:'process',isError:true,content:[{type:'text',text:'Original visible process output'}],details}}];
   /** Canonical context preserves unrelated metadata without leaking the malformed source string. */
   const context=buildVisibleContext(contextFromBranch({branch}));
   expect(context).toContain('"syntax":"unavailable"');
   expect(context).toContain('retained-process');
   expect(context).toContain('retained-status');
   expect(context).toContain('Original visible process output');
   expect(context).not.toContain(partial);
  }
 });
})});
