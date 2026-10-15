import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readHostResource } from './resource-reload.ts';
import { env, source, fixtureState, createRuntime, nativeHost } from './lifecycle-fixture.mjs';

//region Original host lifecycle assertions retain the actual runtime.
const { createSessionManager } = await import(source('main.js'));
const { createAgentSessionRuntime } = await import(source('core/agent-session-runtime.js'));
const initialManager = await createSessionManager(
  { noSession: true },
  env.options
    .cwd,
  undefined,
  env.options
    .settingsManager
);
const runtime = await createAgentSessionRuntime(
  createRuntime,
  {
    cwd: env.options
      .cwd,
    agentDir: env.options
      .agentDir,
    sessionManager: initialManager,
  }
);
{
  await using runtimeScope = {
    async [Symbol.asyncDispose]() {
      await runtime.dispose();
      await env.drain();
    }
  };
  assert.equal(
    fixtureState.trustCalls,
    1,
    'Initial native services must retain the trust resolver'
  );
  const initialSession = runtime.session;
  const initialLease = nativeHost.lifecycle
    .capture({
      session: initialSession,
      manager: initialManager
    });
  const resource = readHostResource(runtime.services
    .resourceLoader);
  const previousInput = resource.policyInput
    .readCurrent();
  await runtime.session
    .reload();
  assert.notEqual(
    resource.policyInput
      .readCurrent(),
    previousInput
  );
  assert.throws(function inspectRetiredPolicyInput() { ; ( resource.policyInput
    .assertCurrent(previousInput)); });
  nativeHost.lifecycle
    .assertActive(initialLease);

  fixtureState.cancelReplacement = true;
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
  fixtureState.cancelReplacement = false;

  assert.deepEqual(
    await runtime.newSession({ withSession() { fixtureState.replacementCallbacks++; } }),
    { cancelled: false }
  );
  assert.notEqual(
    runtime.session,
    initialSession
  );
  assert.equal(
    env.readSessionDisposalState(initialSession)
      .completed,
    true
  );
  assert.throws(function inspectRetiredHostLease() { ; ( nativeHost.lifecycle
    .assertActive(initialLease)); });
  assert.equal(
    fixtureState.replacementCallbacks,
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
    runtime.session
      .sessionManager,
    forkManager
  );
  assert.notEqual(
    runtime.session,
    beforeFork
  );
  assert.equal(
    env.readSessionDisposalState(beforeFork)
      .completed,
    true
  );
  assert.equal(
    fixtureState.constructions,
    3
  );
  assert.equal(
    fixtureState.trustCalls,
    3
  );
  await nativeHost.disposeSession(beforeFork);
  nativeHost.lifecycle
    .assertActive(nativeHost.lifecycle
      .capture({
        session: runtime.session,
        manager: forkManager
      }));

  const persisted = nativeHost.managers
    .create(
      env.options
        .cwd,
      join(
        env.options
          .agentDir,
        'fixture-sessions'
      )
    );
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
    runtime.session
      .sessionFile,
    persistedPath
  );
  assert.equal(
    env.readSessionDisposalState(beforeResume)
      .completed,
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
    env.readSessionDisposalState(closing)
      .completed,
    false
  );
  {
    using disconnectionScope = {
      [Symbol.dispose]() {
        closing._disconnectFromAgent = disconnect;
      }
    };
    await assert.rejects(
      async function rejectConstructionDuringCleanup()  {
      const unexpected = await nativeHost.createSession({
        ...env.options,
        resourceLoader: runtime.services
          .resourceLoader,
        sessionManager: nativeHost.managers
          .inMemory(env.options
            .cwd),
        noTools: true
      });
      await nativeHost.disposeSession(unexpected.session);
    },
      function matchesIncompleteCleanup(error) {
        return (error instanceof Error) && error.message.includes('cleanup is incomplete');
      }
    );
  }
  await nativeHost.disposeSession(closing);
  assert.equal(
    env.readSessionDisposalState(closing)
      .completed,
    true
  );
  await nativeHost.disposeSession(closing);
  assert.equal(
    fixtureState.constructions,
    4
  );
  assert.equal(
    fixtureState.trustCalls,
    4
  );
}
console.log(JSON.stringify({
  complete: true,
  nativeCliManagerSelection: true,
  nativeServices: true,
  nativeRuntimeReplacement: true,
  constructions: fixtureState.constructions,
  trustCalls: fixtureState.trustCalls,
  reloadRetiresOldPolicyInput: true,
  cancellationPreservesSession: true,
  inMemoryForkReusesOriginalManager: true,
  persistedResume: true,
  incompleteDisposalRetry: true,
  providerRequests: 0
}));

//endregion
