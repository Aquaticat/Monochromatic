import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sessionStateSource} from './agent-state-source.mjs';
import {sessionToolDescriptionSource} from './tool-description-source.mjs';
import {managerSource,sessionSource} from './root-source.mjs';
import {promptSessionSource,promptEmitterSource} from './prompt-source.mjs';
import {promptBuilderSource} from './builder-source.mjs';
import {handlerMessageSource,handlerProviderSource} from './message-source.mjs';
import {programSessionSource} from './program-source.mjs';
import {prepareNativeHost} from '../native-host/prepare.ts';
import {createImportEntryReader} from './build-entries.ts';
import {createNativeImportRewriter,helperUrl,replaceOnce} from './build-rebase.ts';
import {prepareResources} from './prepare-resources.mjs';
import {prepareAgent} from './prepare-agent.mjs';
import {prepareProgram} from './prepare-program.mjs';
import {sdk,core,ai,codemode,tui,maintainedRoot} from '../current-sdk/paths.ts';

const providerPath=join(
  ai,
  'dist/api/openai-completions.js'
);
const openaiRoot=dirname(createRequire(pathToFileURL(providerPath))
  .resolve('openai'));
const entry=await createImportEntryReader({roots:[core,ai,codemode,tui,maintainedRoot,openaiRoot]});
const imports=createNativeImportRewriter({entry});

const output=join(
  import.meta.dirname,
  'generated'
);
await mkdir(
  output,
  {recursive:true,mode:0o700}
);
const maintainedEntry=entry({root:maintainedRoot});
// The incumbent stager owns import aliases. Native fixtures may change HOME after this link is prepared.
await writeFile(
  join(output,'maintained-policy.mjs'),
  'import {flushPolicyDiagnostics} from '+JSON.stringify(maintainedEntry)+';\nawait flushPolicyDiagnostics();\n'
 +'export {askUser,VERDICT_ENTRY_TYPE,AuthorizationEvidenceError,captureAuthorizationInputs,captureAuthorizationOwnerFactory,MISSING_AUTHORIZATION_EVIDENCE,assertOriginalInputBudget,InputReceiptBudgetError,resolveInstructionEffects,InstructionResolutionInputError,inspectAuthorizationRequirements,resolveGuardOutcome,lowerEstablishedClause,CLAUSE_RELATIONS,createNativeQueryObservation,installNativePolicyHooks,NativePolicyRuntimeError,consumeRequestMaterial,retainRequestMaterialObligations,SemanticAdmissionPolicyError,copySemanticAdmissionPolicy,inspectSemanticAdmissionScope,consumeHeadingContexts,consumeUnitAdoptions,selectUnitAdoptionPairs,UnitAdoptionBindingError,consumeSourceAssociations,PolicyInputBindingError,flushPolicyDiagnostics} from '+JSON.stringify(maintainedEntry)+';\n'
 +'export const maintainedPolicyEntry='+JSON.stringify(maintainedEntry)+';\nexport const maintainedPackageRoot='+JSON.stringify(maintainedRoot)+';\n',
  {mode:0o600}
);
await prepareResources({output,entry,imports});
await prepareAgent({output,entry,imports});
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
await prepareProgram({output,imports});
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
