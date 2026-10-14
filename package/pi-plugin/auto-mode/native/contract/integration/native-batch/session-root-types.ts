/**
 Original SDK construction retains native session and manager identities across publication.

 @module
 */
import type {
  AgentSession,
  CreateAgentSessionOptions,
  CreateAgentSessionResult,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type {
  ManagerConstructorInput,
  ManagerConstructors
} from '../../lifecycle/runtime-custody/manager-types.ts';
import type { NativeHostLifecycle } from '../native-host/host-types.ts';

/**
 Original SDK options leave manager selection to the construction owner.
 */
export type RootSessionOptions = Omit<CreateAgentSessionOptions, 'sessionManager'>;

/**
 Private construction callbacks are added by the maintained SDK transformation.
 */
export type RootSessionSdkInput = CreateAgentSessionOptions & {
  readonly ownerFactoryScope: { readonly registerSession: (session: AgentSession) => void };
};

/**
 Original generated SDK factory retains its complete public result.
 */
export type RootSessionSdkFactory = (input: RootSessionSdkInput) => Promise<CreateAgentSessionResult>;

/**
 Construction operations share the incumbent lifecycle's opaque tokens.
 */
export type RootSessionLifecycle = NativeHostLifecycle & {
  readonly beginConstruction: (input: {
    readonly manager: SessionManager;
    readonly transition?: object
  }) => object;
  readonly bindConstruction: (input: {
    readonly construction: object;
    readonly session: AgentSession
  }) => void;
  readonly publishConstruction: (construction: object) => object;
  readonly abandonConstruction: (construction: object) => { readonly session?: AgentSession };
};

/**
 Original root identity is published alongside the unchanged SDK result fields.
 */
export type RootSessionResult = Readonly<CreateAgentSessionResult> & {
  readonly root: {
    readonly session: AgentSession;
    readonly manager: SessionManager
  };
  readonly lifecycle: RootSessionLifecycle;
};

/**
 Registration observes the original constructor before result publication.
 */
export type RootSessionRegistration<Options extends RootSessionOptions> = {
  readonly session: AgentSession;
  readonly manager: SessionManager;
  readonly lifecycle: RootSessionLifecycle;
  readonly options: Options;
};

/**
 Bootstrap fixes constructor capabilities and native private-state readers.
 */
export type RootSessionDefinition<Options extends RootSessionOptions> = {
  readonly createAgentSession: RootSessionSdkFactory;
  readonly SessionManager: ManagerConstructorInput;
  readonly readActiveSessionManager: (session: AgentSession) => SessionManager;
  readonly readRootOccurrence: (manager: SessionManager) => object;
  readonly readSessionDisposalState: (session: AgentSession) => { readonly completed: boolean };
  readonly onSessionRegistered?: (input: RootSessionRegistration<Options>) => void;
};

/**
 One factory owns construction, publication, and retryable failed cleanup.
 */
export type RootSessionFactory<Options extends RootSessionOptions> = {
  readonly create: (input: {
    readonly options: Options;
    readonly createManager?: (constructors: ManagerConstructors) => SessionManager;
  }) => Promise<RootSessionResult>;
  readonly createFromManager: (input: {
    readonly options: Options;
    readonly manager: SessionManager;
  }) => Promise<RootSessionResult>;
  readonly managers: ManagerConstructors;
  readonly lifecycle: RootSessionLifecycle;
  readonly retryCleanup: () => void;
  readonly diagnostics: () => { readonly pendingCleanup: number };
};

/**
 Scope publication accepts only the exact prepared result from its original constructor.
 */
export type RootSessionScope = {
  readonly registerSession: (session: AgentSession) => void;
  readonly accept: (result: CreateAgentSessionResult) => Readonly<CreateAgentSessionResult>;
  readonly publish: (result: Readonly<CreateAgentSessionResult>) => object;
  readonly abort: () => void;
};
