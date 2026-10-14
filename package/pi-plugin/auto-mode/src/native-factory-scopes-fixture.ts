/**
 Disposable construction capabilities expose observable publication and disposal events.

 @module
 */

/**
 Test sessions retain their independently mutable manager identity.
 */
export type FixtureSession = { readonly manager: object };

/**
 Returned results deliberately retain only fields observed by the scope owner.
 */
export type FixtureResult = { readonly session: FixtureSession };

/**
 Construction capability is tested through its built runtime interface.
 */
export type FixtureScope = {
  readonly registerSession: (session: FixtureSession) => void;
  readonly accept: (result: FixtureResult) => FixtureResult;
  readonly publish: (result: FixtureResult) => object;
  readonly abort: () => void;
};

/**
 Original factory controls expose pending cleanup without exposing its internal collection.
 */
export type FixtureScopes = {
  readonly begin: (input: {
    manager: object;
    transition?: object
  }) => FixtureScope;
  readonly retryCleanup: () => void;
  readonly diagnostics: () => { readonly pendingCleanup: number };
};

/**
 Independent JavaScript consumer contract permits malformed bootstrap inputs in tests.
 */
export type ScopeModule = { readonly createRuntimeFactoryScopes: (definition: unknown) => FixtureScopes };

/**
 Disposable callbacks remain mutable so tests can replace caller-owned option properties.
 */
type ScopeFixture = {
  readonly manager: object;
  readonly control: {
    failDisposal: boolean;
    disposeCalls: number;
    beforeRead?: () => void
  };
  readonly events: string[];
  readonly definition: {
    lifecycle: {
      beginConstruction: () => object;
      bindConstruction: (input: {
        readonly construction: object;
        readonly session: FixtureSession
      }) => void;
      publishConstruction: (construction: object) => object;
      abandonConstruction: (construction: object) => { readonly session?: FixtureSession };
    };
    readManager: (session: FixtureSession) => object;
    prepareResult: (result: FixtureResult) => FixtureResult;
    assertRuntimeResult: (result: FixtureResult) => void;
    disposeSession: (session: FixtureSession) => void;
  };
};

/**
 Require the actual built entry before exercising the runtime boundary.

 @param value - independently imported native artifact

 @returns assertion exposing the independent consumer interface
 
 @throws Error when construction ownership was omitted from the build

 @example
 ```ts
 assertScopeModule(built);
 ```
 */
export function assertScopeModule(value: unknown): asserts value is ScopeModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createRuntimeFactoryScopes' in value))
    || ((typeof value.createRuntimeFactoryScopes) !== 'function'))
    throw new Error('Built runtime factory scope owner is unavailable');
}

/**
 Create local lifecycle capabilities with independently observable native effects.

 @returns disposable manager, original callbacks, and lifecycle observations

 @example
 ```ts
 const fixture = createScopeFixture();
 ```
 */
export function createScopeFixture(): ScopeFixture {
  /**
   Every test starts with a distinct manager identity.
   */
  const manager = {};
  /**
   Registration associates sessions with independently created lifecycle tokens.
   */
  const sessions = new Map<object, FixtureSession>();
  /**
   Callback state supports deliberate disposal failures and synchronous reentry.
   */
  const control: ScopeFixture['control'] = {
    failDisposal: false,
    disposeCalls: 0,
  };
  /**
   Ordered lifecycle observations survive failures without consulting scope internals.
   */
  const events: string[] = [];
  /**
   Mutable option properties let tests prove construction captured their original values.
   */
  const definition: ScopeFixture['definition'] = {
    lifecycle: {
      beginConstruction() {
        events.push('begin');
        return {};
      },
      bindConstruction({
        construction,
        session
      }: {
        readonly construction: object;
        readonly session: FixtureSession
      }) {
        sessions.set(
          construction,
          session
        );
        events.push('bind');
      },
      publishConstruction(construction: object) {
        events.push('publish');
        return construction;
      },
      abandonConstruction(construction: object) {
        events.push('abandon');
        /**
         Unregistered occurrences have no disposal obligation.
         */
        const session = sessions.get(construction);
        return session === undefined ? {} : { session };
      },
    },
    readManager(session: FixtureSession) {
      control.beforeRead?.();
      return session.manager;
    },
    prepareResult(result: FixtureResult) {
      return Object.freeze({ ...result });
    },
    assertRuntimeResult(result: FixtureResult) {
      if (!Object.isFrozen(result)) throw new Error('Fixture result must be prepared before validation');
    },
    disposeSession(session: FixtureSession) {
      control.disposeCalls += 1;
      if (control.failDisposal) throw new Error('Fixture native disposal failed');
      if (session.manager !== manager) throw new Error('Fixture disposal received another manager');
      events.push('dispose');
    },
  };
  return {
    manager,
    definition,
    control,
    events
  };
}
