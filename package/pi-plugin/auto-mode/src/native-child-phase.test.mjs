/** Exercise actual child preparation and terminal capture through the native Codemode consumer. @module */
import assert from 'node:assert/strict';
import {wait} from '@monochromatic-dev/module-async-time/ts';
import {readDomainFixtureSettings} from '../dist/native/contract/integration/native-batch/domain-fixture-settings.mjs';
import {createDomainFixtureEnvironment} from '../dist/native/contract/integration/native-batch/domain-fixture-environment.mjs';
import {createDomainFixtureRuntime} from '../dist/native/contract/integration/native-batch/domain-fixture-runtime.mjs';

//region Genuine SDK callbacks change only ordinary child inputs and cancellation.
const selected=process.argv.find(argument=>argument.startsWith('--child-phase='));
const contrast=selected?.slice('--child-phase='.length);
assert.ok(['normal','before-block','unsealed','cancel'].includes(contrast));
const mode=`child-${contrast}`;
const settings=await readDomainFixtureSettings();
const observations={contextCalls:0,lateContextMutations:0,progressCalls:0,assessments:0,
  executions:0,requests:0,httpCalls:0,originalBody:undefined};
const events=[];
const pending={abort:undefined};
const {env,session,root,lifecycle}=await createDomainFixtureEnvironment({settings,observations,
  readRuntime(){return runtime;},extensionFactories:[function childCallbacks(pi){
    pi.on('tool_call',async function before(event){
      if(event.toolName!=='fixture_value')return;
      events.push(`before:${event.input.path}`);
      if(event.input.path!=='second')return;
      if(contrast==='before-block')return {block:true,reason:'Authored child callback withheld this group'};
      if(contrast==='unsealed')Object.defineProperty(event.input,'authoredHiddenData',{value:true});
      if(contrast==='cancel'){pending.abort=session.abort();await wait(0);}
    });
    pi.on('tool_result',function after(event){
      if(event.toolName==='fixture_value')events.push(`after:${event.input.path}`);
    });
  }]});
const code='const value = await tools.fixture_value({path:"seed"});\nreturn await Promise.allSettled([tools.fixture_value({path:value}),tools.fixture_value({path:"second"})]);';
const runtime=createDomainFixtureRuntime({settings,observations,env,session,root,lifecycle,code,
  programProfile:'awaited-string-result-then-literal-parallel'});
await using cleanup={async [Symbol.asyncDispose](){
  await pending.abort;await settings.changeControl.drain();session.dispose();
  await session.agent.waitForIdle();runtime.detach();await env.drain();
}};
await session.prompt('Exercise complete native child preparation and terminal retention.');
await pending.abort;
const inspection=runtime.inspect().lastJudgment.inspect();
const program=inspection.rootPrograms[0];
assert.ok(program,'The actual native Codemode consumer must open its program');
assert.equal(program.groups.length,2);
assert.equal(events.filter(event=>event.startsWith('before:')).length,3);
assert.equal(observations.executions,contrast==='normal'?3:1);
assert.equal(events.filter(event=>event.startsWith('after:')).length,contrast==='normal'?3:1);
assert.equal(inspection.memberExecutions[0].state,'returned');
const returns=program.groups[1].nativeReturns;
assert.deepEqual(returns.map(record=>record.state),contrast==='unsealed'?['returned','threw']:['returned','returned']);
assert.deepEqual(returns.map(record=>record.conversionCount),contrast==='unsealed'?[1,0]:[1,1]);
if(contrast==='unsealed')assert.match(String(returns[1].failure),/hidden|enumerable/iu);
console.log(JSON.stringify({complete:true,mode,executions:observations.executions,
  nativeStates:returns.map(record=>record.state),events}));
//endregion
