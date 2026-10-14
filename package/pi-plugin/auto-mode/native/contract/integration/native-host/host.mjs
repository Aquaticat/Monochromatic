import { createRootSessionFactory } from '../native-batch/session-root.mjs';
import { createAgentSession } from '../native-batch/generated/sdk.mjs';
import {
  SessionManager,
  readRootOccurrence
} from '../native-batch/generated/session-manager.mjs';
import {
  readActiveSessionManager,
  readSessionDisposalState
} from '../native-batch/generated/agent-session.mjs';
import { createHostResource } from './resources.mjs';
import {
  readHostResource,
  reloadHostResource
} from './resource-reload.mjs';

import { NativeCliHostError } from './host-error.ts';
export { NativeCliHostError } from './host-error.ts';

//region One bootstrap owns CLI managers, resources, construction, and terminal cleanup.

/** Bind configuration once; SDK callers cannot inject construction owners or policy runtimes. */
export function createNativeCliHost({
  designatePolicy,
  bindSession
}) {
  if (((typeof designatePolicy) !== 'function') || ((typeof bindSession) !== 'function'))
    throw new NativeCliHostError('Native CLI bootstrap requires fixed policy designation and session binding');
  const sessions = new WeakMap();
  const resources = new WeakSet();
  const pendingDisposals = new Set();
  function registerSession({
    session,
    manager,
    lifecycle,
    options
  }) {
    if (!resources.has(options.resourceLoader))
      throw new NativeCliHostError('Session resources belong to another native CLI host');
    const resource = readHostResource(options.resourceLoader);
    const root = Object.freeze({
      session,
      manager
    });
    const lease = lifecycle.capture(root);
    const runtime = bindSession({
      root,
      lifecycle,
      resource,
      options
    });
    if ((typeof runtime?.detach) !== 'function')
      throw new NativeCliHostError('Native policy binding must provide completed-session detachment');
    sessions.set(
      session,
      {
        root,
        lease,
        resource,
        runtime,
        retired: false,
        completed: false
      }
    );
  }
  const factory = createRootSessionFactory({
    createAgentSession,
    SessionManager,
    readRootOccurrence,
    readActiveSessionManager,
    readSessionDisposalState,
    onSessionRegistered: registerSession,
  });
  const managers = Object.freeze({
    ...factory.managers,
    list: SessionManager.list
      .bind(SessionManager),
    listAll: SessionManager.listAll
      .bind(SessionManager),
    findById: SessionManager.findById
      .bind(SessionManager),
  });
  async function createResourceLoader(options) {
    // Preserve original outer options while policy designation performs asynchronous file inspection.
    const capturedOptions = {...options};
    const designation = await designatePolicy(capturedOptions);
    const resource = createHostResource({
      options: capturedOptions,
      designation
    });
    resources.add(resource.loader);
    return resource.loader;
  }
  async function createSession(options) {
    if (pendingDisposals.size > 0)
      throw new NativeCliHostError('Native host session cleanup is incomplete; retry disposal before constructing another session');
    const {
      sessionManager: manager,
      ...sessionOptions
    } = options;
    if (!resources.has(sessionOptions.resourceLoader))
      throw new NativeCliHostError('Session resources were not constructed by this native CLI host');
    const resource = readHostResource(sessionOptions.resourceLoader);
    return await factory.createFromManager({
      manager,
      options: {
        ...sessionOptions,
        resourceInputBinding: resource.policyInput
          .nativeBinding
      },
    });
  }
  async function disposeSession(session) {
    const record = sessions.get(session);
    if (!record) throw new NativeCliHostError('Session was not constructed by this native CLI host');
    if (record.completed) return;
    const transition = record.retired ? undefined : factory.lifecycle
      .beginRetirement(record.lease);
    record.retired = true;
    pendingDisposals.add(record);
    try {
      await session.abort();
      session.dispose();
      if (!readSessionDisposalState(session)
        .completed)
        throw new NativeCliHostError('Native session disposal did not complete; retry cleanup');
      await session.agent
        .waitForIdle();
      record.runtime
        .detach();
      await record.resource
        .owner
        .drain(record.resource
          .loader);
      if (transition) factory.lifecycle
        .completeRetirement(transition);
      record.completed = true;
      pendingDisposals.delete(record);
    } catch (error) {
      if (transition) factory.lifecycle
        .retireFailed(transition);
      throw error;
    }
  }
  return Object.freeze({
    managers,
    createResourceLoader,
    reloadResource: reloadHostResource,
    createSession,
    disposeSession,
    lifecycle: factory.lifecycle
  });
}

//endregion
