import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {createEnvironment} from './environment.mjs';
import {createRootSessionFactory} from './session-root.mjs';
import {bindNativePolicyRuntime} from './runtime.mjs';
import {createOwnedCodemodeDefinition} from "./generated/program-definition.mjs";
import {nativeOpenAIStream} from './source-association.mjs';
import {fixtureResponse} from './fixture-response.mjs';
import {ruleAssessmentModel} from '../action-policy/wire.mjs';
import {maintainedPolicyEntry} from '../maintained-policy.mjs';

const {askUser,VERDICT_ENTRY_TYPE,flushPolicyDiagnostics}=await import(maintainedPolicyEntry);
await flushPolicyDiagnostics();
const mode=process.argv[2]??'allow';
const useNativeContext=process.argv.includes('--native-context');
const reloadContext=process.argv.includes('--reload-context');
assert(['allow','deny','stop','cancelled','missing','unsupported','unresolved','satisfied','bare','prohibited','retired'].includes(mode));
const permission=mode==='bare'?'Use sentence case in the final response.':mode==='prohibited'?'The complete proposed operation is prohibited.':'The complete proposed operation is permitted.';
const policyText='RUL:\n '+permission+'\n\nCNF:\n Require the original session Allow confirmation for this prepared group.\n';
let nativePi;
const env=await createEnvironment({policyText,hostPrompt:'Fixture background.',extensionFactories:[pi=>{nativePi=pi;}]});
let requests=0,assessments=0,executions=0,originalBody,selections=0,notifications=0,authorizationCaptures=0,approvalCaptures=0,abortTask;
let activeAuthorization=true;
const leaf={...env.createReadToolDefinition(env.options.cwd),name:'fixture_value',description:'Returns inert fixture text.',async execute(){executions++;return {content:[{type:'text',text:'fixture child value'}],details:{}};}};
const {session,root,lifecycle}=await createRootSessionFactory(env).create({options:{...env.options,tools:['codemode','fixture_value'],customTools:[createOwnedCodemodeDefinition(),leaf]}});
session.agent.getApiKey=()=>process.env.FIXTURE_API_KEY;
assert(nativePi&&typeof nativePi.appendEntry==='function');
const programProfile='awaited-string-result-then-literal-parallel';
const code='const value = await tools.fixture_value({path:"seed"});\nreturn await Promise.allSettled([tools.fixture_value({path:value}),tools.fixture_value({path:"second"})]);';
const policy=definitionId=>({model:ruleAssessmentModel,definitionId,programProfile,accepts:()=>true});
const ctx={hasUI:true,ui:{async select(title,options){
 selections++;
 assert.deepEqual(options,['Allow','Deny','Stop']);
 assert(title.includes('Complete prepared group:'));
 assert(title.includes(JSON.stringify(code)));
 if(mode==='retired')activeAuthorization=false;
 if(mode==='cancelled'){
  abortTask=session.abort();
  return undefined;
 }
 return mode==='deny'?'Deny':mode==='stop'?'Stop':'Allow';
}},abort(){abortTask=session.abort();}};
if(useNativeContext)await session.bindExtensions({uiContext:{...session.extensionRunner.createContext().ui,select:ctx.ui.select}});
const runtime=bindNativePolicyRuntime({root,lifecycle,policyInput:env.policyInput,endpoint:'https://fixture.invalid/v1/chat/completions',rootDirectory:env.options.cwd,parsePolicy:env.parser.parse,files:[],wrapToolDefinition:env.wrapToolDefinition,readSessionDisposalState:env.readSessionDisposalState,trace(){},
 semanticAdmissionPolicy:policy('clause_operation_relation'),requestMaterialAdmissionPolicy:policy('request_instruction_content'),headingContextAdmissionPolicy:policy('heading_instruction_content'),effectOwnerFor:()=>undefined,
 // This fixture's code owns its confirmation requirement. It does not infer existing human grants from prose.
 authorizationOwnerFor({judgment,rule,source,request}){
  if(mode==='missing'||judgment.readRuleCandidate(rule).code!=='CNF')return undefined;
  assert.equal(source.source.content,policyText);
  assert.equal(source.request,request);
  const authorization=Object.freeze({satisfaction:mode==='satisfied'?'satisfied':mode==='unresolved'?'unresolved':'unsatisfied',channel:mode==='unsupported'?'unsupported':'incumbent-approval'});
  const evidence=Object.freeze({judgment,rule,source,request,authorization});
  return Object.freeze({capture(){
   authorizationCaptures++;
   assert(judgment.inspect().memberExecutions.every(member=>member.state==='unentered'));
   return evidence;
  },assertCurrent(value){
   assert.equal(value,evidence);
   assert.equal(activeAuthorization,true,'Original authorization evidence retired');
   judgment.assertDependenciesCurrent();
  }});
 },
 approvalHost(){approvalCaptures++;return {pi:nativePi,ctx:useNativeContext?session.extensionRunner.createContext():ctx,askUser,verdictEntryType:VERDICT_ENTRY_TYPE,trace(){},async notificationInvoker(){notifications++;}};},
 async sendWire({body}){
  assessments++;const wire=JSON.parse(body);assert.equal(wire.state.originalRequestBody,originalBody);
  const answers=Object.fromEntries(Object.entries(wire.questions).map(([slot,question])=>{
   const id=question.instructions.selectedRule?.id;
   const choice=question.instructions.selectedMaterial==='originalRequestBody'?'none':id==='CNF'?'prerequisite':id==='RUL'?(mode==='bare'?'none':mode==='prohibited'?'prohibition':'permission'):'none';
   assert(Object.hasOwn(question.criteria,choice));
   return [slot,{type:'choice',choice,probabilities:Object.fromEntries(Object.keys(question.criteria).map(label=>[label,label===choice?1:0]))}];
  }));
  return JSON.stringify({model:wire.model,answers,usage:{input_tokens:100,output_tokens:10}});
 },originalStream:nativeOpenAIStream,
 async terminalFetch(_input,init){requests++;if(requests===1)originalBody=init.body;return fixtureResponse({proposal:requests===1,code});}
});
let handlerFailure;
const handler=session.agent.executeToolBatch;
session.agent.executeToolBatch=async input=>{try{return await handler(input);}catch(error){handlerFailure=error;throw error;}};
try{
 assert.equal(approvalCaptures,0,'Binding a runtime must retain its host source without retaining a stale native context');
 if(reloadContext){
  assert(useNativeContext,'Reload fixture requires the native extension context');
  const originalContext=session.extensionRunner.createContext();
  const originalPi=nativePi;
  await session.reload();
  assert.notEqual(nativePi,originalPi,'Native reload must recapture the actual extension API');
  assert.throws(()=>originalContext.ui,/This extension ctx is stale after session replacement or reload/u);
 }
 await session.prompt('Exercise native prerequisite and original approval routing.');
 if(abortTask)await abortTask;
 const {lastReview:review,lastJudgment:judgment}=runtime.inspect();
 const eligible=['allow','deny','stop','cancelled','retired'].includes(mode);
 assert.equal(selections,eligible?1:0,'Only an otherwise-permitted operation with independent scoped-channel evidence reaches the original selector: '+inspect({authorizationCaptures,handlerFailure,outcome:review?.outcome,issues:review?.premiseIssues},{depth:5}));
 assert.equal(notifications,selections);
 assert.equal(authorizationCaptures,mode==='missing'?0:1);
 assert.equal(approvalCaptures,1,'Each review captures its current native capabilities once');
 if(mode==='retired'||mode==='stop'||mode==='cancelled'){
  assert.equal(executions,0);
  assert(handlerFailure,inspect({mode,review},{depth:4}));
 }else{
  assert(review,inspect({requests,assessments,message:session.messages.at(-1),handlerFailure,judgment:judgment?.inspect()},{depth:5}));
  assert.equal(review.premiseIssues.some(issue=>issue.kind==='request-source-domain'),false);
  assert.equal(review.compiledPolicy.authorizationRequirements.length,1);
  const unresolved=['missing','unsupported','unresolved','bare'].includes(mode);
  assert.equal(review.outcome.state,unresolved?'unresolved':'resolved');
  if(!unresolved)assert.equal(review.outcome.verdict,['allow','satisfied'].includes(mode)?'approve':'deny');
  assert.equal(executions,['allow','satisfied'].includes(mode)?3:0);
 }
 const entries=session.sessionManager.getEntries().filter(entry=>entry.type==='custom'&&entry.customType===VERDICT_ENTRY_TYPE);
 assert.equal(entries.length,selections);
 if(entries.length)assert.equal(entries[0].data.verdict,['deny','stop','cancelled'].includes(mode)?'user-deny':'user-approve');
 console.log(JSON.stringify({complete:true,mode,selections,notifications,authorizationCaptures,executions,assessments,originalNativeVerdictEntries:entries.length,canonicalPolicyHandler:true,actualAskUser:true,nativeContext:useNativeContext,reloadedNativeContext:reloadContext,presentationIsFixture:true,authoredIndependentRequirementFacts:true,genuineHumanApprovals:0,providerRequests:0}));
}finally{
 session.agent.executeToolBatch=handler;
 session.dispose();await session.agent.waitForIdle();runtime.detach();await env.drain();await flushPolicyDiagnostics();
}
