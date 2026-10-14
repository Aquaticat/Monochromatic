/**
 Bind original SDK construction to incumbent manager, root, and cleanup owners.

 @module
 */
import type {
  AgentSession,
  SessionManager
} from '@earendil-works/pi-coding-agent';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { createManagerConstructorOwner } from '../../lifecycle/runtime-custody/manager-owner.ts';
import {
  createNativeManagerRegistry,
  createSessionRootReader,
} from './session-root-dependencies.mjs';
import { createRuntimeFactoryScopes } from '../../lifecycle/runtime-factory-scopes/scopes.ts';
import type {
  RootSessionDefinition,
  RootSessionFactory,
  RootSessionOptions,
  RootSessionRegistration,
  RootSessionResult,
} from './session-root-types.ts';
import { NativeSessionRootError } from './session-root-error.ts';
import { prepareSdkResult } from './session-root-result.ts';

export { NativeSessionRootError } from './session-root-error.ts';

/**
 Construction messages retain their module boundary without serializing native capabilities.
 */
const l = tagged({ tag: 'auto-mode-native-session-root' });

//region The original constructor registers once before exact result publication

/**
 Keep original constructor ownership and retryable cleanup around native SDK construction.

 @param createAgentSession - original SDK constructor retaining private registration

 @param SessionManager - original native constructor capabilities

 @param readActiveSessionManager - native reader authenticating the session-manager pairing

 @param readRootOccurrence - original manager occurrence reader

 @param readSessionDisposalState - native terminal cleanup completion reader

 @param onSessionRegistered - optional observer running before original publication
 
 @returns original manager facade and construction lifecycle
 
 @throws NativeSessionRootError when SDK ownership, result shape, or cleanup requirements fail

 @example
 ```ts
 const factory = createRootSessionFactory(nativeDefinition);
 const result = await factory.create({ options });
 ```
 */
export function createRootSessionFactory<const Options extends RootSessionOptions>({
  createAgentSession,
  SessionManager: nativeManager,
  readActiveSessionManager,
  readRootOccurrence,
  readSessionDisposalState,
  onSessionRegistered,
}: RootSessionDefinition<Options>): RootSessionFactory<Options> {
  /**
   Nested construction callbacks retain this factory's diagnostic context.
   */
  const fl = tagged({
    tag: createRootSessionFactory.name,
    l
  });
  if ((onSessionRegistered !== undefined) && ((typeof onSessionRegistered) !== 'function'))
    throw new NativeSessionRootError('Session registration observer must be fixed by the original bootstrap');
  /**
   Manager membership remains with the incumbent original-constructor owner.
   */
  const owner = createManagerConstructorOwner(nativeManager);
  /**
   Only the original SDK callback can register a session-manager pairing.
   */
  const sessions = new WeakMap<AgentSession, SessionManager>();
  /**
   Registry accounting tracks original construction ownership independently of policy.
   */
  const accounting = {
    registryRequests: 0,
    returnedRegistries: 0,
    canonicalManagerStatesCreated: 0,
    reusedCanonicalStateBinds: 0,
  };
  fl.debug('binding original manager registry and construction scopes');
  /**
   Registry publication retains its existing lifecycle token issuer.
   */
  const { lifecycle } = createNativeManagerRegistry({
    owner,
    sessionOwner: {
      /**
       Require this factory's original constructor registration for the exact pairing.
       */
      assertOwned({
        session,
        manager
      }: Pick<RootSessionRegistration<Options>, 'session' | 'manager'>): void {
        if (sessions.get(session) !== manager)
          throw new NativeSessionRootError('Session was not emitted by this original SDK construction');
      },
    },
    readRootOccurrence: createSessionRootReader({
      readActiveSessionManager,
      readManagerOccurrence: readRootOccurrence
    }),
    /**
     Incumbent lifecycle events are diagnostic and never create authority.
     */
    trace: function trace(event): void {
      /**
       Trace output carries the original factory's context without native object values.
       */
      const tl = tagged({
        tag: trace.name,
        l: fl
      });
      tl.debug(event);
    },
    accounting,
  });
  /**
   Construction scopes own exact-result publication and abandoned-session cleanup.
   */
  const scopes = createRuntimeFactoryScopes({
    lifecycle,
    readManager: readActiveSessionManager,
    prepareResult: prepareSdkResult,
    /**
     Original private-state reading authenticates the returned session before publication.
     */
    assertRuntimeResult(result): void {
      readActiveSessionManager(result.session);
    },
    /**
     Failed construction requires actual native cleanup completion before reuse.
     */
    disposeSession: function disposeSession(session): void {
      /**
       Abandoned cleanup retains a distinct diagnostic boundary.
       */
      const dl = tagged({
        tag: disposeSession.name,
        l: fl
      });
      dl.debug('disposing abandoned original SDK session');
      session.dispose();
      /**
       Untyped runtime callers must report literal completion, not merely a truthy value.
       */
      const completed: unknown = readSessionDisposalState(session)
        .completed;
      if (completed !== true)
        throw new NativeSessionRootError('Original SDK disposal did not complete; retry owned construction cleanup');
    },
  });

  /**
   Publish the exact prepared SDK result only after original registration and validation.

   @param options - SDK configuration excluding caller-selected construction ownership
   
   @param manager - original manager emitted by this factory's constructor facade
   
   @returns original SDK result with its root and lifecycle
   
   @throws NativeSessionRootError when cleanup, registration, or caller ownership is invalid
   
   @throws AggregateError when construction and original cleanup both fail
   */
  async function createFromManager({
    options,
    manager
  }: {
    readonly options: Options;
    readonly manager: SessionManager;
  }): Promise<RootSessionResult> {
    /**
     Failure and cleanup messages identify the original construction boundary.
     */
    const cl = tagged({
      tag: createFromManager.name,
      l: fl
    });
    if (scopes.diagnostics()
      .pendingCleanup
      > 0)
      throw new NativeSessionRootError('Native construction cleanup is pending; retry it before creating another session');
    if ((Reflect.get(
      options,
      'sessionManager'
    ) !== undefined) || (Reflect.get(
      options,
      'ownerFactoryScope'
    ) !== undefined))
      throw new NativeSessionRootError('Session and construction ownership are selected through this factory, not SDK option overrides');
    owner.assertOwned(manager);
    /**
     Reservation must exist before the SDK can emit its original session callback.
     */
    const scope = scopes.begin({ manager });
    /**
     This occurrence tracks registration progress without duplicating identity ownership.
     */
    const progress = { registered: false };
    cl.debug('starting original SDK construction');
    try {
      /**
       The original SDK receives only the owned manager and registration capability.
       */
      const result = await createAgentSession({
        ...options,
        sessionManager: manager,
        ownerFactoryScope: {
          /**
           Register the original session before any observer or returned result can publish it.
           */
          registerSession: function registerSession(session): void {
            /**
             Registration diagnostics identify the original constructor occurrence.
             */
            const rl = tagged({
              tag: registerSession.name,
              l: cl
            });
            if (progress.registered)
              throw new NativeSessionRootError('SDK construction emitted more than one original session');
            if (sessions.has(session))
              throw new NativeSessionRootError('SDK construction cannot reuse a session already owned by this factory');
            sessions.set(
              session,
              manager
            );
            scope.registerSession(session);
            progress.registered = true;
            rl.debug('registered original SDK session with its constructor scope');
            onSessionRegistered?.({
              session,
              manager,
              lifecycle,
              options
            });
          },
        },
      });
      /**
       Scope acceptance authenticates the exact registered original session.
       */
      const prepared = scope.accept(result);
      /**
       The root pairs original objects without copying their capabilities.
       */
      const root = Object.freeze({
        session: prepared.session,
        manager
      });
      /**
       Allocate the complete return object before the non-fallible publication tail.
       */
      const published = Object.freeze({
        ...prepared,
        root,
        lifecycle
      });
      cl.debug('publishing prepared original SDK result');
      scope.publish(prepared);
      return published;
    } catch (error) {
      cl.debug('original construction failed; retaining its thrown value through cleanup');
      /**
       Keep exact thrown values, including undefined, for rethrow or aggregate reporting.
       */
      const failures = [error];
      try {
        scope.abort();
      } catch (cleanupError) {
        cl.debug('abandoned construction cleanup failed; retaining both original failures');
        failures.push(cleanupError);
      }
      if (failures.length > 1)
        throw new AggregateError(
          failures,
          'Native session construction and cleanup failed',
          { cause: error }
        );
      throw error;
    }
  }

  /**
   Select an original manager through the owned constructor facade before native construction.

   @param options - original SDK configuration used by the selected manager
   
   @param createManager - optional original constructor selection for persisted sessions
   
   @returns published original SDK result and root
   
   @throws NativeSessionRootError when original construction ownership or cleanup fails
   */
  async function create({
    options,
    createManager
  }: Parameters<RootSessionFactory<Options>['create']>[0]): Promise<RootSessionResult> {
    /**
     Manager selection shares the factory boundary while retaining its own function tag.
     */
    const cl = tagged({
      tag: create.name,
      l: fl
    });
    cl.debug('selecting original manager for SDK construction');
    /**
     A supplied constructor selector remains responsible for its original manager result.
     */
    const manager = createManager === undefined ? owner.managers
      .inMemory(options.cwd) : createManager(owner.managers);
    return await createFromManager({
      options,
      manager
    });
  }
  return Object.freeze({
    create,
    createFromManager,
    managers: owner.managers,
    lifecycle,
    retryCleanup: scopes.retryCleanup,
    diagnostics: scopes.diagnostics,
  });
}

//endregion The original constructor registers once before exact result publication
