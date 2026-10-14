/**
 Prepare original native Agent and SDK modules with their retained input and group ownership boundaries.

 @module
 */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {sdk,core} from '../current-sdk/paths.ts';
import {batchBoundary} from './boundary.ts';
import {agentInputSource} from './agent-input-source.ts';
import {agentStateSource} from './agent-state-source.ts';
import {NativeBatchBuildError} from './build-entries.ts';
import {replaceOnce} from './build-rebase.ts';
import type { NativePreparationInput } from './prepare-types.ts';

//region Native Agent construction retains original input frames and complete group execution

/**
 Agent preparation keeps a diagnostic boundary separate from resource and program phases.
 */
const l = tagged({ tag: 'auto-mode-native-prepare-agent' });

/**
 Prepare original native Agent modules with qualified source edits and captured import selection.

 @param output - directory receiving generated modules from this build occurrence

 @param entry - pure selector over captured native package manifests

 @param imports - qualified static import rewriter retaining original module locations

 @throws NativeBatchBuildError when original source boundaries or import mappings change

 @example
 ```ts
 await prepareAgent({ output, entry, imports });
 ```
 */
export async function prepareAgent({output,entry,imports}: NativePreparationInput): Promise<void> {
  /**
   Each asynchronous source preparation retains the original phase diagnostics.
   */
  const rl = tagged({ tag: prepareAgent.name, l });
  rl.debug('reading original native Agent and SDK modules');
  /**
   The original loop module supplies complete-group execution boundaries.
   */
  const loopPath=join(
    core,
    'dist/agent-loop.js'
  );
  /**
   The original Agent module supplies state and input setter occurrences.
   */
  const agentPath=join(
    core,
    'dist/agent.js'
  );
  /**
   The original SDK factory owns native Session construction and capability installation.
   */
  const sdkPath=join(
    sdk,
    'dist/core/sdk.js'
  );
  /**
   All finite source inputs are captured before transformation or generated writes.
   */
  const [originalLoop, originalAgentSource, originalFactory] = await Promise.all([
    readFile(loopPath, 'utf8'),
    readFile(agentPath, 'utf8'),
    readFile(sdkPath, 'utf8')
  ]);
  /**
   The qualified group entry begins the native complete-batch replacement.
   */
  const start=originalLoop.indexOf('async function executeToolCalls(currentContext,');
  /**
   The next original loop function ends the qualified replacement region.
   */
  const end=originalLoop.indexOf(
    'async function executeToolCallsSequential(',
    start
  );
  if((start<0)||(end<=start))throw new NativeBatchBuildError('Native complete-tool-group boundary is unavailable');
  /**
   Only the original complete-group entry is replaced; native per-call execution remains intact.
   */
  const interceptedLoop=originalLoop.slice(0,start)+batchBoundary
    +originalLoop.slice(end);
  /**
   Original loop dependency imports retain the native module base.
   */
  const loop=imports({
    source:interceptedLoop,
    path:loopPath
  });
  /**
   Native state ownership is installed before original input frame observation.
   */
  const originalAgent=agentInputSource(
    agentStateSource(originalAgentSource),
  );
  /**
   The Agent retains one complete-group callback beside its native per-call hook.
   */
  const callbackAgent=replaceOnce({
    source:originalAgent,
    from:'    beforeToolCall;',
    to:'    beforeToolCall;\n    executeToolBatch;'
  });
  /**
   Original loop invocation receives this Agent's complete-group callback.
   */
  const forwardedAgent=replaceOnce({
    source:callbackAgent,
    from:'            beforeToolCall: this.beforeToolCall,',
    to:'            beforeToolCall: this.beforeToolCall,\n            executeToolBatch: this.executeToolBatch,'
  });
  /**
   The Agent resolves its loop import to the generated original group boundary.
   */
  const agent=imports({
    source:forwardedAgent,
    path:agentPath,
    overrides:{'./agent-loop.js':pathToFileURL(join(output,'agent-loop.mjs')).href}
  });
  /**
   Original context emission retains the active native Session binding.
   */
  const contextFactory=replaceOnce({
    source:originalFactory,
    from:'            return runner.emitContext(messages);',
    to:'            return emitActiveSessionContext({session,runner,messages});'
  });
  /**
   The factory imports existing owned observers from the generated native modules.
   */
  const instrumentedFactory=`import {emitActiveSessionContext} from "./agent-session.js";\nimport {captureNativeAgentInput} from "./session-manager.js";\n${contextFactory}`;
  /**
   Observer attachment precedes the original restoration and Session construction steps.
   */
  const observedFactory=replaceOnce({
    source:instrumentedFactory,
    from:'    // Restore missing settings metadata for older sessions.',
    to:'    const nativeStateAssignment=attachNativeAgentInputObserver({agent,observe:input=>captureNativeAgentInput({manager:sessionManager,...input})});\n    // Restore missing settings metadata for older sessions.'
  });
  /**
   Original Agent construction receives the qualified observed class while preserving stream exports.
   */
  const agentFactory=replaceOnce({
    source:observedFactory,
    from:'import { Agent, setDefaultStreamFn } from "@earendil-works/pi-agent-core";',
    to:'import { Agent, attachNativeAgentInputObserver } from "./agent.mjs";\nimport { setDefaultStreamFn } from '+JSON.stringify(entry({root:core}))+';'
  });
  /**
   The exact original Session constructor receives its native state assignment capability.
   */
  const assignedFactory=replaceOnce({
    source:agentFactory,
    from:'        sessionStartEvent: options.sessionStartEvent,\n    });',
    to:'        sessionStartEvent: options.sessionStartEvent,\n    }, nativeStateAssignment);'
  });
  /**
   Native resource inputs retain their original constructor binding.
   */
  const resourceFactory=replaceOnce({
    source:assignedFactory,
    from:'        resourceLoader,\n        customTools: options.customTools,',
    to:'        resourceLoader,\n        resourceInputBinding: options.resourceInputBinding,\n        customTools: options.customTools,'
  });
  /**
   Factory occurrence ownership begins before extension lookup can publish source state.
   */
  const scopedFactory=replaceOnce({
    source:resourceFactory,
    from:'    const extensionsResult = resourceLoader.getExtensions();',
    to:'    options.ownerFactoryScope?.registerSession(session);\n    const extensionsResult = resourceLoader.getExtensions();'
  });
  /**
   Original native dependency identities select their generated owned counterparts.
   */
  const factory=imports({
    source:scopedFactory,
    path:sdkPath,
    overrides:{'./agent.mjs':pathToFileURL(join(output,'agent.mjs')).href,'./agent-session.js':pathToFileURL(join(output,'agent-session.mjs')).href,'./resource-loader.js':pathToFileURL(join(output,'resource-loader.mjs')).href,'./session-manager.js':pathToFileURL(join(output,'session-manager.mjs')).href,'./messages.js':pathToFileURL(join(output,'messages.mjs')).href,[entry({root:core})]:entry({root:core})}
  });
  rl.debug('writing original Agent, loop, and SDK transformations');
  await Promise.all([
    writeFile(join(output,'agent-loop.mjs'), loop, {mode:0o600}),
    writeFile(join(output,'agent.mjs'), agent, {mode:0o600}),
    writeFile(join(output,'sdk.mjs'), factory, {mode:0o600})
  ]);
}

//endregion Native Agent construction retains original input frames and complete group execution
