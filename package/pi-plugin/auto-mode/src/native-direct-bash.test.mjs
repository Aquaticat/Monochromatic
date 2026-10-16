import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {createEnvironment} from '../dist/native/contract/integration/native-batch/environment.mjs';
import {createRootSessionFactory} from '../dist/native/contract/integration/native-batch/session-root.ts';
import {bindNativePolicyRuntime} from '../dist/native/contract/integration/native-batch/runtime.mjs';
import {createNativeSemanticOperatingPolicies} from '../dist/native/contract/integration/maintained-policy.mjs';
import {createDomainFixtureAssessment} from '../dist/native/contract/integration/native-batch/domain-fixture-assessment.mjs';
import {createOwnedCodemodeDefinition} from '../dist/native/contract/integration/native-batch/generated/program-definition.mjs';

//region Original direct shell groups receive complete-operation estimates before native execution.
const mode=process.argv[2]??'permission';
assert.ok(['permission','prohibition','unknown','mixed'].includes(mode));
const permitted=mode==='permission'||mode==='mixed';
const relation=mode==='prohibition'?'prohibition':'permission';
const env=await createEnvironment({policyText:`RUL:\n The complete proposed operation is ${relation==='permission'?'permitted':'prohibited'}.\n`,hostPrompt:'Fixture background.',useNativeProvider:true});
const {createBashToolDefinition}=await import(pathToFileURL(join(env.packageRoot,'dist/core/tools/bash.js')).href);
const bash=createBashToolDefinition(env.options.cwd);
const {session,root,lifecycle}=await createRootSessionFactory(env).create({options:{...env.options,tools:['bash','codemode'],customTools:[bash,createOwnedCodemodeDefinition()]}});
session.agent.getApiKey=function fixtureKey(){return process.env.FIXTURE_API_KEY;};
const observations={assessments:0,httpCalls:0};
const settings={relation,operatingPolicy:true,httpTransport:true,unresolvedClause:mode==='unknown'?'unknown':undefined};
const sendAssessment=createDomainFixtureAssessment({settings,observations});
const commands=['printf NATIVE_DIRECT_BASH_A','printf NATIVE_DIRECT_BASH_B'];
const calls=commands.map(function proposedCommand(command,index){return {index,id:`bash-${index}`,type:'function',function:{name:mode==='mixed'&&index===1?'codemode':'bash',arguments:JSON.stringify(mode==='mixed'&&index===1?{code:`return await tools.bash(${JSON.stringify({command})});`}:{command})}};});
const requests={count:0};
const runtime=bindNativePolicyRuntime({root,lifecycle,policyInput:env.policyInput,rootDirectory:env.options.cwd,parsePolicy:env.parser.parse,files:[],wrapToolDefinition:env.wrapToolDefinition,readSessionDisposalState:env.readSessionDisposalState,trace(){return undefined;},...createNativeSemanticOperatingPolicies(),
 sendWire(input){for(const command of commands)assert.ok(input.body.includes(command),'Every assessment retains both complete commands');return sendAssessment(input);},
 async terminalFetch(){
  const proposal=requests.count++===0;
  const chunk={id:'direct-bash-fixture',object:'chat.completion.chunk',created:0,model:'fixture'};
  const first={...chunk,choices:[{index:0,delta:proposal?{role:'assistant',tool_calls:calls}:{role:'assistant',content:'done'},finish_reason:null}]};
  const last={...chunk,choices:[{index:0,delta:{},finish_reason:proposal?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}};
  return new Response(`data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
 }
});
await using cleanup={async [Symbol.asyncDispose](){session.dispose();await session.agent.waitForIdle();runtime.detach();await env.drain();}};
 await session.prompt('Review and perform the complete proposed shell operation.');
 const review=runtime.inspect().lastReview;
 assert.ok(review,'Original direct calls must reach policy review');
 assert.equal(review.semanticAdmission.state,'matching');
 assert.ok(observations.assessments>0,'Direct Bash must reach automatic assessment');
 assert.equal(review.outcome.state,permitted?'allowed':mode==='prohibition'?'blocked':'unresolved');
 const results=session.messages.filter(function toolResult(message){return message.role==='toolResult';});
 assert.equal(results.length,2);
 for(const [index,result] of results.entries()){
  assert.equal(result.isError,!permitted);
  const text=JSON.stringify(result.content);
  assert.equal(text.includes(index===0?'NATIVE_DIRECT_BASH_A':'NATIVE_DIRECT_BASH_B'),permitted);
 }
 console.log(JSON.stringify({complete:true,mode,assessments:observations.assessments,automaticExecutions:permitted?2:0,completeCommands:true}));
//endregion
