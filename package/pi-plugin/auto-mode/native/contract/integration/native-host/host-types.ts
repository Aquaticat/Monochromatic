/**
 Native host construction and cleanup expose only their existing original capabilities.

 @module
 */
import type {
  AgentSession,
  CreateAgentSessionOptions,
  CreateAgentSessionResult,
  ResourceLoader,
  SessionManager
} from '@earendil-works/pi-coding-agent';
import type { ManagerConstructors } from '../../lifecycle/runtime-custody/manager-types.ts';
import type {
  NativeHostSessionInput,
  NativePolicyDesignation
} from './bootstrap-types.ts';
import type { NativePolicyRuntime } from '../native-batch/runtime-types.ts';
import type {
  NativeCliResource,
  NativeResourceOptions
} from './resource-construction-types.ts';
import type { reloadHostResource } from './resource-reload.ts';

/**
 Original lifecycle tokens stay opaque; the incumbent owner authenticates their identities.
 */
export type NativeHostLifecycle = {
  readonly capture: (root: NativeHostSessionInput['root']) => object;
  readonly assertActive: (lease: object) => void;
  readonly beginRetirement: (lease: object) => object;
  readonly completeRetirement: (transition: object) => void;
  readonly retireFailed: (transition: object) => void;
};

/**
 Native services require their original working directory, loader, and selected manager.
 */
export type NativeHostSessionOptions = CreateAgentSessionOptions & {
  readonly cwd: string;
  readonly resourceLoader: ResourceLoader;
  readonly sessionManager: SessionManager;
};

/**
 The native factory receives the manager separately and retains the original resource binding.
 */
export type NativeHostConstructionOptions = Omit<NativeHostSessionOptions, 'sessionManager'> & {
  readonly resourceInputBinding?: object;
};

/**
 Registration observes the original SDK constructor before root publication.
 */
export type NativeHostRegistration = {
  readonly session: AgentSession;
  readonly manager: SessionManager;
  readonly lifecycle: NativeHostLifecycle;
  readonly options: NativeHostConstructionOptions;
};

/**
 The original SDK result retains every public result field alongside its ownership handles.
 */
export type NativeHostCreatedSession = CreateAgentSessionResult & {
  readonly root: NativeHostSessionInput['root'];
  readonly lifecycle: NativeHostLifecycle;
};

/**
 Only the original session factory constructs and publishes owned native sessions.
 */
export type NativeHostSessionFactory = {
  readonly managers: ManagerConstructors;
  readonly lifecycle: NativeHostLifecycle;
  readonly createFromManager: (input: {
    readonly manager: SessionManager;
    readonly options: NativeHostConstructionOptions;
  }) => Promise<NativeHostCreatedSession>;
};

/**
 Bootstrap fixes resource designation and completed-session detachment before construction.
 */
export type NativeHostDefinition = {
  readonly designatePolicy: (options: NativeResourceOptions) => Promise<NativePolicyDesignation>;
  readonly bindSession: (input: NativeHostSessionInput) => Pick<NativePolicyRuntime, 'detach'>;
};

/**
 Mutable disposal progress belongs exclusively to the host's private session registry.
 */
export type NativeHostSessionRecord = {
  readonly root: NativeHostSessionInput['root'];
  readonly lease: object;
  readonly resource: NativeCliResource;
  readonly runtime: Pick<NativePolicyRuntime, 'detach'>;
  retired: boolean;
  completed: boolean;
};

/**
 Public host methods retain the original SDK signatures and owned cleanup lifecycle.
 */
export type NativeCliHost = {
  readonly managers: ManagerConstructors & Pick<typeof SessionManager, 'list' | 'listAll' | 'findById'>;
  readonly createResourceLoader: (options: NativeResourceOptions) => Promise<ResourceLoader>;
  readonly reloadResource: typeof reloadHostResource;
  readonly createSession: (options: NativeHostSessionOptions) => Promise<NativeHostCreatedSession>;
  readonly disposeSession: (session: AgentSession) => Promise<void>;
  readonly lifecycle: NativeHostLifecycle;
};
