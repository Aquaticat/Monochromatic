import assert from 'node:assert/strict';
import {session,runtime,env,flushPolicyDiagnostics} from './approval-fixture.mjs';
import {fixtureState,policyText} from './approval-fixture-options.mjs';

//region Exercise actual session projection and outgoing assessments across completed turns.
const oldMarker='OLD_CONVERSATION_MUST_STAY_LOCAL';
const hiddenMarker='HIDDEN_MESSAGE_MUST_STAY_LOCAL';
const longUser=`CURRENT_USER_BEGIN ${'complete selected content '.repeat(1200)} CURRENT_USER_END`;
const messages=[
 {role:'user',content:oldMarker,timestamp:1},
 ...Array.from({length:8},function visibleHistory(_,index){return {
   role:'custom',customType:'context-fixture',content:`Visible prior message ${index}`,display:true,timestamp:index+2
 };}),
 {role:'custom',customType:'hidden-fixture',content:hiddenMarker,display:false,timestamp:10}
];

/** Inspect exactly what the assessment consumer receives, including every question. */
function conversation(wire){
 assert.equal(wire.state.fullPolicy,policyText);
 assert.equal(Object.hasOwn(wire.state,'originalRequestBody'),false);
 const body=JSON.stringify(wire);
 assert.equal(body.includes(oldMarker),false);
 assert.equal(body.includes(hiddenMarker),false);
 const selected=wire.state.additionalPolicies.filter(function selectedConversation(source){
   return source.inputLocation?.field==='visibleConversation';
 });
 assert.equal(selected.length,1);
 return JSON.parse(selected[0].content);
}

/** Pi's native prompt path represents user text as content blocks. */
function userText(message){
 if(typeof message.content==='string')return message.content;
 return message.content.filter(function text(block){return block.type==='text';})
   .map(function value(block){return block.text;}).join('');
}

{
 await using cleanup={async [Symbol.asyncDispose](){
  session.dispose();
  await session.agent.waitForIdle();
  runtime.detach();
  await env.drain();
  await flushPolicyDiagnostics();
 }};
 for(const message of messages)session.sessionManager.appendMessage(message);
 session.agent.state.messages=messages;
 fixtureState.proposalLimit=4;
 await session.prompt(longUser);
 assert.equal(fixtureState.wires.length,4);
 assert.equal(fixtureState.executions,12);
 assert.ok(fixtureState.originalBody.includes(oldMarker),'Positive control: the main-agent request still contains the old prefix');
 const first=conversation(fixtureState.wires[0]);
 assert.equal(first.length,5,'The current user span retains the five-message floor');
 assert.equal(first.some(function fullCurrentUser(message){return message.role==='user'&&userText(message)===longUser;}),true);
 const last=conversation(fixtureState.wires[3]);
 assert.equal(last[0].role,'user');
 assert.equal(userText(last[0]),longUser);
 assert.equal(last.length,8,'All messages since the latest user survive once the span exceeds the floor');
 assert.equal(last.filter(function assistant(message){return message.role==='assistant';}).length,4);
 assert.equal(last.filter(function result(message){return message.role==='toolResult';}).length,3);

 const next='A new current user instruction.';
 fixtureState.requests=0;
 fixtureState.proposalLimit=1;
 await session.prompt(next);
 assert.equal(fixtureState.wires.length,5);
 const followup=conversation(fixtureState.wires[4]);
 assert.equal(followup.length,5);
 assert.equal(followup.some(function currentUser(message){return message.role==='user'&&userText(message)===next;}),true);
 assert.equal(JSON.stringify(fixtureState.wires[4]).includes(longUser),false,'A superseded long user message must not return through archived receipts');

 await session.reload();
 fixtureState.requests=0;
 await session.prompt('Current request after reload.');
 assert.equal(fixtureState.wires.length,6);
 assert.equal(conversation(fixtureState.wires[5]).length,5);
 assert.equal(fixtureState.executions,18);
 assert.equal(fixtureState.selections,0);
 console.log(JSON.stringify({complete:true,fullPolicy:true,oldPrefixAbsent:true,hiddenAbsent:true,completeSelectedMessage:true,fiveMessageFloor:true,latestUserSpan:true,followup:true,reload:true,assessments:6,executions:18,providerRequests:0}));
}
//endregion Consumer context checks
