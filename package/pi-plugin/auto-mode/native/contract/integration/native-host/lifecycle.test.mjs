import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEnvironment } from '../native-batch/environment.mjs';
import { readHostResource } from './resource-reload.mjs';

const env = await createEnvironment();
const source = relative => pathToFileURL(join(env.packageRoot, 'dist', relative)).href;
const { createSessionManager } = await import(source('main.js'));
const { createAgentSessionServices, createAgentSessionFromServices } = await import(source('core/agent-session-services.js'));
const { createAgentSessionRuntime } = await import(source('core/agent-session-runtime.js'));
const { nativeHost } = await import('./bootstrap.mjs');

let trustCalls = 0;
let constructions = 0;
let cancelReplacement = false;
let replacementCallbacks = 0;
function observeExtensions(pi) {
  pi.on('session_before_switch', () => ({ cancel: cancelReplacement }));
}
async function createRuntime({ cwd, agentDir, sessionManager, sessionStartEvent }) {
  const services = await createAgentSessionServices({ cwd, agentDir,
    modelRuntime: env.options.modelRuntime, settingsManager: env.options.settingsManager,
    resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true,
      noThemes: true, extensionFactories: [observeExtensions] },
    resourceLoaderReloadOptions: { async resolveProjectTrust() { trustCalls++; return true; } },
  });
  const result = await createAgentSessionFromServices({ services, sessionManager,
    sessionStartEvent, model: env.options.model, noTools: true });
  constructions++;
  assert.equal(typeof result.session.agent.executeToolBatch, 'function');
  return { ...result, services };
}
const initialManager = await createSessionManager({ noSession: true }, env.options.cwd,
  undefined, env.options.settingsManager);
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: env.options.cwd, agentDir: env.options.agentDir, sessionManager: initialManager,
});
try {
  assert.equal(trustCalls, 1, 'Initial native services must retain the trust resolver');
  const initialSession = runtime.session;
  const initialLease = nativeHost.lifecycle.capture({ session: initialSession, manager: initialManager });
  const resource = readHostResource(runtime.services.resourceLoader);
  const previousInput = resource.policyInput.readCurrent();
  await runtime.session.reload();
  assert.notEqual(resource.policyInput.readCurrent(), previousInput);
  assert.throws(() => resource.policyInput.assertCurrent(previousInput));
  nativeHost.lifecycle.assertActive(initialLease);

  cancelReplacement = true;
  assert.deepEqual(await runtime.newSession(), { cancelled: true });
  assert.equal(runtime.session, initialSession);
  nativeHost.lifecycle.assertActive(initialLease);
  cancelReplacement = false;

  assert.deepEqual(await runtime.newSession({ withSession() { replacementCallbacks++; } }), { cancelled: false });
  assert.notEqual(runtime.session, initialSession);
  assert.equal(env.readSessionDisposalState(initialSession).completed, true);
  assert.throws(() => nativeHost.lifecycle.assertActive(initialLease));
  assert.equal(replacementCallbacks, 1);

  const beforeFork = runtime.session;
  const forkManager = beforeFork.sessionManager;
  const forkEntry = forkManager.appendMessage({ role: 'user', content: 'Original fork input', timestamp: 1 });
  const forked = await runtime.fork(forkEntry);
  assert.equal(forked.cancelled, false);
  assert.equal(forked.selectedText, 'Original fork input');
  assert.equal(runtime.session.sessionManager, forkManager);
  assert.notEqual(runtime.session, beforeFork);
  assert.equal(env.readSessionDisposalState(beforeFork).completed, true);
  assert.equal(constructions, 3);
  assert.equal(trustCalls, 3);
  await nativeHost.disposeSession(beforeFork);
  nativeHost.lifecycle.assertActive(nativeHost.lifecycle.capture({ session: runtime.session, manager: forkManager }));
} finally {
  await runtime.dispose();
  await env.drain();
}
console.log(JSON.stringify({ complete: true, nativeCliManagerSelection: true,
  nativeServices: true, nativeRuntimeReplacement: true, constructions, trustCalls,
  reloadRetiresOldPolicyInput: true, cancellationPreservesSession: true,
  inMemoryForkReusesOriginalManager: true, providerRequests: 0 }));
