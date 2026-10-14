import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEnvironment } from '../native-batch/environment.mjs';
import { readHostResource } from './resource-reload.ts';
import { isOwnedProgramDefinition } from '../native-batch/generated/program-definition.mjs';

const env = await createEnvironment();
function source(relative) { return pathToFileURL(join(env.packageRoot, 'dist', relative)).href; }
const { createSessionManager } = await import(source('main.js'));
const {
  createAgentSessionServices,
  createAgentSessionFromServices
} = await import(source('core/agent-session-services.js'));
const { createAgentSessionRuntime } = await import(source('core/agent-session-runtime.js'));
const { nativeHost } = await import('./bootstrap.ts');
const { createCodemodeExtension } = await import(source('extensions/codemode/index.js'));

let trustCalls = 0;
let constructions = 0;
let cancelReplacement = false;
let replacementCallbacks = 0;
function observeExtensions(pi) {
  pi.on(
    'session_before_switch',
    function chooseFixtureCancellation() { return ( ({ cancel: cancelReplacement })); }
  );
}
async function createRuntime({
  cwd,
  agentDir,
  sessionManager,
  sessionStartEvent
}) {
  const services = await createAgentSessionServices({
    cwd,
    agentDir,
    modelRuntime: env.options.modelRuntime,
    settingsManager: env.options.settingsManager,
    resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true,
      noThemes: true, extensionFactories: [observeExtensions, createCodemodeExtension()] },
    resourceLoaderReloadOptions: { async resolveProjectTrust() { trustCalls++; return true; } },
  });
  const result = await createAgentSessionFromServices({
    services,
    sessionManager,
    sessionStartEvent,
    model: env.options.model,
    noTools: true
  });
  constructions++;
  assert.equal(
    typeof result.session.agent.executeToolBatch,
    'function'
  );
  assert.equal(
    isOwnedProgramDefinition(result.session.getToolDefinition('codemode')),
    true,
    'The native built-in extension must retain the original owned program definition'
  );
  return {
    ...result,
    services
  };
}
const initialManager = await createSessionManager(
  { noSession: true },
  env.options.cwd,
  undefined,
  env.options.settingsManager
);
const runtime = await createAgentSessionRuntime(
  createRuntime,
  {
  cwd: env.options.cwd, agentDir: env.options.agentDir, sessionManager: initialManager,
}
);
try {
  assert.equal(
    trustCalls,
    1,
    'Initial native services must retain the trust resolver'
  );
  const initialSession = runtime.session;
  const initialLease = nativeHost.lifecycle
    .capture({ session: initialSession, manager: initialManager });
  const resource = readHostResource(runtime.services
    .resourceLoader);
  const previousInput = resource.policyInput
    .readCurrent();
  await runtime.session
    .reload();
  assert.notEqual(
    resource.policyInput.readCurrent(),
    previousInput
  );
  assert.throws(function inspectRetiredPolicyInput() { return ( resource.policyInput
    .assertCurrent(previousInput)); });
  nativeHost.lifecycle
    .assertActive(initialLease);

  cancelReplacement = true;
  assert.deepEqual(
    await runtime.newSession(),
    { cancelled: true }
  );
  assert.equal(
    runtime.session,
    initialSession
  );
  nativeHost.lifecycle
    .assertActive(initialLease);
  cancelReplacement = false;

  assert.deepEqual(
    await runtime.newSession({ withSession() { replacementCallbacks++; } }),
    { cancelled: false }
  );
  assert.notEqual(
    runtime.session,
    initialSession
  );
  assert.equal(
    env.readSessionDisposalState(initialSession).completed,
    true
  );
  assert.throws(function inspectRetiredHostLease() { return ( nativeHost.lifecycle
    .assertActive(initialLease)); });
  assert.equal(
    replacementCallbacks,
    1
  );

  const beforeFork = runtime.session;
  const forkManager = beforeFork.sessionManager;
  const forkEntry = forkManager.appendMessage({
    role: 'user',
    content: 'Original fork input',
    timestamp: 1
  });
  const forked = await runtime.fork(forkEntry);
  assert.equal(
    forked.cancelled,
    false
  );
  assert.equal(
    forked.selectedText,
    'Original fork input'
  );
  assert.equal(
    runtime.session.sessionManager,
    forkManager
  );
  assert.notEqual(
    runtime.session,
    beforeFork
  );
  assert.equal(
    env.readSessionDisposalState(beforeFork).completed,
    true
  );
  assert.equal(
    constructions,
    3
  );
  assert.equal(
    trustCalls,
    3
  );
  await nativeHost.disposeSession(beforeFork);
  nativeHost.lifecycle
    .assertActive(nativeHost.lifecycle.capture({ session: runtime.session, manager: forkManager }));

  const persisted = nativeHost.managers
    .create(env.options.cwd, join(env.options.agentDir, 'fixture-sessions'));
  persisted.appendMessage({
    role: 'user',
    content: 'Persisted original input',
    timestamp: 2
  });
  const persistedPath = persisted.getSessionFile();
  const beforeResume = runtime.session;
  assert.deepEqual(
    await runtime.switchSession(persistedPath),
    { cancelled: false }
  );
  assert.notEqual(
    runtime.session,
    beforeResume
  );
  assert.equal(
    runtime.session.sessionFile,
    persistedPath
  );
  assert.equal(
    env.readSessionDisposalState(beforeResume).completed,
    true
  );

  const closing = runtime.session;
  const disconnect = closing._disconnectFromAgent;
  const failure = new Error('Native CLI fixture disposal remains incomplete');
  closing._disconnectFromAgent = function failHostDisconnection()  { throw failure; };
  await assert.rejects(
    function disposeHostFixtureSession() { return ( nativeHost.disposeSession(closing)); },
    function matchesHostDisposalFailure(error) { return ( error === failure); }
  );
  assert.equal(
    env.readSessionDisposalState(closing).completed,
    false
  );
  try {
    await assert.rejects(
      async function rejectConstructionDuringCleanup()  {
      const unexpected = await nativeHost.createSession({ ...env.options,
        resourceLoader: runtime.services.resourceLoader,
        sessionManager: nativeHost.managers.inMemory(env.options.cwd), noTools: true });
      await nativeHost.disposeSession(unexpected.session);
    },
      /cleanup is incomplete/u
    );
  } finally {
    closing._disconnectFromAgent = disconnect;
  }
  await nativeHost.disposeSession(closing);
  assert.equal(
    env.readSessionDisposalState(closing).completed,
    true
  );
  await nativeHost.disposeSession(closing);
  assert.equal(
    constructions,
    4
  );
  assert.equal(
    trustCalls,
    4
  );
} finally {
  await runtime.dispose();
  await env.drain();
}
console.log(JSON.stringify({
  complete: true,
  nativeCliManagerSelection: true,
  nativeServices: true,
  nativeRuntimeReplacement: true,
  constructions,
  trustCalls,
  reloadRetiresOldPolicyInput: true,
  cancellationPreservesSession: true,
  inMemoryForkReusesOriginalManager: true,
  persistedResume: true,
  incompleteDisposalRetry: true,
  providerRequests: 0
}));
