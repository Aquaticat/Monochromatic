import { mode, freshSessionApproval, uncertainContext, headless, useNativeContext, reloadContext, policyText, programProfile, code, fixtureState, outsideProfile } from './approval-fixture-options.mjs';
//region Original session, runtime and authored approval responses.
import assert from 'node:assert/strict';
import {createEnvironment} from './environment.mjs';
import {createRootSessionFactory} from './session-root.ts';
import {bindNativePolicyRuntime} from './runtime.mjs';
import {createOwnedCodemodeDefinition} from "./generated/program-definition.mjs";
import {nativeOpenAIStream} from './source-association.mjs';
import {fixtureResponse} from './fixture-response.mjs';
import {ruleAssessmentModel} from '../action-policy/wire.mjs';
import {maintainedPolicyEntry} from '../maintained-policy.mjs';
import {registerHostResource} from '../native-host/resource-reload.ts';

export const {
  askUser,
  registerNativeBypass,
  readNativeBypassEnabled,
  VERDICT_ENTRY_TYPE,
  flushPolicyDiagnostics
}=await import(maintainedPolicyEntry);
await flushPolicyDiagnostics();
export const env=await createEnvironment({
  policyText,
  hostPrompt:'Fixture background.',
  extensionFactories:[function captureNativePiApi(pi) {
    fixtureState.nativePi=pi;
    if(process.argv.includes('--bypass-fixture'))registerNativeBypass(pi);
  }]
});
// This direct-SDK fixture registers the original policy reload boundary used by native host services.
// It does not acquire the CLI host's private resource membership or session-construction ownership.
if(reloadContext)registerHostResource({
  loader:env.policyInput
    .loader,
  policyInput:env.policyInput
});

  
  
  
  
  
  
  
  

const leaf={
  ...env.createReadToolDefinition(env.options
    .cwd),
  name:'fixture_value',
  description:'Returns inert fixture text.',
  async execute(){fixtureState.executions++;return {
    content:[{
      type:'text',
      text:'fixture child value'
    }],
    details:{}
  };}
};
export const {
  session,
  root,
  lifecycle
}=await createRootSessionFactory(env)
  .create({options:{
    ...env.options,
    tools:[
      'codemode',
      'fixture_value'
    ],
    customTools:[
      createOwnedCodemodeDefinition(),
      leaf
    ]
  }});
session.agent
  .getApiKey=function readFixtureApiKey() { return (process.env
    .FIXTURE_API_KEY); };
assert.ok(fixtureState.nativePi&&((typeof fixtureState.nativePi.appendEntry)==='function'));
function policy(definitionId) { return {
  model:ruleAssessmentModel,
  definitionId,
  programProfile,
  accepts:function acceptAuthoredFixtureRelation() { return (true); }
}; }
function createFixtureSelector() {
  return async function selectFixtureOutcome(
    title,
    options
  ){
 fixtureState.selections++;
 assert.deepEqual(
   options,
   [
     'Allow',
     'Stop'
   ]
 );
 assert.ok(title.includes('Complete prepared group:'));
 assert.ok(
   title.includes(JSON.stringify(code)),
 );
 if(mode==='retired')fixtureState.activeAuthorization=false;
 if(mode==='cancelled'){
  fixtureState.abortTask=session.abort();
  return undefined;
 }
 if(outsideProfile&&mode==='prohibited')return 'Stop';
 return mode==='deny'?'Deny':mode==='stop'?'Stop':'Allow';
  };
}
const select=createFixtureSelector();
const ctx={
  hasUI:!headless,
  ui:{select},
  abort(){fixtureState.abortTask=session.abort();}
};
if(useNativeContext&&(!headless))await session.bindExtensions({uiContext:{
  ...session.extensionRunner
    .createContext()
    .ui,
  select
}});
export const runtime=bindNativePolicyRuntime({
  ...(process.argv.includes('--bypass-fixture')?{readBypass(){return readNativeBypassEnabled(session.extensionRunner.createContext());}}:{}),
  root,
  lifecycle,
  policyInput:env.policyInput,
  endpoint:'https://fixture.invalid/v1/chat/completions',
  rootDirectory:env.options
    .cwd,
  parsePolicy:env.parser
    .parse,
  files:[],
  wrapToolDefinition:env.wrapToolDefinition,
  readSessionDisposalState:env.readSessionDisposalState,
  trace(){return undefined;},
  semanticAdmissionPolicy:policy('clause_operation_relation'),
  headingContextAdmissionPolicy:policy('heading_instruction_content'),
  effectOwnerFor:function omitFixtureAuthorizationOwner() { return (undefined); },
  authorizationOwnerFor({
    judgment,
    rule,
    source,
    request
  }){
  if(freshSessionApproval)return undefined;
  if((mode==='missing')||(judgment.readRuleCandidate(rule)
    .code
    !=='CNF'))return undefined;
  assert.equal(
    source.source
      .content,
    policyText
  );
  assert.equal(
    source.request,
    request
  );
  const authorization=Object.freeze({
    satisfaction:mode==='satisfied'?'satisfied':mode==='unresolved'?'unresolved':'unsatisfied',
    channel:mode==='unsupported'?'unsupported':'incumbent-approval'
  });
  const evidence=Object.freeze({
    judgment,
    rule,
    source,
    request,
    authorization
  });
  return Object.freeze({
    capture(){
   fixtureState.authorizationCaptures++;
   assert.ok(judgment.inspect()
     .memberExecutions
     .every(function isUnenteredPreparedMember(member) { return (member.state==='unentered'); }));
   return evidence;
  },
    assertCurrent(value){
   assert.equal(
     value,
     evidence
   );
   assert.equal(
     fixtureState.activeAuthorization,
     true,
     'Original authorization evidence retired'
   );
   judgment.assertDependenciesCurrent();
  }
  });
 },
  approvalHost(){fixtureState.approvalCaptures++;return {
    pi:fixtureState.nativePi,
    ctx:useNativeContext?session.extensionRunner
      .createContext():ctx,
    askUser,
    verdictEntryType:VERDICT_ENTRY_TYPE,
    trace(){return undefined;},
    async notificationInvoker(){fixtureState.notifications++;}
  };},
  async sendWire({body}){
  fixtureState.assessments++;const wire=JSON.parse(body);
  fixtureState.wires.push(wire);
  assert.equal(Object.hasOwn(wire.state,'originalRequestBody'),false);
  assert.equal(wire.state.fullPolicy,policyText);
  const answers=Object.fromEntries(Object.entries(wire.questions)
    .map(function answerAuthoredApprovalQuestion([slot,question]) {
   const id=question.instructions
     .selectedRule
     ?.id;
   assert.notEqual(
     question.instructions
       .selectedMaterial,
     'originalRequestBody'
   );
   const choice=id==='UNK'?'unknown':id==='CNF'?(freshSessionApproval?'fresh-session-approval':'prerequisite'):id==='RUL'?(mode==='bare'?'none':mode==='prohibited'?'prohibition':'permission'):'none';
   assert.ok(Object.hasOwn(
     question.criteria,
     choice
   ));
   return [
     slot,
     {
       type:'choice',
       choice,
       probabilities:Object.fromEntries(Object.keys(question.criteria)
         .map(function scoreAuthoredApprovalChoice(label) { return ([
           label,
           label===choice?1:0
         ]); }))
     }
   ];
  }));
  return JSON.stringify({
    model:wire.model,
    answers,
    usage:{
      input_tokens:100,
      output_tokens:10
    }
  });
 },
  originalStream:nativeOpenAIStream,
  async terminalFetch(
    _input,
    init
  ){fixtureState.requests++;if(fixtureState.requests===1)fixtureState.originalBody=init.body;return fixtureResponse({
    proposal:fixtureState.requests<=fixtureState.proposalLimit,
    code
  });}
});

//endregion
