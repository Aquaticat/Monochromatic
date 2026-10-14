/**
 Consumer declarations for the existing native CLI ownership implementation.

 @module
 */
import type {
  AgentSession,
  CreateAgentSessionOptions,
  CreateAgentSessionResult,
  DefaultResourceLoader,
  ResourceLoader,
  SessionManager
} from '@earendil-works/pi-coding-agent';
import type { ManagerConstructors } from '../../lifecycle/runtime-custody/manager-types.ts';
import type { NativePolicyRuntime } from '../native-batch/runtime-types.ts';
import type { NativeHostSessionInput, NativePolicyDesignation } from './bootstrap-types.ts';

/**
 Original ownership implementation reports configuration and lifecycle failures.
 */
export class NativeCliHostError extends Error {}

/**
 Fixed native host retains the original manager constructors, resources, and session cleanup.
 */
export type NativeCliHost = {
  /**
   Original SDK static signatures retain their positional calling convention.
   */
  readonly managers: ManagerConstructors & Pick<typeof SessionManager, 'list' | 'listAll' | 'findById'>;
  /**
   Policy designation completes before the original loader is published.
   */
  readonly createResourceLoader: (options: ConstructorParameters<typeof DefaultResourceLoader>[0]) => Promise<ResourceLoader>;
  /**
   Reload uses the same native resource owner and trust resolver.
   */
  readonly reloadResource: (loader: ResourceLoader, options?: Parameters<ResourceLoader['reload']>[0]) => Promise<void>;
  /**
   Construction requires this host's original manager and resource loader.
   */
  readonly createSession: (options: CreateAgentSessionOptions & {
    readonly cwd: string;
    readonly resourceLoader: ResourceLoader;
    readonly sessionManager: SessionManager;
  }) => Promise<CreateAgentSessionResult & {
    readonly root: NativeHostSessionInput['root'];
    readonly lifecycle: unknown;
  }>;
  /**
   Disposal waits for original native completion and resource drainage.
   */
  readonly disposeSession: (session: AgentSession) => Promise<void>;
  /**
   Lifecycle ownership is consumed only by its original native owners.
   */
  readonly lifecycle: unknown;
};

/**
 Bind fixed policy designation and original-session registration before exposing native construction.

 @param designatePolicy - original bootstrap selection for each resource loader

 @param bindSession - original constructor-owned session receives its native runtime

 @returns host retaining original manager, resource, and session ownership

 @throws NativeCliHostError when required bootstrap callbacks are absent
 */
export function createNativeCliHost(input: {
  readonly designatePolicy: (options: ConstructorParameters<typeof DefaultResourceLoader>[0]) => Promise<NativePolicyDesignation>;
  readonly bindSession: (input: NativeHostSessionInput) => NativePolicyRuntime;
}): NativeCliHost;
