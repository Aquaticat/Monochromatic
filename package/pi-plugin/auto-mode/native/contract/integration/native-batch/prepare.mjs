import {
  copyFile,
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {
  dirname,
  join
} from 'node:path';
import {pathToFileURL} from 'node:url';
import {batchBoundary} from './boundary.mjs';
import {agentInputSource} from './agent-input-source.mjs';
import {
  agentStateSource,
  sessionStateSource
} from './agent-state-source.mjs';
import {sessionToolDescriptionSource} from './tool-description-source.mjs';
import {
  extensionToolSource,
  resourceToolSource
} from './extension-tool-source.mjs';
import {
  readStagedInput,
  replaceStagedImport
} from './staged-import.mjs';
import {judgmentSource} from './judgment-source.mjs';
import {
  managerSource,
  sessionSource
} from './root-source.mjs';
import {
  promptSessionSource,
  promptEmitterSource
} from './prompt-source.mjs';
import {promptBuilderSource} from './builder-source.mjs';
import {
  handlerMessageSource,
  handlerProviderSource
} from './message-source.mjs';
import {
  preparedDispatcherSource,
  programSessionSource,
  programJudgmentSource,
  programExecutorSource,
  programRunnerSource,
  programDefinitionSource,
  nativeScriptValueSource
} from './program-source.mjs';
import {parse} from "../../collector/program-rule-batch-sdk-copy-v2/input/parser.mjs";
import {prepareNativeHost} from '../native-host/prepare.mjs';

import {createImportEntryReader, NativeBatchBuildError} from './build-entries.ts';
import {
  sdk,
  core,
  ai,
  codemode,
  tui,
  maintainedRoot
} from '../current-sdk/paths.ts';

const providerPath=join(
  ai,
  'dist/api/openai-completions.js'
);
const openaiRoot=dirname(createRequire(pathToFileURL(providerPath))
  .resolve('openai'));
const entry=await createImportEntryReader({roots:[core,ai,codemode,tui,maintainedRoot,openaiRoot]});

const output=join(
  import.meta.dirname,
  'generated'
);
await mkdir(
  output,
  {recursive:true,mode:0o700}
);
function replaceOnce({
  source,
  from,
  to
}){
 const at=source.indexOf(from);
 if((at<0)||(source.indexOf(from,at+from.length)!==-1))throw new NativeBatchBuildError(`Native SDK edit does not have one matching location: ${from}`);
 return source.slice(0,at)+to
   +source.slice(at+from.length);
}
function imports({
  source,
  path,
  overrides={}
}){
 return source.replaceAll(/^(import[^\n]+from|export \* from) "([^"\n]+)";/gm,function rebaseNativeImport(
   original,
   prefix,
   specifier
 ) {
  if(specifier.startsWith('node:')||[
    'crypto',
    'fs',
    'fs/promises',
    'path',
    'readline',
    'string_decoder'
  ].includes(specifier))return original;
  const target=overrides[specifier]??(specifier.startsWith('.')?new URL(
    specifier,
    pathToFileURL(path)
  ).href:specifier==='@earendil-works/pi-agent-core'?entry({root:core}):specifier==='@earendil-works/pi-ai'?entry({root:ai}):specifier==='@earendil-works/pi-ai/compat'?entry({
    root:ai,
    subpath:'./compat'
  }):specifier==='@earendil-works/pi-codemode'?entry({root:codemode}):undefined);
  if(!target)throw new NativeBatchBuildError(`Unmapped native import: ${specifier}`);
  return `${prefix} ${JSON.stringify(target)};`;
 });
}
const maintainedEntry=entry({root:maintainedRoot});
// The incumbent stager owns import aliases. Native fixtures may change HOME after this link is prepared.
await writeFile(
  join(output,'maintained-policy.mjs'),
  'import {flushPolicyDiagnostics} from '+JSON.stringify(maintainedEntry)+';\nawait flushPolicyDiagnostics();\n'
 +'export {askUser,VERDICT_ENTRY_TYPE,AuthorizationEvidenceError,captureAuthorizationInputs,captureAuthorizationOwnerFactory,MISSING_AUTHORIZATION_EVIDENCE,assertOriginalInputBudget,InputReceiptBudgetError,resolveInstructionEffects,InstructionResolutionInputError,inspectAuthorizationRequirements,resolveGuardOutcome,lowerEstablishedClause,CLAUSE_RELATIONS,createNativeQueryObservation,installNativePolicyHooks,NativePolicyRuntimeError,consumeRequestMaterial,retainRequestMaterialObligations,SemanticAdmissionPolicyError,copySemanticAdmissionPolicy,inspectSemanticAdmissionScope,consumeHeadingContexts,consumeUnitAdoptions,selectUnitAdoptionPairs,UnitAdoptionBindingError,consumeSourceAssociations,PolicyInputBindingError,flushPolicyDiagnostics} from '+JSON.stringify(maintainedEntry)+';\n'
 +'export const maintainedPolicyEntry='+JSON.stringify(maintainedEntry)+';\nexport const maintainedPackageRoot='+JSON.stringify(maintainedRoot)+';\n',
  {mode:0o600}
);
const extensionLoaderPath=join(
  sdk,
  'dist/core/extensions/loader.js'
),resourceLoaderPath=join(
  sdk,
  'dist/core/resource-loader.js'
);
const nativeAliases={
 '@earendil-works/pi-agent-core':entry({root:core}),
 '@earendil-works/pi-tui':entry({root:tui}),
 '@earendil-works/pi-ai/compat':entry({
   root:ai,
   subpath:'./compat'
 }),
 '@earendil-works/pi-ai/oauth':entry({
   root:ai,
   subpath:'./oauth'
 }),
 '@earendil-works/pi-ai/providers/all':entry({root:ai,subpath:'./providers/*'})
   .replace('*','all')
};
let extensionLoader=extensionToolSource(await readFile(
  extensionLoaderPath,
  'utf8'
));
extensionLoader=replaceOnce({
  source:extensionLoader,
  from:'import.meta.resolve(specifier)',
  to:'('+JSON.stringify(nativeAliases)+')[specifier]'
});
extensionLoader=extensionLoader.replaceAll(
  'import.meta.url',
  JSON.stringify(pathToFileURL(extensionLoaderPath).href)
);
extensionLoader=extensionLoader.replaceAll(/import\("(\.[^"]+)"\)/g,function rebaseNativeDynamicImport(
  _match,
  specifier
) { return (`import(${JSON.stringify(new URL(specifier,pathToFileURL(extensionLoaderPath)).href)})`); });
await writeFile(
  join(output,'extension-loader.mjs'),
  imports({source:extensionLoader,path:extensionLoaderPath}),
  {mode:0o600}
);
const poolUrl=new URL(
  '../../collector/run-prompt-custody-v3/loaded-inputs.mjs',
  import.meta.url
).href;
const resourceLoader=imports({
  source:resourceToolSource(await readFile(resourceLoaderPath,'utf8')),
  path:resourceLoaderPath,
  overrides:{
 './extensions/loader.js':pathToFileURL(join(output,'extension-loader.mjs')).href,
 '@earendil-works/pi-tui':entry({root:tui}),
 chalk:pathToFileURL(createRequire(pathToFileURL(resourceLoaderPath)).resolve('chalk')).href,
 [poolUrl]:poolUrl
}
});
await writeFile(
  join(output,'resource-loader.mjs'),
  resourceLoader,
  {mode:0o600}
);
const loopPath=join(
  core,
  'dist/agent-loop.js'
),agentPath=join(
  core,
  'dist/agent.js'
),sdkPath=join(
  sdk,
  'dist/core/sdk.js'
);
let loop=await readFile(
  loopPath,
  'utf8'
);
const start=loop.indexOf('async function executeToolCalls(currentContext,'); const end=loop.indexOf(
  'async function executeToolCallsSequential(',
  start
);
if((start<0)||(end<=start))throw new NativeBatchBuildError('Native complete-tool-group boundary is unavailable');
loop=loop.slice(0,start)+batchBoundary
  +loop.slice(end);
loop=imports({
  source:loop,
  path:loopPath
});
let agent=agentInputSource(
  agentStateSource(await readFile(agentPath,'utf8')),
);
agent=replaceOnce({
  source:agent,
  from:'    beforeToolCall;',
  to:'    beforeToolCall;\n    executeToolBatch;'
});
agent=replaceOnce({
  source:agent,
  from:'            beforeToolCall: this.beforeToolCall,',
  to:'            beforeToolCall: this.beforeToolCall,\n            executeToolBatch: this.executeToolBatch,'
});
agent=imports({
  source:agent,
  path:agentPath,
  overrides:{'./agent-loop.js':pathToFileURL(join(output,'agent-loop.mjs')).href}
});
const managerPath=join(
  sdk,
  'dist/core/session-manager.js'
),sessionPath=join(
  sdk,
  'dist/core/agent-session.js'
);
const publicationUrl=new URL(
  '../../collector/run-prompt-custody-v3/handler-publication.mjs',
  import.meta.url
).href;
const loadedInputsUrl=new URL(
  '../../collector/run-prompt-custody-v3/loaded-inputs.mjs',
  import.meta.url
).href;
const queryObserverUrl=new URL(
  './loadout-query-observer.mjs',
  import.meta.url
).href;
const manager=imports({
  source:managerSource(await readFile(managerPath,'utf8')),
  path:managerPath,
  overrides:{[publicationUrl]:publicationUrl,[loadedInputsUrl]:loadedInputsUrl,[queryObserverUrl]:queryObserverUrl}
});
const toolObservedSession=sessionToolDescriptionSource(await readFile(
  sessionPath,
  'utf8'
));
const ownedSession=sessionSource(sessionStateSource(toolObservedSession));
const resourceReloadUrl=new URL(
  '../native-host/resource-reload.mjs',
  import.meta.url
).href;
const promptedSession=`import {reloadHostResource} from ${JSON.stringify(resourceReloadUrl)};\n${replaceOnce({source:promptSessionSource(ownedSession),from:'        await this.#resourceLoader.reload();',to:'        await reloadHostResource(this.#resourceLoader);'})}`;
const sessionCore=imports({
  source:programSessionSource(promptedSession),
  path:sessionPath,
  overrides:{
 [resourceReloadUrl]:resourceReloadUrl,
 './session-manager.js':pathToFileURL(join(output,'session-manager.mjs')).href,
 './messages.js':pathToFileURL(join(output,'messages.mjs')).href,
 './nested-tool-calls.js':pathToFileURL(join(output,'program-native-runner.mjs')).href,
 './program-definition.mjs':pathToFileURL(join(output,'program-definition.mjs')).href
}
});
function helperUrl(relative) { return JSON.stringify(new URL(relative,import.meta.url).href); }
const session=`import {assertNativeAgentStateAssignment} from "./agent.mjs";\n`+`import {attachNativeContextCopies,readRootOccurrence,readNativeSessionInputOrigin,assertNativeSessionInputCapture,readNativeConstructedInputOrigins,readNativeSessionInputUsage,captureNativeQueuedInput,captureNativeCustomMessageInput,captureNativeInputEvent,observeNativeUninterceptedInput,observeNativeTransformedInput,captureNativeCommandInput,captureNativeCallInput,createNativeHandlerResultObserver} from "./session-manager.mjs";\n`+`import {createBaseCompositionOwner} from ${helperUrl("../../collector/rule-relevance-sdk-copy/input/base-owner.mjs")};\n`
 +`import {createRunPromptOwner} from ${helperUrl('../../collector/run-prompt-custody-v3/owner.mjs')};\n`
 +`import {copyPromptOptions} from ${helperUrl('../../collector/base-prompt-custody-v2/copy.mjs')};\n`
 +`import {emitOwnedBeforeAgentStart,emitOwnedContext,emitOwnedInput} from "./run-emitter.mjs";\n`
 +`import {buildOwnedSystemPromptSections} from "./prompt-builder.mjs";\n${sessionCore}`;
const runnerPath=join(
  sdk,
  'dist/core/extensions/runner.js'
);
const emitter=promptEmitterSource({
  source:await readFile(runnerPath,'utf8'),
  runnerUrl:pathToFileURL(runnerPath).href,
  promptUrl:pathToFileURL(join(sdk,'dist/core/system-prompt.js')).href,
  aiUrl:entry({root:ai})
});
let factory=await readFile(
  sdkPath,
  'utf8'
);
factory=replaceOnce({
  source:factory,
  from:'            return runner.emitContext(messages);',
  to:'            return emitActiveSessionContext({session,runner,messages});'
});
factory=`import {emitActiveSessionContext} from "./agent-session.js";\nimport {captureNativeAgentInput} from "./session-manager.js";\n${factory}`;
factory=replaceOnce({
  source:factory,
  from:'    // Restore missing settings metadata for older sessions.',
  to:'    const nativeStateAssignment=attachNativeAgentInputObserver({agent,observe:input=>captureNativeAgentInput({manager:sessionManager,...input})});\n    // Restore missing settings metadata for older sessions.'
});
factory=replaceOnce({
  source:factory,
  from:'import { Agent, setDefaultStreamFn } from "@earendil-works/pi-agent-core";',
  to:'import { Agent, attachNativeAgentInputObserver } from "./agent.mjs";\nimport { setDefaultStreamFn } from '+JSON.stringify(entry({root:core}))+';'
});
factory=replaceOnce({
  source:factory,
  from:'        sessionStartEvent: options.sessionStartEvent,\n    });',
  to:'        sessionStartEvent: options.sessionStartEvent,\n    }, nativeStateAssignment);'
});
factory=replaceOnce({
  source:factory,
  from:'        resourceLoader,\n        customTools: options.customTools,',
  to:'        resourceLoader,\n        resourceInputBinding: options.resourceInputBinding,\n        customTools: options.customTools,'
});
factory=replaceOnce({
  source:factory,
  from:'    const extensionsResult = resourceLoader.getExtensions();',
  to:'    options.ownerFactoryScope?.registerSession(session);\n    const extensionsResult = resourceLoader.getExtensions();'
});
factory=imports({
  source:factory,
  path:sdkPath,
  overrides:{'./agent.mjs':pathToFileURL(join(output,'agent.mjs')).href,'./agent-session.js':pathToFileURL(join(output,'agent-session.mjs')).href,'./resource-loader.js':pathToFileURL(join(output,'resource-loader.mjs')).href,'./session-manager.js':pathToFileURL(join(output,'session-manager.mjs')).href,'./messages.js':pathToFileURL(join(output,'messages.mjs')).href,[entry({root:core})]:entry({root:core})}
});
const promptPath=join(
  sdk,
  'dist/core/system-prompt.js'
),skillsPath=join(
  sdk,
  'dist/core/skills.js'
);
const builder=imports({
  source:promptBuilderSource({source:await readFile(promptPath,'utf8'),skillsSource:await readFile(skillsPath,'utf8')}),
  path:promptPath
});
await writeFile(
  join(output,'prompt-builder.mjs'),
  builder,
  {mode:0o600}
);
const executorPath=join(
  sdk,
  'dist/extensions/codemode/execute.js'
),executorSource=await readFile(
  executorPath,
  'utf8'
);
const executor=imports({
  source:programExecutorSource(executorSource),
  path:executorPath
});
await writeFile(
  join(output,'program-executor.mjs'),
  executor,
  {mode:0o600}
);
await writeFile(
  join(output,'native-script-value.mjs'),
  nativeScriptValueSource({source:executorSource,parse}),
  {mode:0o600}
);
await writeFile(
  join(output,'program-definition.mjs'),
  programDefinitionSource({nativeToolUrl:pathToFileURL(join(sdk,'dist/extensions/codemode/tool.js')).href,executorUrl:pathToFileURL(join(output,'program-executor.mjs')).href}),
  {mode:0o600}
);
const programRunner=programRunnerSource(
  await readStagedInput(new URL("../../collector/program-rule-batch-sdk-copy-v2/input/program-runner.mjs",import.meta.url)),
);
await writeFile(
  join(output,'program-runner.mjs'),
  programRunner,
  {mode:0o600}
);
const runnerShim='import {NestedToolCallRunner as NativeRunner,NestedCallRecorder} from '+JSON.stringify(pathToFileURL(join(sdk,'dist/core/nested-tool-calls.js')).href)
  +';\n'
  +'import {createReachedRunnerClass} from "./program-runner.mjs";\n'
  +'import {dispatchPreparedBatch} from '
  +helperUrl("../../collector/result-program-sdk-copy-guarded/input/child-prepared-dispatch.mjs")
  +';\n'
  +'export const NestedToolCallRunner=createReachedRunnerClass({NestedToolCallRunner:NativeRunner,NestedCallRecorder,dispatchPreparedBatch});\n';
await writeFile(
  join(output,'program-native-runner.mjs'),
  runnerShim,
  {mode:0o600}
);
const returnConsumer=await replaceStagedImport({
  source:await readStagedInput(new URL("../../collector/program-rule-batch-sdk-copy-v2/input/native-return-consumer.mjs",import.meta.url)),
  binding:'toScriptValue',
  expected:new URL("../../collector/program-rule-batch-sdk-copy-v2/input/native-script-value.mjs",import.meta.url),
  replacement:pathToFileURL(join(output,'native-script-value.mjs')).href
});
await writeFile(
  join(output,'native-return-consumer.mjs'),
  returnConsumer,
  {mode:0o600}
);
const dispatcherUrl=new URL(
  "../../collector/program-rule-batch-sdk-copy-v2/input/prepared-dispatch.mjs",
  import.meta.url
);
await writeFile(
  join(output,'prepared-dispatch.mjs'),
  preparedDispatcherSource({source:await readStagedInput(dispatcherUrl),originalUrl:dispatcherUrl.href}),
  {mode:0o600}
);
const originalJudgment=await replaceStagedImport({
  source:await readStagedInput(new URL("../../collector/program-rule-batch-sdk-copy-v2/input/child-constructor.mjs",import.meta.url)),
  binding:'createNativeReturnConsumer',
  expected:new URL("../../collector/program-rule-batch-sdk-copy-v2/input/native-return-consumer.mjs",import.meta.url),
  replacement:pathToFileURL(join(output,'native-return-consumer.mjs')).href
});
const judgment=programJudgmentSource(judgmentSource({
  source:originalJudgment,
  indexUrl:new URL('../../lifecycle/governing-rule-candidates/set.mjs',import.meta.url).href
}));
await writeFile(
  join(output,'judgment.mjs'),
  judgment,
  {mode:0o600}
);
await writeFile(
  join(output,'agent-loop.mjs'),
  loop,
  {mode:0o600}
);
await writeFile(
  join(output,'agent.mjs'),
  agent,
  {mode:0o600}
);
await writeFile(
  join(output,'sdk.mjs'),
  factory,
  {mode:0o600}
);
await writeFile(
  join(output,'session-manager.mjs'),
  manager,
  {mode:0o600}
);
await writeFile(
  join(output,'agent-session.mjs'),
  session,
  {mode:0o600}
);
await writeFile(
  join(output,'run-emitter.mjs'),
  emitter,
  {mode:0o600}
);
const messagesPath=join(
  sdk,
  'dist/core/messages.js'
);
await writeFile(
  join(output,'messages.mjs'),
  handlerMessageSource({source:await readFile(messagesPath,'utf8'),publicationUrl}),
  {mode:0o600}
);
const provider=imports({
  source:handlerProviderSource({source:await readFile(providerPath,'utf8'),publicationUrl}),
  path:providerPath,
  overrides:{openai:entry({root:openaiRoot}),[publicationUrl]:publicationUrl}
});
await writeFile(
  join(output,'openai-stream.mjs'),
  provider,
  {mode:0o600}
);
await copyFile(
  join(import.meta.dirname,'PI-LICENSE.txt'),
  join(output,'LICENSE')
);
await prepareNativeHost({output});
console.log(JSON.stringify({
  complete:true,
  SDKVersion:JSON.parse(await readFile(join(sdk,'package.json'),'utf8')).version,
  copiedModules:13,
  installedSourcesModified:false
}));
