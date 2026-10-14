/**
 Prepare the maintained native SDK graph with retained original source and runtime ownership.

 @module
 */
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sessionStateSource} from './agent-state-source.ts';
import {sessionToolDescriptionSource} from './tool-description-source.ts';
import {managerSource,sessionSource} from './root-source.ts';
import {promptSessionSource,promptEmitterSource} from './prompt-source.ts';
import {promptBuilderSource} from './builder-source.ts';
import {handlerMessageSource,handlerProviderSource} from './message-source.ts';
import {programSessionSource} from './program-source.ts';
import {prepareNativeHost} from '../native-host/prepare.ts';
import {createImportEntryReader} from './build-entries.ts';
import {createNativeImportRewriter,helperUrl,replaceOnce} from './build-rebase.ts';
import {prepareResources} from './prepare-resources.ts';
import {prepareAgent} from './prepare-agent.ts';
import {prepareProgram} from './prepare-program.ts';
import {sdk,core,ai,codemode,tui,maintainedRoot} from '../current-sdk/paths.ts';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeBatchBuildError } from './build-entries.ts';

//region Qualified native source preparation captures package identities before generated publication

/**
 The native preparation entry keeps its own build diagnostic boundary.
 */
const l = tagged({tag:'auto-mode-native-prepare'});

/**
 Read the qualified original SDK release for the completed build receipt.

 @returns release string from the emitted SDK package manifest

 @throws NativeBatchBuildError when the qualified package version is missing
 */
async function readSdkVersion(): Promise<string> {
 /**
  Release reporting retains a diagnostic boundary separate from source instrumentation.
  */
 const rl=tagged({tag:readSdkVersion.name,l});
 rl.debug('reading qualified native SDK version');
 /**
  Parsed manifest fields remain unknown until the release string is checked.
  */
 const manifest: unknown=JSON.parse(await readFile(join(sdk,'package.json'),'utf8'));
 if (typeof manifest !== 'object' || manifest === null || !('version' in manifest) || typeof manifest.version !== 'string') throw new NativeBatchBuildError('Qualified native SDK package version is unavailable');
 return manifest.version;
}

l.debug('preparing qualified original native source graph');
/**
 The original release is captured before generated modules are published.
 */
const sdkVersion=await readSdkVersion();


/**
 The original provider module supplies installed serializer imports and message conversion.
 */
const providerPath=join(
  ai,
  'dist/api/openai-completions.js'
);
/**
 The original provider dependency resolves from its installed package graph.
 */
const openaiRoot=dirname(createRequire(pathToFileURL(providerPath))
  .resolve('openai'));
/**
 Captured package manifests supply pure import selection during source preparation.
 */
const entry=await createImportEntryReader({roots:[core,ai,codemode,tui,maintainedRoot,openaiRoot]});
/**
 Native module import rewriting retains original dependency identities and explicit overrides.
 */
const imports=createNativeImportRewriter({entry});

/**
 The copied contract owns this build occurrence's generated native modules.
 */
const output=join(
  import.meta.dirname,
  'generated'
);
await mkdir(
  output,
  {recursive:true,mode:0o700}
);
/**
 The maintained package entry supplies the canonical policy and approval implementation.
 */
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
/**
 Original SessionManager source retains native history and root ownership.
 */
const managerPath=join(
  sdk,
  'dist/core/session-manager.js'
);
/**
 Original AgentSession source retains native prompt and lifetime behavior.
 */
const sessionPath=join(
  sdk,
  'dist/core/agent-session.js'
);
/**
 Message publication and copy observations retain their maintained source owner.
 */
const publicationUrl=new URL(
  '../../collector/run-prompt-custody-v3/handler-publication.mjs',
  import.meta.url
).href;
/**
 The original input pool remains attached to native manager construction.
 */
const loadedInputsUrl=new URL(
  '../../collector/run-prompt-custody-v3/loaded-inputs.mjs',
  import.meta.url
).href;
/**
 Loadout query observation retains original callback and output identity.
 */
const queryObserverUrl=new URL(
  './loadout-query-observer.mjs',
  import.meta.url
).href;
/**
 Qualified native manager edits are rebased onto the original module dependency graph.
 */
const manager=imports({
  source:managerSource(await readFile(managerPath,'utf8')),
  path:managerPath,
  overrides:{[publicationUrl]:publicationUrl,[loadedInputsUrl]:loadedInputsUrl,[queryObserverUrl]:queryObserverUrl}
});
/**
 Tool descriptions are captured before state and lifetime ownership is installed.
 */
const toolObservedSession=sessionToolDescriptionSource(await readFile(
  sessionPath,
  'utf8'
));
/**
 Native state, lifetime, and disposal completion retain their original Session boundaries.
 */
const ownedSession=sessionSource(sessionStateSource(toolObservedSession));
/**
 Native resource reload keeps the host policy input retirement owner.
 */
const resourceReloadUrl=new URL(
  '../native-host/resource-reload.mjs',
  import.meta.url
).href;
/**
 Original prompt composition uses the same owned resource reload boundary.
 */
const promptedSession=`import {reloadHostResource} from ${JSON.stringify(resourceReloadUrl)};\n${replaceOnce({source:promptSessionSource(ownedSession),from:'        await this.#resourceLoader.reload();',to:'        await reloadHostResource(this.#resourceLoader);'})}`;
/**
 Declared program execution retains the transformed native Session and original imports.
 */
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
/**
 Generated Session imports connect the existing manager, input, and prompt ownership modules.
 */
const session=`import {assertNativeAgentStateAssignment} from "./agent.mjs";\n`+`import {attachNativeContextCopies,readRootOccurrence,readNativeSessionInputOrigin,assertNativeSessionInputCapture,readNativeConstructedInputOrigins,readNativeSessionInputUsage,captureNativeQueuedInput,captureNativeCustomMessageInput,captureNativeInputEvent,observeNativeUninterceptedInput,observeNativeTransformedInput,captureNativeCommandInput,captureNativeCallInput,createNativeHandlerResultObserver} from "./session-manager.mjs";\n`+`import {createBaseCompositionOwner} from ${helperUrl("../../collector/rule-relevance-sdk-copy/input/base-owner.mjs")};\n`
 +`import {createRunPromptOwner} from ${helperUrl('../../collector/run-prompt-custody-v3/owner.mjs')};\n`
 +`import {copyPromptOptions} from ${helperUrl('../../collector/base-prompt-custody-v2/copy.mjs')};\n`
 +`import {emitOwnedBeforeAgentStart,emitOwnedContext,emitOwnedInput} from "./run-emitter.mjs";\n`
 +`import {buildOwnedSystemPromptSections} from "./prompt-builder.mjs";\n${sessionCore}`;
/**
 The original extension runner supplies native handler traversal and context construction.
 */
const runnerPath=join(
  sdk,
  'dist/core/extensions/runner.js'
);
/**
 Generated handlers retain original invocation, error, input, and context behavior.
 */
const emitter=promptEmitterSource({
  source:await readFile(runnerPath,'utf8'),
  runnerUrl:pathToFileURL(runnerPath).href,
  promptUrl:pathToFileURL(join(sdk,'dist/core/system-prompt.js')).href,
  aiUrl:entry({root:ai})
});
/**
 The original prompt builder supplies native default rules and source composition.
 */
const promptPath=join(
  sdk,
  'dist/core/system-prompt.js'
);
/**
 The original skill formatter remains part of native prompt construction.
 */
const skillsPath=join(
  sdk,
  'dist/core/skills.js'
);
/**
 The generated prompt builder retains original module dependencies and captured skill formatting.
 */
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
/**
 The original native message module supplies input projection and serialization boundaries.
 */
const messagesPath=join(
  sdk,
  'dist/core/messages.js'
);
await writeFile(
  join(output,'messages.mjs'),
  handlerMessageSource({source:await readFile(messagesPath,'utf8'),publicationUrl}),
  {mode:0o600}
);
/**
 The generated provider retains original serializer dependencies and publication observations.
 */
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
  SDKVersion:sdkVersion,
  copiedModules:13,
  installedSourcesModified:false
}));

//endregion Qualified native source preparation captures package identities before generated publication
