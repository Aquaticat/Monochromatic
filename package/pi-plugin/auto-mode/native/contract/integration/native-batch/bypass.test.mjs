import assert from 'node:assert/strict';
import {session,runtime,env,flushPolicyDiagnostics,readNativeBypassEnabled} from './approval-fixture.mjs';
import {fixtureState} from './approval-fixture-options.mjs';

const statuses=[];
const notifications=[];
await session.bindExtensions({uiContext:{
  ...session.extensionRunner.createContext().ui,
  setStatus(key,value){statuses.push({key,value});},
  notify(message,type){notifications.push({message,type});},
}});
try {
 const shortcut=session.extensionRunner.getShortcuts({'app.thinking.cycle':['ctrl+e']}).get('shift+tab');
 assert.ok(shortcut,'Native host must retain the Shift+Tab bypass toggle');
 const ctx=session.extensionRunner.createContext();
 assert.equal(readNativeBypassEnabled(ctx),false);
 await shortcut.handler(ctx);
 assert.equal(readNativeBypassEnabled(ctx),true);
 assert.deepEqual(statuses.at(-1),{key:'auto-mode:bypass',value:'auto-mode: bypass'});
 assert.match(notifications.at(-1).message,/bypass enabled/);
 await session.prompt('Exercise the explicit bypass with native producer and parallel children.');
 assert.equal(fixtureState.executions,3);
 assert.equal(fixtureState.assessments,0);
 assert.equal(fixtureState.selections,0);
 assert.equal(runtime.inspect().lastReview,undefined,'Bypass must not fabricate a policy approval');
 const entries=session.sessionManager.getBranch().filter(entry=>entry.type==='custom'&&entry.customType==='auto-mode:bypass');
 assert.equal(entries.filter(entry=>entry.data.kind==='toggle'&&entry.data.enabled).length,1);
 assert.ok(entries.some(entry=>entry.data.kind==='allow'));
 await shortcut.handler(session.extensionRunner.createContext());
 assert.equal(readNativeBypassEnabled(session.extensionRunner.createContext()),false);
 assert.deepEqual(statuses.at(-1),{key:'auto-mode:bypass',value:undefined});
 fixtureState.requests=0;
 await session.prompt('Exercise the same prohibited operation with bypass disabled.');
 assert.equal(fixtureState.executions,3,'Disabling bypass must restore the prohibition');
 assert.ok(fixtureState.assessments>0);
 console.log(JSON.stringify({complete:true,shortcut:true,bypassExecutions:3,bypassAssessments:0,disabledRestoresProhibition:true,audit:true,status:true}));
}finally{
 session.dispose();
 await session.agent.waitForIdle();
 runtime.detach();
 await env.drain();
 await flushPolicyDiagnostics();
}
