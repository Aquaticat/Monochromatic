/**
 One construction owns registration, exact-result publication, and retryable disposal.

 @module
 */
import type {
  AgentSession,
  CreateAgentSessionResult
} from '@earendil-works/pi-coding-agent';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { RootSessionScope } from '../../integration/native-batch/session-root-types.ts';
import { RuntimeOperationError } from './error.mjs';
import type {
  FactoryExclusive,
  FactoryScopeDefinition,
  FactoryScopeInput
} from './types.ts';

/**
 Construction events omit native capabilities and result contents.
 */
const l = tagged({ tag: 'auto-mode-factory-construction' });

//region A construction occurrence preserves its original lifecycle token through cleanup

/**
 Bind one construction to the factory's synchronous exclusion and pending cleanup owner.

 @param definition - original native readers, validators, and lifecycle
 
 @param input - original manager and optional replacement transition
 
 @param pendingCleanup - retained obligations that block subsequent construction
 
 @param exclusive - factory-wide synchronous reentrancy guard
 
 @returns original registration and publication capability
 
 @throws RuntimeOperationError when construction identity or phase is invalid

 @example
 ```ts
 const scope = createConstructionScope({ definition, input, pendingCleanup, exclusive });
 scope.registerSession(session);
 ```
 */
export function createConstructionScope({
  definition,
  input,
  pendingCleanup,
  exclusive
}: {
  readonly definition: FactoryScopeDefinition;
  readonly input: FactoryScopeInput;
  readonly pendingCleanup: Set<() => void>;
  readonly exclusive: FactoryExclusive;
}): RootSessionScope {
  /**
   Lifecycle remains the sole issuer of construction identity.
   */
  const {
    manager,
    transition
  } = input;
  /**
   Caller-owned input containers do not remain authoritative after construction begins.
   */
  const token = definition.lifecycle
    .beginConstruction({
      manager,
      ...(transition === undefined ? {} : { transition })
    });
  /**
   Mutable progress records effects without replacing lifecycle identity.
   */
  const progress: {
    disposed: boolean;
    phase: 'open' | 'published' | 'abandoned';
    prepared?: Readonly<CreateAgentSessionResult>;
    registered?: AgentSession;
  } = {
    disposed: false,
    phase: 'open'
  };
  /**
   Messages identify this construction operation without exposing native objects.
   */
  const fl = tagged({
    tag: createConstructionScope.name,
    l
  });

  /**
   Reject registration or publication after abandonment or publication.
   */
  function assertOpen(): void {
    if (progress.phase !== 'open')
      throw new RuntimeOperationError('Factory scope is no longer preparing');
  }

  /**
   Bind the original session before accepting any returned result.

   @param session - original SDK construction callback value
   */
  function registerSession(session: AgentSession): void {
    assertOpen();
    if (progress.registered !== undefined)
      throw new RuntimeOperationError('Factory scope already registered its session');
    definition.lifecycle
      .bindConstruction({
        construction: token,
        session
      });
    progress.registered = session;
    tagged({
      tag: registerSession.name,
      l: fl
    })
      .debug('registered original construction session');
  }

  /**
   Preserve the validator's exact prepared result for later publication.

   @param result - original SDK result requiring descriptor validation
   
   @returns exact prepared result retained for publication
   */
  function accept(result: CreateAgentSessionResult): Readonly<CreateAgentSessionResult> {
    assertOpen();
    if (progress.prepared !== undefined)
      throw new RuntimeOperationError('Factory scope result was already accepted');
    /**
     SDK-owned preparation reads and validates the original result descriptors.
     */
    const value = definition.prepareResult(result);
    if ((progress.registered === undefined) || (value.session !== progress.registered))
      throw new RuntimeOperationError('Factory result is not the exact session registered by this construction');
    if (definition.readManager(value.session) !== manager)
      throw new RuntimeOperationError('Factory result session has another manager');
    definition.assertRuntimeResult(value);
    progress.prepared = value;
    tagged({
      tag: accept.name,
      l: fl
    })
      .debug('accepted original registered construction result');
    return value;
  }

  /**
   Publish only the original accepted result while its native manager still matches.

   @param result - exact previously accepted result
   
   @returns original lifecycle publication lease
   */
  function publish(result: Readonly<CreateAgentSessionResult>): object {
    assertOpen();
    /**
     Local capture keeps exact-result identity stable through validation callbacks.
     */
    const {prepared} = progress;
    if ((prepared === undefined) || (result !== prepared))
      throw new RuntimeOperationError('Publication requires this factory scope\'s exact prepared result');
    definition.assertRuntimeResult(prepared);
    if (definition.readManager(prepared.session) !== manager)
      throw new RuntimeOperationError('Prepared factory session changed its manager');
    /**
     Publication is irreversible once the incumbent lifecycle returns its lease.
     */
    const lease = definition.lifecycle
      .publishConstruction(token);
    progress.phase = 'published';
    tagged({
      tag: publish.name,
      l: fl
    })
      .debug('published original construction result');
    return lease;
  }

  /**
   Keep failed disposal pending until the native disposal callback actually completes.
   */
  function cleanup(): void {
    /**
     Early liveness retirement does not prove that native disposal completed.
     */
    const obligation = definition.lifecycle
      .abandonConstruction(token);
    if ((obligation.session !== undefined) && (!progress.disposed)) {
      definition.disposeSession(obligation.session);
      progress.disposed = true;
    }
    pendingCleanup.delete(cleanup);
    tagged({
      tag: cleanup.name,
      l: fl
    })
      .debug('completed abandoned construction cleanup');
  }

  /**
   Retain cleanup before attempting native disposal so thrown failures remain retryable.
   */
  function abort(): void {
    if (progress.phase === 'published')
      throw new RuntimeOperationError('Applied factory scope cannot be abandoned');
    progress.phase = 'abandoned';
    pendingCleanup.add(cleanup);
    cleanup();
  }
  return Object.freeze({
    /**
     {@inheritDoc registerSession}
     */
    registerSession(session: AgentSession): void {
      exclusive(function registerConstructedSession(): void {
        registerSession(session);
      });
    },
    /**
     {@inheritDoc accept}
     */
    accept(result: CreateAgentSessionResult): Readonly<CreateAgentSessionResult> {
      return exclusive(function acceptConstructedResult() {
        return accept(result);
      });
    },
    /**
     {@inheritDoc publish}
     */
    publish(result: Readonly<CreateAgentSessionResult>): object {
      return exclusive(function publishConstructedResult() {
        return publish(result);
      });
    },
    /**
     {@inheritDoc abort}
     */
    abort(): void { exclusive(abort); },
  });
}

//endregion A construction occurrence preserves its original lifecycle token through cleanup
