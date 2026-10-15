import assert from 'node:assert/strict';
import {createEnvironment} from './environment.mjs';
import {createRootSessionFactory} from './session-root.ts';
import {createOwnedCodemodeDefinition} from './generated/program-definition.mjs';

//region One native environment and session retain the fixture's original callbacks and observations.
export async function createDomainFixtureEnvironment({settings,observations,readRuntime}){
 const {text,sdkStream,configuredExtensions,unobservedContext,observedContext,observedProgress,throwingContext,nextDecision,nextInput,nextResult,extensionManifestArgument,changeControl}=settings;
const env=await createEnvironment({
  policyText:`RUL:\n ${text}\n`,
  hostPrompt:'Fixture background.',
  useNativeProvider:sdkStream,
  additionalExtensionPaths:configuredExtensions.map(function configuredExtensionPath(resource){return resource.path;}),
  expectedBlockedNetworkUrls:configuredExtensions.some(function syntheticCatalog(resource){return resource.metadata
    ?.source
    ==='npm:@benvargas/pi-synthetic-provider';})?['https://api.synthetic.new/openai/v1/models']:[],
  extensionFactories:unobservedContext?[function registerUnobservedContextHandler(pi) {pi.on(
    'input',
    function countUnobservedContextCall() {observations.contextCalls++;}
  );}]:observedContext?[function registerObservedContextHandlers(pi) {
   pi.on(
     'context',
     function retainOriginalContextInput(event) {
    observations.contextCalls++;
    event.receiptFixture='Original in-place context input';
   }
   );
   pi.on(
     'context',
     function retainOriginalContextResult(event) {
    observations.contextCalls++;
    if(throwingContext){
     event.receiptFixture='Original input mutation before context failure';
     throw new Error('Expected original context callback failure');
    }
    const result={
      messages:event.messages,
      unusedInstruction:'Original unselected context result'
    };
    const deferred=Promise.withResolvers();
    queueMicrotask(function settleOriginalContextResult(){
     deferred.resolve(result);
     queueMicrotask(function mutateAfterOriginalContextSettlement(){
      result.unusedInstruction='Later queued context result mutation';
     observations.lateContextMutations++;
     });
    });
    return deferred.promise;
   }
   );
   pi.on(
     'context_with_system',
     function retainOriginalSystemContextResult(event) {
    observations.contextCalls++;
    return {
      messages:event.messages,
      unusedInstruction:'Original unselected system context result'
    };
   }
   );
  }]:observedProgress?[function registerObservedProgress(pi){
   pi.on(
     'tool_execution_update',
     function observeOriginalProgress(event){
    observations.progressCalls++;
    if(nextDecision&&(observations.progressCalls===1)){
     event.laterInstruction=nextInput;
     return {laterInstruction:nextResult};
    }
    return undefined;
   }
   );
  }]:[]
});
if(extensionManifestArgument!==undefined){
 const loaded=env.policyInput
   .loader
   .getExtensions();
 assert.deepEqual(
   loaded.errors,
   [],
   'Every configured extension must load before its native policy consumer is tested'
 );
 const fixtureExtensionCount=unobservedContext||observedContext
   ||observedProgress?1:0;
 assert.equal(
   loaded.extensions
     .length,
   configuredExtensions.length+fixtureExtensionCount,
   'The fixture must retain every configured and control extension'
 );
 console.log(JSON.stringify({
   configuredExtensionsLoaded:configuredExtensions.length,
   fixtureExtensionsLoaded:fixtureExtensionCount,
   eventKinds:[...new Set(loaded.extensions
     .flatMap(function registeredKinds(extension){return [...extension.handlers
       .keys()];}))]
 }));
}
const leaf={
  ...env.createReadToolDefinition(env.options
    .cwd),
  name:'fixture_value',
  description:'Returns fixture text without accessing files.',
  async execute(){observations.executions++;await changeControl.beforeChildReturn({
    session,
    env,
    executions:observations.executions,
    judgment:readRuntime().inspect()
      .lastJudgment
  });return {
    content:[{
      type:'text',
      text:'fixture child value'
    }],
    details:{}
  };}
};
const {
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
  .getApiKey=function readDomainFixtureApiKey() { return (process.env
    .FIXTURE_API_KEY); };
 return {env,session,root,lifecycle};
}
//endregion
