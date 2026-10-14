import assert from 'node:assert/strict';
import {
  sdk as currentSdk,
  maintainedRoot
} from '../current-sdk/paths.ts';
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  writeFileSync
} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createResourceInputOwner} from "../../collector/rule-relevance-sdk-copy/input/resource-owner.mjs";
import {createGoverningPolicyLoader} from '../policy-source/system-slot.mjs';
import {createNativeMarkdownParser} from '../../native-index/native-parser.mjs';

/** One isolated fixture process; the provider and global network paths never dispatch. */
export async function createEnvironment({
  agentsFilesOverride,
  appendSystemPromptOverride,
  promptTemplateText,
  extensionModuleText,
  extensionFactories=[],
  customPromptAuthority,
  discoveredSystemText,
  omitHostPrompt=false,
  hostPrompt='Native batch fixture host',
  appendPrompts=['Keep host context'],
  useNativeProvider=false,
  policyText='# Policy\n\nLN7:\n Never loosen lint rules without prior approval.\n'
}={}){
 if(process.env
   .PI_NATIVE_BATCH_FIXTURE
   ==='1')throw new Error('Nested native-batch fixture is forbidden');
 process.umask(0o077);
 const repositoryRoot=maintainedRoot;
 const pkg=currentSdk;
 const fixtureParent=join(
   homedir(),
   'temp/agent'
 );
 mkdirSync(
   fixtureParent,
   {
     recursive:true,
     mode:0o700
   }
 );
 const root=mkdtempSync(join(
   fixtureParent,
   'pi-native-fixture-'
 ));
   const cwd=join(
   root,
   'workspace'
 ); const home=join(
   root,
   'home'
 ); const agentDir=join(
   root,
   'agent'
 );
 for(const path of [
   cwd,
   home,
   agentDir
 ])mkdirSync(
   path,
   {mode:0o700}
 );
 for(const name of Object.keys(process.env))if(![
   'PATH',
   'LANG'
 ].includes(name))delete process.env[name];
 process.env
   .HOME=home;process.env
     .PI_CODING_AGENT_DIR=agentDir;process.env
       .PI_NATIVE_BATCH_FIXTURE='1';
 process.env
   .FIXTURE_API_KEY='synthetic-local-fixture-only';
 let networkAttempts=0;
   let providerCalls=0;
 globalThis.fetch=async()=>{networkAttempts++;throw new Error('Network is disabled in the native-batch fixture');};
 const {createAgentSession}=await import("./generated/sdk.mjs");
 const {
   DefaultResourceLoader,
   readNativeExtensionToolInputs,
   readNativeExtensionToolOrigin,
   readNativeExtensionToolInputUsage
 }=await import("./generated/resource-loader.mjs");
 const {SettingsManager}=await import(pathToFileURL(join(
   pkg,
   'dist/core/settings-manager.js'
 ))
   .href);
 const {
   SessionManager,
   readRootOccurrence
 }=await import("./generated/session-manager.mjs");
 const {
   readActiveSessionManager,
   readSessionDisposalState,
   readActiveSessionResourceLoader,
   readActiveSessionSystemPrompt,
   readActiveSessionBaseComposition,
   readActiveSessionRunComposition,
   readActiveSessionConstructedInputs,
   readActiveSessionInputUsage,
   readActiveSessionDomainEvents
 }=await import("./generated/agent-session.mjs");
 const {ModelRuntime}=await import(pathToFileURL(join(
   pkg,
   'dist/core/model-runtime.js'
 ))
   .href);
 const {createReadToolDefinition}=await import(pathToFileURL(join(
   pkg,
   'dist/core/tools/read.js'
 ))
   .href);
 const {wrapToolDefinition}=await import(pathToFileURL(join(
   pkg,
   'dist/core/tools/tool-definition-wrapper.js'
 ))
   .href);
 const settings=SettingsManager.inMemory({
   compaction:{enabled:false},
   retry:{enabled:false}
 });
 const modelRuntime=await ModelRuntime.create({
   authPath:join(
     agentDir,
     'auth.json'
   ),
   modelsPath:null,
   modelsStorePath:join(
     agentDir,
     'models-cache.json'
   ),
   refreshOnCreate:false,
   allowModelNetwork:false
 });
 modelRuntime.registerProvider(
   'batch-fixture',
   {
     baseUrl:'https://fixture.invalid/v1',
     api:'openai-completions',
     ...(useNativeProvider?{}:{streamSimple(){providerCalls++;throw new Error('Only the owned local stream is allowed');}}),
     models:[{
       id:'fixture',
       name:'Fixture',
       reasoning:false,
       input:['text'],
       cost:{
         input:0,
         output:0,
         cacheRead:0,
         cacheWrite:0
       },
       contextWindow:64_000,
       maxTokens:64
     }]
   }
 );
 await modelRuntime.setRuntimeApiKey(
   'batch-fixture',
   process.env
     .FIXTURE_API_KEY
 );
 const model=modelRuntime.getModel(
   'batch-fixture',
   'fixture'
 );assert.ok(model);
 writeFileSync(
   join(
     cwd,
     'AGENTS.md'
   ),
   policyText,
   {mode:0o600}
 );
 const promptTemplatePath=join(
   agentDir,
   'fixture-prompt.md'
 );
 if(promptTemplateText!==undefined)writeFileSync(
   promptTemplatePath,
   promptTemplateText,
   {mode:0o600}
 );
 const extensionModulePath=join(
   agentDir,
   'fixture-extension.mjs'
 );
 if(extensionModuleText!==undefined)writeFileSync(
   extensionModulePath,
   extensionModuleText,
   {mode:0o600}
 );
 if(discoveredSystemText!==undefined)writeFileSync(
   join(
     agentDir,
     'SYSTEM.md'
   ),
   discoveredSystemText,
   {mode:0o600}
 );
 const owner=createResourceInputOwner({
   DefaultResourceLoader,
   readSessionLoader:readActiveSessionResourceLoader,
   readSessionPrompt:readActiveSessionSystemPrompt,
   readSessionBase:readActiveSessionBaseComposition,
   readSessionRun:readActiveSessionRunComposition
 });
 const policyInput=createGoverningPolicyLoader({
   owner,
   readResourceToolInputs:readNativeExtensionToolInputs,
   readResourceToolOrigin:readNativeExtensionToolOrigin,
   readResourceToolUsage:readNativeExtensionToolInputUsage,
   readSessionInputUsage:readActiveSessionInputUsage,
   readSessionDomainEvents:readActiveSessionDomainEvents,
   readSessionConstructedInputs:readActiveSessionConstructedInputs,
   customPromptAuthority,
   policy:{
     root:cwd,
     relativePath:'AGENTS.md',
     requiredMode:0o600
   },
   authority:{
     tier:'user',
     scope:'original-request'
   },
   options:{
     cwd,
     agentDir,
     settingsManager:settings,
     agentsFilesOverride,
     appendSystemPromptOverride,
     additionalPromptTemplatePaths:promptTemplateText===undefined?[]:[promptTemplatePath],
     additionalExtensionPaths:extensionModuleText===undefined?[]:[extensionModulePath],
     extensionFactories,
     noExtensions:true,
     noSkills:true,
     noPromptTemplates:true,
     noThemes:true,
     systemPrompt:(discoveredSystemText===undefined)&&(!omitHostPrompt)?hostPrompt:undefined,
     appendSystemPrompt:appendPrompts
   }
 });
 await policyInput.reload();
 const parser=await createNativeMarkdownParser({
   repositoryRoot,
   expectedVersion:'0.10.5'
 });
 return {
   packageRoot:pkg,
   createAgentSession,
   SessionManager,
   readNativeExtensionToolInputs,
   readNativeExtensionToolOrigin,
   createReadToolDefinition,
   wrapToolDefinition,
   parser,
   policyInput,
   readRootOccurrence,
   readActiveSessionManager,
   readSessionDisposalState,
   readActiveSessionBaseComposition,
   readActiveSessionRunComposition,
   options:{
     cwd,
     agentDir,
     model,
     modelRuntime,
     thinkingLevel:'off',
     settingsManager:settings,
     resourceLoader:policyInput.loader,
     resourceInputBinding:policyInput.nativeBinding
   },
   async drain(){await owner.drain(policyInput.loader);assert.equal(
     networkAttempts,
     0
   );assert.equal(
     providerCalls,
     0
   );}
 };
}
