import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {logger} from '@monochromatic-dev/module-logger/ts';
import {createEnvironment} from '../dist/native/contract/integration/native-batch/environment.mjs';
import {createRootSessionFactory} from '../dist/native/contract/integration/native-batch/session-root.ts';
import {bindNativePolicyRuntime} from '../dist/native/contract/integration/native-batch/runtime.mjs';
import {createNativeSemanticOperatingPolicies,maintainedPolicyEntry} from '../dist/native/contract/integration/maintained-policy.mjs';
import {createDomainFixtureAssessment} from '../dist/native/contract/integration/native-batch/domain-fixture-assessment.mjs';

//region Built native groups exhaust automatic decisions before original scoped confirmation.
const requestedMode=process.argv[2]??'approve';
const clauseDenial=requestedMode.startsWith('clause-deny-');
const mode=clauseDenial?requestedMode.slice('clause-deny-'.length):requestedMode;
assert.ok(['approve','deny','unknown','low','transport','malformed','initial-failure','stop','cancel','headless','stale','abort','prohibition','deadline','fresh'].includes(mode));
const {askUser,VERDICT_ENTRY_TYPE}=await import(maintainedPolicyEntry);
const observations={assessments:0,httpCalls:0,attempts:0,selections:0,executions:0};
/** @type {{pi:unknown,abortTask:Promise<void>|undefined}} */
const fixture={pi:undefined,abortTask:undefined};
const logs=[];
const assessments=[];
const originalDebug=logger.debug;
logger.debug=function captureDiagnostic(message){
 if(message.includes('[auto-mode-decision-evidence]'))logs.push(JSON.parse(message.slice(message.indexOf('{'))));
 if(message.includes('[auto-mode-assessment-evidence]'))assessments.push(JSON.parse(message.slice(message.indexOf('{'))));
 originalDebug(message);
};
const env=await createEnvironment({policyText:'RUL:\n The complete proposed local inspection is permitted.\n',useNativeProvider:true,extensionFactories:[function capturePi(pi){fixture.pi=pi;} ]});
const {createBashToolDefinition}=await import(pathToFileURL(join(env.packageRoot,'dist/core/tools/bash.js')).href);
const originalBash=createBashToolDefinition(env.options.cwd);
const bash={...originalBash,async execute(toolCallId,input,signal,onUpdate,context){observations.executions++;return await Reflect.apply(originalBash.execute,originalBash,[toolCallId,input,signal,onUpdate,context]);}};
const {session,root,lifecycle}=await createRootSessionFactory(env).create({options:{...env.options,tools:['bash'],customTools:[bash]}});
session.agent.getApiKey=function fixtureKey(){return process.env.FIXTURE_API_KEY;};
const decision=['approve','initial-failure','stale','abort','deadline'].includes(mode)?'approve':['deny','prohibition'].includes(mode)?'deny':'unknown';
const relation=clauseDenial||mode==='prohibition'?'prohibition':mode==='fresh'?'fresh-session-approval':'prerequisite';
const sendAssessment=createDomainFixtureAssessment({settings:{relation:'permission',unresolvedClause:relation,operationDecision:decision,operatingPolicy:true,httpTransport:true},observations});
const commands=['printf FALLBACK_A','printf FALLBACK_B'];
const calls=commands.map(function proposedCommand(command,index){return {index,id:`fallback-${index}`,type:'function',function:{name:'bash',arguments:JSON.stringify({command})}};});
const requests={count:0};
const clock={offset:0};
const runtime=bindNativePolicyRuntime({root,lifecycle,policyInput:env.policyInput,rootDirectory:env.options.cwd,parsePolicy:env.parser.parse,files:[],wrapToolDefinition:env.wrapToolDefinition,readSessionDisposalState:env.readSessionDisposalState,trace(){return undefined;},...createNativeSemanticOperatingPolicies(),
 now(){return performance.now()+clock.offset;},
 approvalHost(){return {pi:fixture.pi,askUser,verdictEntryType:VERDICT_ENTRY_TYPE,trace(){return undefined;},notificationInvoker:async function ignoreNotification(){return {exitCode:0,stdout:'',stderr:''};},ctx:{hasUI:mode!=='headless',abort(){fixture.abortTask=session.abort();},ui:{async select(title,options){
  observations.selections++;
  assert.equal(observations.attempts,2,'Dialog must follow both automatic attempts');
  assert.deepEqual(options,['Allow','Stop']);
  for(const command of commands)assert.ok(title.includes(command));
  if(mode==='cancel'){fixture.abortTask=session.abort();return undefined;}
  return mode==='stop'?'Stop':'Allow';
 }}}};},
 async sendWire(input){
  observations.attempts++;
  for(const command of commands)assert.ok(input.body.includes(command));
  const wire=JSON.parse(input.body);
  const operation=Object.values(wire.questions).some(function operationQuestion(question){return Object.hasOwn(question.criteria,'approve');});
  assert.equal(operation,observations.attempts===2);
  if(mode==='initial-failure'&&!operation)throw new Error('Fixture initial clause transport failed');
  if(operation&&mode==='transport')throw new Error('Fixture final decision transport failed');
  if(operation&&mode==='malformed')return '{malformed';
  if(operation&&mode==='stale')await writeFile(join(env.options.cwd,'AGENTS.md'),'RUL:\n The proposed operation is prohibited.\n');
  if(operation&&mode==='abort')fixture.abortTask=session.abort();
  const raw=await sendAssessment(input);
  if(operation&&mode==='deadline')clock.offset=16000;
  if(operation&&mode==='low'){
   const parsed=JSON.parse(raw);
   for(const answer of Object.values(parsed.answers)){answer.choice='approve';answer.probabilities={approve:0.59,deny:0,unknown:0.41};}
   return JSON.stringify(parsed);
  }
  return raw;
 },
 async terminalFetch(){
  const proposal=requests.count++===0;
  const chunk={id:'decision-fallback-fixture',object:'chat.completion.chunk',created:0,model:'fixture'};
  const first={...chunk,choices:[{index:0,delta:proposal?{role:'assistant',tool_calls:calls}:{role:'assistant',content:'done'},finish_reason:null}]};
  const last={...chunk,choices:[{index:0,delta:{},finish_reason:proposal?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}};
  return new Response(`data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
 }
});
await using cleanup={async [Symbol.asyncDispose](){await fixture.abortTask;session.dispose();await session.agent.waitForIdle();runtime.detach();await env.drain();await logger.flush();logger.debug=originalDebug;}};
await session.prompt('Perform the complete proposed local inspection.');
await fixture.abortTask;
const allowed=['approve','unknown','low','transport','malformed','initial-failure','deadline','fresh'].includes(mode);
assert.equal(observations.executions,allowed?2:0);
assert.equal(observations.attempts,2);
const manual=['unknown','low','transport','malformed','stop','cancel','deadline','fresh'].includes(mode);
assert.equal(observations.selections,manual?1:0);
assert.ok(logs.length>0,'The actual tagged logger must receive decision evidence');
assert.equal(new Set(logs.map(function correlation(entry){return entry.reviewId;})).size,1);
if(mode!=='initial-failure'){
 const clause=logs.find(function selectedClause(entry){return entry.event==='clause-admission'&&entry.details.binding.code==='RUL';});
 assert.ok(clause,'Logs must identify the exact source clause');
 assert.equal(clause.details.answer.value.choice,relation);
 assert.equal(clause.details.admitted,true);
 assert.equal(typeof clause.details.binding.sourceSHA256,'string');
 assert.equal(clause.details.answer.value.probabilities[relation],0.6);
}
const inputRecords=assessments.filter(function requestRecord(entry){return entry.event==='assessment-request';});
assert.equal(inputRecords.length,observations.attempts);
assert.equal(new Set(inputRecords.map(function operationId(entry){return entry.operationId;})).size,1);
for(const record of inputRecords){
 assert.ok(record.state.fullPolicy.includes('RUL:'));
 assert.equal(Object.hasOwn(record.state,'originalRequestBody'),false);
 for(const command of commands)assert.ok(record.state.parentProgram.includes(command));
}
for(const record of logs.filter(function questionRecord(entry){return entry.event==='question-evidence';}))assert.equal(record.details.operationId,inputRecords[0].operationId);
if(mode==='malformed')assert.ok(assessments.some(function malformedReply(entry){return entry.event==='assessment-response-invalid'&&entry.raw==='{malformed';}));
if(mode==='deadline')assert.ok(JSON.stringify(logs).includes('deadline expired'));
if(mode==='initial-failure')assert.ok(JSON.stringify(logs).includes('Fixture initial clause transport failed'));
if(mode==='approve'||mode==='deny'){
 const terminal=logs.find(function finalOutcome(entry){return entry.event==='review-complete';});
 assert.equal(terminal.details.outcome.verdict,mode);
 assert.equal(terminal.details.confirmation,false);
}
console.log(JSON.stringify({complete:true,mode:requestedMode,...observations,reconstructableDecisionLogs:true}));
//endregion
