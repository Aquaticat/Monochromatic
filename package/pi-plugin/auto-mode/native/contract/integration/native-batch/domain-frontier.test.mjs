import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEnvironment} from './environment.mjs';
import {createRootSessionFactory} from './session-root.mjs';
import {bindNativePolicyRuntime} from './runtime.mjs';
import {createOwnedCodemodeDefinition} from "./generated/program-definition.mjs";
import {nativeOpenAIStream} from './source-association.mjs';
import {fixtureResponse} from './fixture-response.mjs';
import {ruleAssessmentModel} from '../action-policy/wire.mjs';
import {createAssessmentSender,createNativeSemanticOperatingPolicies} from '../maintained-policy.mjs';

import {assertDomainReview} from './domain-frontier-assertions.mjs';

//region Native fixture lifetime owns its counters and disposable session

/** Run one original native decision with the selected authored contrast. */
async function runDomainFrontier(){
const relation=process.argv[2]??'prohibition',
  requireResolution=process.argv
  .includes('--require-resolution'),requestRelation=process.argv
  .includes('--request-potential')?'potential-instruction':'none';
assert.ok([
  'permission',
  'prohibition',
  'none'
].includes(relation));
const text={
  permission:'The complete proposed operation is permitted.',
  prohibition:'The complete proposed operation is prohibited.',
  none:'Use sentence case in the final response.'
}[relation];
const unobservedContext=process.argv
  .includes('--unobserved-event');
const observedContext=process.argv.includes('--observed-context');
const observedProgress=process.argv.includes('--observed-progress');
const throwingContext=process.argv.includes('--throwing-context');
const httpTransport=process.argv.includes('--http-transport');
const operatingPolicy=process.argv.includes('--operating-policy');
const extensionManifestArgument=process.argv.find(function isExtensionManifestArgument(argument){return argument.startsWith('--extension-manifest=');});
const configuredExtensions=extensionManifestArgument===undefined?[]:JSON.parse(await readFile(extensionManifestArgument.slice('--extension-manifest='.length),'utf8'));
assert.ok(Array.isArray(configuredExtensions));
assert.ok(configuredExtensions.every(function originalExtensionPath(resource){return typeof resource.path==='string'&&resource.enabled===true;}));
const lowConfidenceClause=process.argv.includes('--low-confidence-clause');
const unresolvedClause=process.argv.includes('--unknown-clause')?'unknown':process.argv.includes('--unsupported-clause')?'unsupported':undefined;
assert.ok(!(lowConfidenceClause||unresolvedClause)||operatingPolicy,'Admission contrasts require the adopted operating policy');
assert.ok(!throwingContext||observedContext,'Throwing context controls require the observed native context route');
const sdkStream=process.argv
  .includes('--sdk-stream');
const receiptControl=process.argv
  .includes('--copied-payload')?'copied-payload':process.argv
  .includes('--copied-transcript')?'copied-transcript':undefined;
assert.ok((!receiptControl)||sdkStream,'Serializer receipt controls exercise the normal SDK stream');
let contextCalls=0;
let lateContextMutations=0;
let progressCalls=0;
const env=await createEnvironment({
  policyText:'RUL:\n '+text+'\n',
  hostPrompt:'Fixture background.',
  useNativeProvider:sdkStream,
  additionalExtensionPaths:configuredExtensions.map(function configuredExtensionPath(resource){return resource.path;}),
  expectedBlockedNetworkUrls:configuredExtensions.some(function syntheticCatalog(resource){return resource.metadata?.source==='npm:@benvargas/pi-synthetic-provider';})?['https://api.synthetic.new/openai/v1/models']:[],
  extensionFactories:unobservedContext?[function registerUnobservedContextHandler(pi) {pi.on('input',function countUnobservedContextCall() {contextCalls++;});}]:observedContext?[function registerObservedContextHandlers(pi) {
   pi.on('context',function retainOriginalContextInput(event) {
    contextCalls++;
    event.receiptFixture='Original in-place context input';
   });
   pi.on('context',function retainOriginalContextResult(event) {
    contextCalls++;
    if(throwingContext){
     event.receiptFixture='Original input mutation before context failure';
     throw new Error('Expected original context callback failure');
    }
    const result={messages:event.messages,unusedInstruction:'Original unselected context result'};
    const deferred=Promise.withResolvers();
    queueMicrotask(function settleOriginalContextResult(){
     deferred.resolve(result);
     queueMicrotask(function mutateAfterOriginalContextSettlement(){
      result.unusedInstruction='Later queued context result mutation';
      lateContextMutations++;
     });
    });
    return deferred.promise;
   });
   pi.on('context_with_system',function retainOriginalSystemContextResult(event) {
    contextCalls++;
    return {messages:event.messages,unusedInstruction:'Original unselected system context result'};
   });
  }]:observedProgress?[function registerObservedProgress(pi){
   pi.on('tool_execution_update',function observeOriginalProgress(){progressCalls++;});
  }]:[]
});
if(extensionManifestArgument!==undefined){
 const loaded=env.policyInput.loader.getExtensions();
 assert.deepEqual(loaded.errors,[],'Every configured extension must load before its native policy consumer is tested');
 assert.equal(loaded.extensions.length,configuredExtensions.length,'The fixture must retain every configured extension');
 console.log(JSON.stringify({configuredExtensionsLoaded:loaded.extensions.length,eventKinds:[...new Set(loaded.extensions.flatMap(function registeredKinds(extension){return [...extension.handlers.keys()];}))]}));
}
let assessments=0,executions=0,originalBody,requests=0;
const leaf={
  ...env.createReadToolDefinition(env.options.cwd),
  name:'fixture_value',
  description:'Returns fixture text without accessing files.',
  async execute(){executions++;return {content:[{type:'text',text:'fixture child value'}],details:{}};}
};
const {
  session,
  root,
  lifecycle
}=await createRootSessionFactory(env)
  .create({options:{...env.options,tools:['codemode','fixture_value'],customTools:[createOwnedCodemodeDefinition(),leaf]}});
session.agent
  .getApiKey=function readDomainFixtureApiKey() { return (process.env
  .FIXTURE_API_KEY); };
const code='const value = await tools.fixture_value({path:"seed"});\nreturn await Promise.allSettled([tools.fixture_value({path:value}),tools.fixture_value({path:"second"})]);',programProfile='awaited-string-result-then-literal-parallel';
function policy(definitionId) { return {model:ruleAssessmentModel,definitionId,programProfile,accepts:function acceptAuthoredDomainRelation() { return (true); }}; }
const originalSdkStream=session.agent
  .streamFunction;
const controlledSdkStream=function controlledSdkStream(
  model,
  context,
  options
){
 if(receiptControl==='copied-transcript')return originalSdkStream(
   model,
   {...context,messages:[...context.messages]},
   options
 );
 if(receiptControl==='copied-payload')return originalSdkStream(
   model,
   context,
   {...options,
  onPayload(payload,selectedModel){return options.onPayload(structuredClone(payload),selectedModel);}
 }
 );
 return originalSdkStream(
   model,
   context,
   options
 );
};
function authoredWireAnswer({body}){
  assessments++;const wire=JSON.parse(body);assert.equal(wire.state.originalRequestBody,originalBody);
  const answers=Object.fromEntries(Object.entries(wire.questions).map(function answerAuthoredDomainQuestion([slot,question]) {
   const selectedClause=question.instructions.selectedRule?.id==='RUL';
   const choice=question.instructions.selectedMaterial==='originalRequestBody'?requestRelation:selectedClause?(unresolvedClause??relation):'none';
   const score=operatingPolicy?(selectedClause&&lowConfidenceClause?0.989999:choice==='unknown'||choice==='unsupported'?1:0.99):1;
   assert(Object.hasOwn(question.criteria,choice));
   return [slot,{type:'choice',choice,probabilities:Object.fromEntries(Object.keys(question.criteria).map(function scoreAuthoredDomainChoice(label) { return ([label,label===choice?score:label==='unknown'?1-score:0]); }))}];
  }));
  return JSON.stringify({model:wire.model,answers,usage:{input_tokens:100,output_tokens:10}});
}
let httpCalls=0;
const sendAssessment=httpTransport?createAssessmentSender({
 now:function originalAssessmentClock(){return performance.now();},
 readCredential:function fixtureAssessmentCredential(){return 'native-http-fixture-key';},
 async fetchImpl(url,options){
  httpCalls++;
  assert.equal(url,'https://api.llmgateway.io/v1/systemone');
  assert.equal(options.method,'POST');
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.authorization,'Bearer native-http-fixture-key');
  assert.equal(options.signal.aborted,false);
  return new Response(authoredWireAnswer({body:options.body}));
 }
}):authoredWireAnswer;
const runtime=bindNativePolicyRuntime({
  root,
  lifecycle,
  policyInput:env.policyInput,
  endpoint:'https://fixture.invalid/v1/chat/completions',
  rootDirectory:env.options.cwd,
  parsePolicy:env.parser.parse,
  files:[],
  wrapToolDefinition:env.wrapToolDefinition,
  readSessionDisposalState:env.readSessionDisposalState,
  trace(){return undefined;},
  ...(operatingPolicy?createNativeSemanticOperatingPolicies():{
   semanticAdmissionPolicy:policy('clause_operation_relation'),
   requestMaterialAdmissionPolicy:policy('request_instruction_content'),
   headingContextAdmissionPolicy:policy('heading_instruction_content')
  }),
  effectOwnerFor:function omitDomainAuthorizationOwner() { return (undefined); },
  sendWire:sendAssessment,
  originalStream:sdkStream?controlledSdkStream:nativeOpenAIStream,
  async terminalFetch(input,init){requests++;if(requests===1)originalBody=init.body;return fixtureResponse({proposal:requests===1,code});}
});
await using cleanup={async [Symbol.asyncDispose](){session.dispose();await session.agent.waitForIdle();runtime.detach();await env.drain();}};
try{
 await session.prompt('Exercise the original request-specific policy domain.');
 const {
   lastReview:review,
   lastJudgment:judgment
 }=runtime.inspect();
 assertDomainReview({env,review,judgment,session,originalBody,settings:{relation,requireResolution,requestRelation,unobservedContext,observedContext,observedProgress,throwingContext,httpTransport,operatingPolicy,lowConfidenceClause,unresolvedClause,sdkStream,receiptControl},measures:{assessments,executions,requests,httpCalls,contextCalls,lateContextMutations,progressCalls}});
}catch(error){console.error(error);throw error;}
}

await runDomainFrontier();

//endregion Native fixture lifetime owns its counters and disposable session
