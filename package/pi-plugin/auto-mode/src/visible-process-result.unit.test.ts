/** Process metadata uses the same shell projection as original tool calls. @module */
import {describe,expect,it} from '@monochromatic-dev/module-test/ts';
import {buildVisibleContext} from '../dist/final/node/index.mjs';
import {contextFromBranch,toolResult} from './visible-context-fixture.ts';
import type {MockBranchEntry} from './visible-context-fixture-types.ts';

//region Known process metadata is executable syntax; output and unrelated details remain data.
/** Quoting and redirection distinguish structure from an unparsed command string. */
const command = "printf 'literal; $(data)' > output.log";
/** Installed process actions and notification payloads carry these finite metadata shapes. */
const cases = [
  {name:'start',details:{action:'start',process:{id:'proc-fixture',command,cwd:'/fixture'}},notification:false},
  {name:'list',details:{action:'list',processes:[{id:'proc-fixture',command}]},notification:false},
  {name:'stop',details:{action:'stop',result:{ok:true,info:{id:'proc-fixture',command}}},notification:false},
  {name:'write',details:{action:'write',process:{id:'proc-fixture',command}},notification:false},
  {name:'notification',details:{processId:'proc-fixture',command,summary:'visible result'},notification:true},
] as const;
await describe({name:'visible process results',children:[
  ...cases.map(function processMetadataCase(fixture){
    return it({name:`projects ${fixture.name} shell metadata without changing the original result`,fn:async function inspectVisibleMetadata(){
      /** Both variants pass through Pi's real session projector and the built visible-message module. */
      const entry:MockBranchEntry=fixture.notification
        ?{type:'custom_message',customType:'ad-process:notification',content:'complete visible result',details:fixture.details,display:true,timestamp:'fixture'}
        :toolResult({toolName:'process',output:'complete visible result',details:fixture.details});
      /** Compare against original data to detect destructive projection. */
      const original=JSON.stringify(fixture.details);
      /** Actual review context must contain structure while retaining literal data and visible output. */
      const context=buildVisibleContext(contextFromBranch({branch:[entry]}));
      expect(context).not.toContain(JSON.stringify(command));
      expect(context).toContain('"syntax":{"commands":');
      expect(context).toContain('literal; $(data)');
      expect(context).toContain('complete visible result');
      expect(JSON.stringify(fixture.details)).toBe(original);
    }});
  }),
  it({name:'retains command-looking literal data from unrelated tools and custom messages',fn:async function preserveLiteralDetails(){
    /** An arbitrary data property does not identify executable process metadata. */
    const details={command,note:'literal data'};
    /** Unrelated records keep their complete original visible content. */
    const context=buildVisibleContext(contextFromBranch({branch:[
      toolResult({toolName:'read',output:command,details}),
      {type:'custom_message',customType:'fixture-data',content:command,details,display:true,timestamp:'fixture'},
    ]}));
    expect(context).toContain(JSON.stringify(command));
    expect(context).not.toContain('"shell"');
  }}),
]});
//endregion
