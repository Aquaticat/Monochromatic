import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sdk,core} from '../current-sdk/paths.ts';
import {batchBoundary} from './boundary.mjs';
import {agentInputSource} from './agent-input-source.mjs';
import {agentStateSource} from './agent-state-source.mjs';
import {NativeBatchBuildError} from './build-entries.ts';
import {replaceOnce} from './build-rebase.ts';

/** Prepare the original native prepareAgent modules with qualified source edits. */
export async function prepareAgent({output,entry,imports}) {
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
  const originalLoop=await readFile(
    loopPath,
    'utf8'
  );
  const start=originalLoop.indexOf('async function executeToolCalls(currentContext,'); const end=originalLoop.indexOf(
    'async function executeToolCallsSequential(',
    start
  );
  if((start<0)||(end<=start))throw new NativeBatchBuildError('Native complete-tool-group boundary is unavailable');
  const interceptedLoop=originalLoop.slice(0,start)+batchBoundary
    +originalLoop.slice(end);
  const loop=imports({
    source:interceptedLoop,
    path:loopPath
  });
  const originalAgent=agentInputSource(
    agentStateSource(await readFile(agentPath,'utf8')),
  );
  const callbackAgent=replaceOnce({
    source:originalAgent,
    from:'    beforeToolCall;',
    to:'    beforeToolCall;\n    executeToolBatch;'
  });
  const forwardedAgent=replaceOnce({
    source:callbackAgent,
    from:'            beforeToolCall: this.beforeToolCall,',
    to:'            beforeToolCall: this.beforeToolCall,\n            executeToolBatch: this.executeToolBatch,'
  });
  const agent=imports({
    source:forwardedAgent,
    path:agentPath,
    overrides:{'./agent-loop.js':pathToFileURL(join(output,'agent-loop.mjs')).href}
  });
  const originalFactory=await readFile(
    sdkPath,
    'utf8'
  );
  const contextFactory=replaceOnce({
    source:originalFactory,
    from:'            return runner.emitContext(messages);',
    to:'            return emitActiveSessionContext({session,runner,messages});'
  });
  const instrumentedFactory=`import {emitActiveSessionContext} from "./agent-session.js";\nimport {captureNativeAgentInput} from "./session-manager.js";\n${contextFactory}`;
  const observedFactory=replaceOnce({
    source:instrumentedFactory,
    from:'    // Restore missing settings metadata for older sessions.',
    to:'    const nativeStateAssignment=attachNativeAgentInputObserver({agent,observe:input=>captureNativeAgentInput({manager:sessionManager,...input})});\n    // Restore missing settings metadata for older sessions.'
  });
  const agentFactory=replaceOnce({
    source:observedFactory,
    from:'import { Agent, setDefaultStreamFn } from "@earendil-works/pi-agent-core";',
    to:'import { Agent, attachNativeAgentInputObserver } from "./agent.mjs";\nimport { setDefaultStreamFn } from '+JSON.stringify(entry({root:core}))+';'
  });
  const assignedFactory=replaceOnce({
    source:agentFactory,
    from:'        sessionStartEvent: options.sessionStartEvent,\n    });',
    to:'        sessionStartEvent: options.sessionStartEvent,\n    }, nativeStateAssignment);'
  });
  const resourceFactory=replaceOnce({
    source:assignedFactory,
    from:'        resourceLoader,\n        customTools: options.customTools,',
    to:'        resourceLoader,\n        resourceInputBinding: options.resourceInputBinding,\n        customTools: options.customTools,'
  });
  const scopedFactory=replaceOnce({
    source:resourceFactory,
    from:'    const extensionsResult = resourceLoader.getExtensions();',
    to:'    options.ownerFactoryScope?.registerSession(session);\n    const extensionsResult = resourceLoader.getExtensions();'
  });
  const factory=imports({
    source:scopedFactory,
    path:sdkPath,
    overrides:{'./agent.mjs':pathToFileURL(join(output,'agent.mjs')).href,'./agent-session.js':pathToFileURL(join(output,'agent-session.mjs')).href,'./resource-loader.js':pathToFileURL(join(output,'resource-loader.mjs')).href,'./session-manager.js':pathToFileURL(join(output,'session-manager.mjs')).href,'./messages.js':pathToFileURL(join(output,'messages.mjs')).href,[entry({root:core})]:entry({root:core})}
  });
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
}
