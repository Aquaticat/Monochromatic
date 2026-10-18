import assert from 'node:assert/strict';
import {session,runtime,env,flushPolicyDiagnostics,readNativeBypassEnabled} from './approval-fixture.mjs';
import {fixtureState,outsideProfile} from './approval-fixture-options.mjs';

const statuses=[];
const notifications=[];
const expectedExecutions=outsideProfile?2:3;
await session.bindExtensions({uiContext:{
  ...session.extensionRunner.createContext().ui,
  setStatus(key,value){statuses.push({key,value});},
  notify(message,type){notifications.push({message,type});},
}});
{
 await using cleanup={async [Symbol.asyncDispose](){
  session.dispose();
  await session.agent.waitForIdle();
  runtime.detach();
  await env.drain();
  await flushPolicyDiagnostics();
 }};
 const shortcut=session.extensionRunner.getShortcuts({'app.thinking.cycle':['ctrl+e']}).get('shift+tab');
 assert.ok(shortcut,'Native host must retain the Shift+Tab bypass toggle');
 const ctx=session.extensionRunner.createContext();
 assert.equal(readNativeBypassEnabled(ctx),false);
 await shortcut.handler(ctx);
 assert.equal(readNativeBypassEnabled(ctx),true);
 const fixedBlock=await session.extensionRunner.emitToolCall({type:'tool_call',toolName:'bash',toolCallId:'fixed-guard-probe',input:{command:'ydotool key 1:1 1:0'}});
 assert.equal(fixedBlock?.block,true,'Fixed virtual-input guard must remain active during bypass');
 const inspection=await session.extensionRunner.emitToolCall({type:'tool_call',toolName:'bash',toolCallId:'inspection-probe',input:{command:'rg ydotool .'}});
 assert.equal(inspection,undefined,'Mentioning virtual input as inspection data must remain allowed');
 assert.deepEqual(statuses.at(-1),{key:'auto-mode:bypass',value:'auto-mode: bypass'});
 assert.ok(notifications.at(-1).message.includes('bypass enabled'));
 await session.prompt('Exercise the explicit bypass with native producer and parallel children.');
 assert.equal(fixtureState.executions,expectedExecutions);
 assert.equal(fixtureState.assessments,0);
 assert.equal(fixtureState.selections,0);
 assert.equal(runtime.inspect().lastReview,undefined,'Bypass must not fabricate a policy approval');
 const entries=session.sessionManager.getBranch().filter(function bypassEntry(entry){return entry.type==='custom'&&entry.customType==='auto-mode:bypass';});
 assert.equal(entries.filter(function enabledToggle(entry){return entry.data.kind==='toggle'&&entry.data.enabled;}).length,1);
 assert.ok(entries.some(function allowedEntry(entry){return entry.data.kind==='allow';}));
 await session.reload();
 assert.equal(readNativeBypassEnabled(session.extensionRunner.createContext()),true,'Reload must restore explicit bypass from the current session branch');
 const reloaded=session.extensionRunner.getShortcuts({'app.thinking.cycle':['ctrl+e']}).get('shift+tab');
 assert.ok(reloaded);
 await reloaded.handler(session.extensionRunner.createContext());
 assert.equal(readNativeBypassEnabled(session.extensionRunner.createContext()),false);
 assert.deepEqual(statuses.at(-1),{key:'auto-mode:bypass',value:undefined});
 fixtureState.requests=0;
 await session.prompt('Exercise the same prohibited operation with bypass disabled.');
 if(fixtureState.abortTask)await fixtureState.abortTask;
 assert.equal(fixtureState.executions,expectedExecutions,'Disabling bypass must restore guarded admission');
 assert.equal(fixtureState.assessments,outsideProfile?0:1);
 assert.equal(fixtureState.selections,outsideProfile?1:0,'Unsupported automatic analysis must fall back to manual approval');
 const fixedWhileDisabled=await session.extensionRunner.emitToolCall({type:'tool_call',toolName:'bash',toolCallId:'disabled-guard-probe',input:{command:'ydotool key 1:1 1:0'}});
 assert.equal(fixedWhileDisabled?.block,true);
 console.log(JSON.stringify({complete:true,shortcut:true,bypassExecutions:expectedExecutions,bypassAssessments:0,disabledRestoresGuard:true,outsideProfile,audit:true,status:true,reload:true,fixedGuard:true}));
}
