/**
 Session registration borrows native ownership records without reconstructing them.

 @module
 */
import type {
  AgentSession,
  ExtensionAPI,
  SessionManager
} from '@earendil-works/pi-coding-agent';
import type {RelevanceCacheInput} from '../../lifecycle/rule-relevance-cache/cache-types.ts';

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
    readonly nativeApi: { readonly current?: ExtensionAPI };
  };
  /**
   Original constructor options retain the dependency working directory.
   */
  readonly options: { readonly cwd: string };
};

/**
 Native policy loading retains the designated file and its original authority scope.
 */
export type NativePolicyDesignation = {
  /**
   Existing loader verifies original path, file mode, and source content.
   */
  readonly policy: {
    readonly root: string;
    readonly relativePath: string;
    readonly requiredMode: number;
    /**
     Startup and reload classify changed policy rules through the existing cache owner.
     */
    readonly relevance?:Omit<RelevanceCacheInput,'selection'>;
  };
  /**
   Designation supplies source authority separately from semantic interpretation.
   */
  readonly authority: {
    readonly tier: 'user';
    readonly scope: 'original-request';
  };
};
