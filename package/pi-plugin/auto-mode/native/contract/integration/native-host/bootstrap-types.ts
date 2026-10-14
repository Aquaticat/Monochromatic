/**
 Session registration borrows native ownership records without reconstructing them.

 @module
 */
import type {
  AgentSession,
  ExtensionAPI,
  SessionManager
} from '@earendil-works/pi-coding-agent';

/**
 Only accessed SDK fields receive concrete types; native ownership objects stay opaque here.
 */
export type NativeHostSessionInput = {
  /**
   Original constructor-owned session and manager pair.
   */
  readonly root: {
    readonly session: AgentSession;
    readonly manager: SessionManager;
  };
  /**
   Existing native runtime authenticates and consumes this original lifecycle owner.
   */
  readonly lifecycle: unknown;
  /**
   Resource owner retains the policy binding and latest native approval API.
   */
  readonly resource: {
    readonly policyInput: unknown;
    readonly nativeApi: { readonly current: ExtensionAPI | undefined };
  };
  /**
   Original constructor options retain the dependency working directory.
   */
  readonly options: { readonly cwd: string };
};
