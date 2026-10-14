/**
 Prepare original native Session, prompt, and serializer modules with retained source ownership.

 @module
 */
import {
  readFile,
  writeFile
} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {
  sdk,
  ai
} from '../current-sdk/paths.ts';
import {sessionStateSource} from './agent-state-source.ts';
import {sessionToolDescriptionSource} from './tool-description-source.ts';
import {
  managerSource,
  sessionSource
} from './root-source.ts';
import {
  promptSessionSource,
  promptEmitterSource
} from './prompt-source.ts';
import {promptBuilderSource} from './builder-source.ts';
import {eventRunnerSource} from './event-runner-source.ts';
import {
  handlerMessageSource,
  handlerProviderSource
} from './message-source.ts';
import {programSessionSource} from './program-source.ts';
import {
  helperUrl,
  replaceOnce
} from './build-rebase.ts';
import type {NativePreparationInput} from './prepare-types.ts';

//region Native Session and serializer preparation preserves original module and input identities

/**
 Session preparation diagnostics remain distinct from Agent and program phases.
 */
const l=tagged({tag:'auto-mode-native-prepare-session'});

/**
 Prepare native manager, Session, prompt, and serializer source through their existing owners.

 @param output - directory receiving generated modules from this build occurrence

 @param entry - captured package manifests supplying pure dependency selection

 @param imports - qualified import rewriter retaining original module locations

 @param providerPath - original provider serializer module from the qualified source graph

 @param openaiRoot - installed dependency root captured for that original provider module

 @throws NativeBatchBuildError when original native source qualification changes

 @example
 ```ts
 await prepareSession({output,entry,imports,providerPath,openaiRoot});
 ```
 */
export async function prepareSession({
  output,
  entry,
  imports,
  providerPath,
  openaiRoot
}: NativePreparationInput & {
  readonly providerPath:string;
  readonly openaiRoot:string
}): Promise<void> {
 /**
  This original native preparation phase retains its own diagnostic boundary.
  */
 const rl=tagged({
   tag:prepareSession.name,
   l
 });
 rl.debug('preparing original native Session and serializer modules');
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
  'loadout-query-observer.mjs',
  import.meta.url
).href;
/**
 Original context observations share the captured native manager input pool.
 */
const contextObserverUrl=new URL(
  'context-observer.ts',
  import.meta.url
).href;
/**
 Original event observations share the captured native manager input pool.
 */
const eventObserverUrl=new URL('event-observer.ts',import.meta.url).href;
/**
 Qualified native manager edits are rebased onto the original module dependency graph.
 */
const manager=imports({
  source:managerSource(await readFile(
    managerPath,
    'utf8'
  )),
  path:managerPath,
  overrides:{
    [publicationUrl]:publicationUrl,
    [loadedInputsUrl]:loadedInputsUrl,
    [queryObserverUrl]:queryObserverUrl,
    [contextObserverUrl]:contextObserverUrl,
    [eventObserverUrl]:eventObserverUrl
  }
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
  '../native-host/resource-reload.ts',
  import.meta.url
).href;
/**
 Original prompt composition uses the same owned resource reload boundary.
 */
const promptedSession=`import {reloadHostResource} from ${JSON.stringify(resourceReloadUrl)};\n${replaceOnce({
  source:promptSessionSource(ownedSession),
  from:'        await this.#resourceLoader.reload();',
  to:'        await reloadHostResource({loader: this.#resourceLoader});'
})}`;
/**
 Declared program execution retains the transformed native Session and original imports.
 */
const sessionCore=imports({
  source:programSessionSource(promptedSession),
  path:sessionPath,
  overrides:{
 [resourceReloadUrl]:resourceReloadUrl,
 './session-manager.js':pathToFileURL(join(
   output,
   'session-manager.mjs'
 ))
   .href,
 './messages.js':pathToFileURL(join(
   output,
   'messages.mjs'
 ))
   .href,
 './nested-tool-calls.js':pathToFileURL(join(
   output,
   'program-native-runner.mjs'
 ))
   .href,
 './program-definition.mjs':pathToFileURL(join(
   output,
   'program-definition.mjs'
 ))
   .href
}
});
/**
 Generated Session imports connect the existing manager, input, and prompt ownership modules.
 */
const session=`import {assertNativeAgentStateAssignment} from "./agent.mjs";\nimport {attachNativeContextCopies,readRootOccurrence,readNativeSessionInputOrigin,assertNativeSessionInputCapture,readNativeConstructedInputOrigins,readNativeSessionInputUsage,captureNativeQueuedInput,captureNativeCustomMessageInput,captureNativeInputEvent,observeNativeUninterceptedInput,observeNativeTransformedInput,captureNativeCommandInput,captureNativeCallInput,createNativeHandlerResultObserver,createNativeContextObserver} from "./session-manager.mjs";\n`
  +`import {createBaseCompositionOwner} from ${helperUrl("../../collector/rule-relevance-sdk-copy/input/base-owner.mjs")};\n`
  +`import {createRunPromptOwner} from ${helperUrl('../../collector/run-prompt-custody-v3/owner.mjs')};\n`
  +`import {copyPromptOptions} from ${helperUrl('../../collector/base-prompt-custody-v2/copy.mjs')};\n`
  +`import {emitOwnedBeforeAgentStart,emitOwnedContext,emitOwnedInput} from "./run-emitter.mjs";\n`
  +`import {readNativeRunnerDomainEvents} from "./event-runner.mjs";\n`
  +`import {buildOwnedSystemPromptSections} from "./prompt-builder.mjs";\n${sessionCore}`;
/**
 The original extension runner supplies native handler traversal and context construction.
 */
const runnerPath=join(
  sdk,
  'dist/core/extensions/runner.js'
);
/**
 Native dispatch and observer publication retain the same original runner class.
 */
const eventRunner=imports({
  source:eventRunnerSource(await readFile(runnerPath,'utf8')),
  path:runnerPath,
  overrides:{'./session-manager.mjs':pathToFileURL(join(output,'session-manager.mjs')).href}
});
await writeFile(join(output,'event-runner.mjs'),eventRunner,{mode:0o600});
/**
 Generated handlers retain original invocation, error, input, and context behavior.
 */
const emitter=promptEmitterSource({
  source:await readFile(
    runnerPath,
    'utf8'
  ),
  runnerUrl:pathToFileURL(runnerPath)
    .href,
  promptUrl:pathToFileURL(join(
    sdk,
    'dist/core/system-prompt.js'
  ))
    .href,
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
  source:promptBuilderSource({
    source:await readFile(
      promptPath,
      'utf8'
    ),
    skillsSource:await readFile(
      skillsPath,
      'utf8'
    )
  }),
  path:promptPath
});
await writeFile(
  join(
    output,
    'prompt-builder.mjs'
  ),
  builder,
  {mode:0o600}
);
await writeFile(
  join(
    output,
    'session-manager.mjs'
  ),
  manager,
  {mode:0o600}
);
await writeFile(
  join(
    output,
    'agent-session.mjs'
  ),
  session,
  {mode:0o600}
);
await writeFile(
  join(
    output,
    'run-emitter.mjs'
  ),
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
  join(
    output,
    'messages.mjs'
  ),
  handlerMessageSource({
    source:await readFile(
      messagesPath,
      'utf8'
    ),
    publicationUrl
  }),
  {mode:0o600}
);
/**
 The generated provider retains original serializer dependencies and publication observations.
 */
const provider=imports({
  source:handlerProviderSource({
    source:await readFile(
      providerPath,
      'utf8'
    ),
    publicationUrl
  }),
  path:providerPath,
  overrides:{
    openai:entry({root:openaiRoot}),
    [publicationUrl]:publicationUrl
  }
});
await writeFile(
  join(
    output,
    'openai-stream.mjs'
  ),
  provider,
  {mode:0o600}
);

}

//endregion Native Session and serializer preparation preserves original module and input identities
