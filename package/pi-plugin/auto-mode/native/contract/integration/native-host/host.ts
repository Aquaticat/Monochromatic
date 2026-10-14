/**
 One native host owns original resources, session construction, and terminal cleanup.

 @module
 */
import type {
  AgentSession,
  ResourceLoader
} from '@earendil-works/pi-coding-agent';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  createRootSessionFactory,
  createAgentSession,
  SessionManager,
  readRootOccurrence,
  readActiveSessionManager,
} from './host-dependencies.mjs';
import { readSessionDisposalState } from './session-disposal.mjs';
import { createHostResource } from './resources.ts';
import { reloadHostResource } from './resource-reload.ts';
import type {
  NativeCliResource,
  NativeResourceOptions
} from './resource-construction-types.ts';
import type {
  NativeCliHost,
  NativeHostDefinition,
  NativeHostRegistration,
  NativeHostSessionOptions,
  NativeHostCreatedSession,
  NativeHostSessionRecord
} from './host-types.ts';

import { NativeCliHostError } from './host-error.ts';

export { NativeCliHostError } from './host-error.ts';
export type { NativeCliHost } from './host-types.ts';

/**
 Host lifecycle messages never serialize borrowed SDK capabilities.
 */
const l = tagged({tag:'auto-mode-native-cli-host'});

//region One bootstrap owns CLI managers, resources, construction, and terminal cleanup.

/**
 Bind configuration once; SDK callers cannot inject construction owners or policy runtimes.

 @param designatePolicy - original bootstrap selection for each resource loader

 @param bindSession - original constructor-owned session receives its native runtime

 @returns host retaining original manager, resource, and session ownership

 @throws NativeCliHostError when required bootstrap callbacks are absent

 @example
 ```ts
 const host = createNativeCliHost({designatePolicy,bindSession});
 ```
 */
export function createNativeCliHost({
  designatePolicy,
  bindSession
}: NativeHostDefinition): NativeCliHost {
  /**
   Nested lifecycle callbacks retain this host-construction tag.
   */
  const hl = tagged({
    tag:createNativeCliHost.name,
    l
  });
  hl.debug('binding native CLI construction and disposal');
  if (((typeof designatePolicy) !== 'function') || ((typeof bindSession) !== 'function'))
    throw new NativeCliHostError('Native CLI bootstrap requires fixed policy designation and session binding');
  /**
   Only original constructor callbacks publish records into this private registry.
   */
  const sessions = new WeakMap<AgentSession,NativeHostSessionRecord>();
  /**
   Retain the already-created resource record alongside this host's original membership.
   */
  const resources = new WeakMap<ResourceLoader,NativeCliResource>();
  /**
   Failed disposal keeps construction suspended until original cleanup completes.
   */
  const pendingDisposals = new Set<NativeHostSessionRecord>();
  /**
   Observe original SDK construction before the root factory publishes its result.

   @param session - original session emitted by the fixed SDK constructor

   @param manager - original constructor-owned manager selected by native services

   @param lifecycle - incumbent owner of root leases and retirement

   @param options - original session options with this host's resource loader

   @throws NativeCliHostError for foreign resources or a missing detachment capability
   */
  function registerSession({
    session,
    manager,
    lifecycle,
    options
  }: NativeHostRegistration): void {
    /**
     Registration diagnostics identify this boundary without exposing native objects.
     */
    const rl = tagged({
      tag:registerSession.name,
      l:hl
    });
    rl.debug('registering original native session');
    /**
     Membership returns the original record retained at resource construction.
     */
    const resource = resources.get(options.resourceLoader);
    if (resource === undefined)
      throw new NativeCliHostError('Session resources belong to another native CLI host');
    /**
     This owned pair retains exact original session and manager identities.
     */
    const root = Object.freeze({
      session,
      manager
    });
    /**
     The incumbent owner authenticates this pair before issuing a lease.
     */
    const lease = lifecycle.capture(root);
    /**
     Binding installs the original policy runtime during constructor registration.
     */
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
  /**
   Constructor capabilities and private-field readers remain fixed for this host.
   */
  const factory = createRootSessionFactory({
    createAgentSession,
    SessionManager,
    readRootOccurrence,
    readActiveSessionManager,
    readSessionDisposalState,
    onSessionRegistered: registerSession,
  });
  /**
   Native lookup methods retain their original class receiver.
   */
  const managers = Object.freeze({
    ...factory.managers,
    list: SessionManager.list
      .bind(SessionManager),
    listAll: SessionManager.listAll
      .bind(SessionManager),
    findById: SessionManager.findById
      .bind(SessionManager),
  });
  /**
   Capture resource options before asynchronous policy designation.

   @param options - original native loader configuration

   @returns original loader belonging to this host

   @throws original designation or resource-construction failure
   */
  async function createResourceLoader(options: NativeResourceOptions): Promise<ResourceLoader> {
    /**
     Resource construction retains its original host diagnostic scope.
     */
    const rl = tagged({
      tag:createResourceLoader.name,
      l:hl
    });
    rl.debug('constructing original host resource loader');
    /**
     Preserve original outer options while policy designation performs asynchronous file inspection.
     */
    const capturedOptions = {...options};
    /**
     Designation reads the original file before native resource construction.
     */
    const designation = await designatePolicy(capturedOptions);
    /**
     Keep the complete original resource record, including cleanup ownership.
     */
    const resource = createHostResource({
      options: capturedOptions,
      designation
    });
    resources.set(
      resource.loader,
      resource
    );
    return resource.loader;
  }
  /**
   Construct only with this host's original loader and a constructor-owned manager.

   @param options - original native services inputs

   @returns complete SDK result and original lifecycle handles

   @throws NativeCliHostError for pending disposal or foreign resources

   @throws original session-construction failure
   */
  async function createSession(options: NativeHostSessionOptions): Promise<NativeHostCreatedSession> {
    /**
     Session construction retains its own diagnostic boundary.
     */
    const sl = tagged({
      tag:createSession.name,
      l:hl
    });
    sl.debug('constructing original host session');
    if (pendingDisposals.size > 0)
      throw new NativeCliHostError('Native host session cleanup is incomplete; retry disposal before constructing another session');
    /**
     The incumbent factory receives the selected manager separately from SDK options.
     */
    const {
      sessionManager: manager,
      ...sessionOptions
    } = options;
    /**
     Original membership provides the complete resource binding without reconstructing it.
     */
    const resource = resources.get(sessionOptions.resourceLoader);
    if (resource === undefined)
      throw new NativeCliHostError('Session resources were not constructed by this native CLI host');
    return await factory.createFromManager({
      manager,
      options: {
        ...sessionOptions,
        resourceInputBinding: resource.policyInput
          .nativeBinding
      },
    });
  }
  /**
   Retire the root before native cancellation and retain retry state on any cleanup failure.

   @param session - original session previously published by this host

   @throws NativeCliHostError for foreign sessions or incomplete native disposal

   @throws original cancellation, detachment, or resource-drain failure
   */
  async function disposeSession(session: AgentSession): Promise<void> {
    /**
     Terminal cleanup logs decisions without serializing the native session.
     */
    const dl = tagged({
      tag:disposeSession.name,
      l:hl
    });
    dl.debug('disposing original host session');
    /**
     The host retains disposal progress independently of mutable SDK state.
     */
    const record = sessions.get(session);
    if (!record) throw new NativeCliHostError('Session was not constructed by this native CLI host');
    if (record.completed) {
      dl.debug('original host session disposal already completed');
      return;
    }
    /**
     A retry cannot revive the retired root or issue another retirement transition.
     */
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
      dl.debug('original host session and resources disposed');
    } catch (error) {
      dl.debug('original host cleanup failed; retaining disposal retry state');
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
