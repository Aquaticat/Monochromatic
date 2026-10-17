/** Exercise native preparation, callbacks, updates, and execution through a real disposable Pi session. @module */
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';
import {logger} from '@monochromatic-dev/module-logger/ts';
import {writeFile} from 'node:fs/promises';
import {createEnvironment} from '../dist/native/contract/integration/native-batch/environment.mjs';
import {createRootSessionFactory} from '../dist/native/contract/integration/native-batch/session-root.ts';
import {bindNativePolicyRuntime} from '../dist/native/contract/integration/native-batch/runtime.mjs';
import {createNativeSemanticOperatingPolicies} from '../dist/native/contract/integration/maintained-policy.mjs';
import {createDomainFixtureAssessment} from '../dist/native/contract/integration/native-batch/domain-fixture-assessment.mjs';

//region Real native callbacks surround one complete-group review.
/** Each mode runs in a separate process because native fixture configuration owns its disposable home. */
const mode=process.argv[2]??'parallel';
assert.ok(['parallel','sequential','implicit-sequential','invalid','before-block','tool-error','deny','cancel','notification-context','notification-turn','notification-followup','notification-primary','steer-user','policy-change'].includes(mode));
/** Event traces retain native call identity without depending on subprocess completion order. */
const events=[];
/** Model and execution counters distinguish missing coverage from successful withholding. */
const observations={assessments:0,httpCalls:0,attempts:0,selections:0,executions:0,active:0,maximumActive:0};
/** Native cancellation and asynchronous update completion stay drainable. */
const state={abortTask:undefined,updates:new Map(),sawNotification:false,followupProposed:false};
/** Notifications must reach a subsequent real model request and permit its fresh operation. */
const notification=mode.startsWith('notification-');
const env=await createEnvironment({
  policyText:'RUL:\n The complete proposed local inspection is permitted.\n',useNativeProvider:true,
  extensionFactories:[function originalCallbacks(pi){
    pi.on('tool_call',function before(event){
      events.push(`before:${event.toolCallId}`);
      assert.equal(event.input.command,event.input.command.trim());
      if(mode==='before-block'&&event.toolCallId==='phase-1')return {block:true,reason:'Authored native hook withheld this group'};
    });
    pi.on('tool_result',function after(event){events.push(`after:${event.toolCallId}`);});
  }]
});
const {createBashToolDefinition}=await import(pathToFileURL(join(env.packageRoot,'dist/core/tools/bash.js')).href);
const original=createBashToolDefinition(env.options.cwd);
/** Preserve native Bash execution while observing its real registration and context. */
const bash={
  ...original,
  ...(mode==='implicit-sequential'?{executionMode:'sequential'}:{}),
  prepareArguments(input){
    events.push('prepare');
    const normalized=typeof input.command==='string'?{...input,command:input.command.trim()}:input;
    return original.prepareArguments?.(normalized)??normalized;
  },
  async execute(id,input,signal,onUpdate,context){
    observations.executions++;observations.active++;
    observations.maximumActive=Math.max(observations.maximumActive,observations.active);
    events.push(`execute:${id}`);
    const update=Promise.withResolvers();state.updates.set(id,update);
    onUpdate({content:[{type:'text',text:'authored native update'}],details:{phaseProbe:true}});
    try{
      await wait(0);
      if(mode==='cancel'){state.abortTask=session.abort();return {content:[{type:'text',text:'authored cancellation result'}],details:{}};}
      if(mode==='tool-error'&&id==='phase-1')throw new Error('Authored native tool failure');
      return await Reflect.apply(original.execute,original,[id,input,signal,onUpdate,context]);
    }finally{
      observations.active--;events.push(`returned:${id}`);update.resolve();
    }
  }
};
const {session,root,lifecycle}=await createRootSessionFactory(env).create({options:{...env.options,tools:['bash'],customTools:[bash]}});
session.agent.getApiKey=function fixtureKey(){return process.env.FIXTURE_API_KEY;};
if(mode==='sequential'||mode==='cancel')session.agent.toolExecution='sequential';
/** Awaited native event subscribers expose updates that a replaced executor might drop. */
const unsubscribe=session.agent.subscribe(async function nativeEvents(event){
  if(event.type==='tool_execution_start')events.push(`start:${event.toolCallId}`);
  if(event.type==='tool_execution_end')events.push(`finish:${event.toolCallId}:${event.isError}`);
  if(event.type==='message_end'&&event.message.role==='toolResult')events.push(`message:${event.message.toolCallId}`);
  if(event.type==='tool_execution_update'&&event.partialResult.details?.phaseProbe){
    events.push(`update:${event.toolCallId}`);
    await state.updates.get(event.toolCallId).promise;
    events.push(`updated:${event.toolCallId}`);
  }
});
const sendAssessment=createDomainFixtureAssessment({settings:{relation:'permission',unresolvedClause:'prerequisite',operationDecision:mode==='deny'?'deny':'approve',operatingPolicy:true,httpTransport:true},observations});
/** The real session selects context retention, steering, or followup delivery. */
async function notify(){
  await session.sendCustomMessage({customType:'ad-process:notification',content:'Authored process completion',display:true,
    details:{command:'printf PHASE_NOTIFICATION',processId:'fixture-process'}},
    mode==='notification-turn'?{triggerTurn:true,deliverAs:'steer'}:
    mode==='notification-followup'?{triggerTurn:true,deliverAs:'followUp'}:{triggerTurn:false});
}
const calls=['A','B','C'].map(function proposal(letter,index){return {index,id:`phase-${index}`,type:'function',function:{name:'bash',arguments:JSON.stringify(mode==='invalid'&&index===1?{}:{command:`  printf PHASE_${letter}  `})}};});
const requests={count:0};
const runtime=bindNativePolicyRuntime({
  root,lifecycle,policyInput:env.policyInput,rootDirectory:env.options.cwd,parsePolicy:env.parser.parse,files:[],
  wrapToolDefinition:env.wrapToolDefinition,readSessionDisposalState:env.readSessionDisposalState,trace(){},
  ...createNativeSemanticOperatingPolicies(),
  async sendWire(input){
    observations.attempts++;events.push('assess');
    if(notification&&mode!=='notification-primary'&&observations.attempts===2)await notify();
    if(mode==='steer-user'&&observations.attempts===2)await session.steer('Stop the proposed operation. Reply without executing tools.');
    if(mode==='policy-change'&&observations.attempts===2)await writeFile(join(env.options.cwd,'AGENTS.md'),'RUL:\n The proposed inspection is prohibited.\n');
    return await sendAssessment(input);
  },
  async terminalFetch(url,options){
    const request=url instanceof Request?url:new Request(url,options);
    const body=await request.clone().text();
    if(body.includes('Authored process completion'))state.sawNotification=true;
    const ordinal=requests.count++;
    if(mode==='notification-primary'&&ordinal===0)await notify();
    const followup=notification&&ordinal>0&&state.sawNotification&&!state.followupProposed;
    if(followup)state.followupProposed=true;
    const proposed=ordinal===0||followup;
    const selected=ordinal===0?calls:[{index:0,id:'phase-3',type:'function',function:{name:'bash',arguments:JSON.stringify({command:'printf PHASE_FOLLOWUP'})}}];
    const chunk={id:'native-phase-fixture',object:'chat.completion.chunk',created:0,model:'fixture'};
    const first={...chunk,choices:[{index:0,delta:proposed?{role:'assistant',tool_calls:selected}:{role:'assistant',content:'done'},finish_reason:null}]};
    const last={...chunk,choices:[{index:0,delta:{},finish_reason:proposed?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}};
    return new Response(`data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
  }
});
await using cleanup={async [Symbol.asyncDispose](){await state.abortTask;session.dispose();await session.agent.waitForIdle();runtime.detach();unsubscribe();await env.drain();await logger.flush();}};
await session.prompt('Perform the complete proposed local inspection.');
await state.abortTask;
const withheld=['invalid','before-block','deny','steer-user','policy-change'].includes(mode);
assert.equal(observations.executions,withheld?0:mode==='cancel'?1:notification?4:3);
assert.equal(observations.attempts,['invalid','before-block'].includes(mode)?0:notification?4:2);
assert.equal(observations.active,0);
assert.equal(events.filter(event=>event==='prepare').length,notification?4:3);
const ids=['phase-0','phase-1','phase-2',...(notification?['phase-3']:[])];
assert.deepEqual(events.filter(event=>event.startsWith('message:')),ids.map(id=>`message:${id}`));
assert.deepEqual(events.filter(event=>event.startsWith('start:')),ids.map(id=>`start:${id}`));
assert.deepEqual(events.filter(event=>event.startsWith('before:')),ids.filter(id=>mode!=='invalid'||id!=='phase-1').map(id=>`before:${id}`));
for(const id of ids){
  assert.equal(events.filter(event=>event.startsWith(`finish:${id}:`)).length,1);
  if(!events.includes(`execute:${id}`))continue;
  assert.ok(events.indexOf(`before:${id}`)<events.indexOf(`execute:${id}`));
  assert.equal(events.slice(0,events.indexOf(`execute:${id}`)).filter(event=>event==='assess').length,id==='phase-3'?4:2);
  assert.ok(events.indexOf(`updated:${id}`)>events.indexOf(`returned:${id}`));
  assert.ok(events.indexOf(`after:${id}`)>events.indexOf(`updated:${id}`));
  assert.equal(events.filter(event=>event===`after:${id}`).length,1);
}
if(!withheld&&mode!=='cancel')assert.equal(observations.maximumActive,['sequential','implicit-sequential'].includes(mode)?1:3);
if(withheld)assert.equal(events.some(event=>event.startsWith('after:')),false);
if(notification)assert.equal(state.sawNotification,true,'Captured custom data must reach the next real primary request');
console.log(JSON.stringify({complete:true,mode,...observations,events}));
//endregion
