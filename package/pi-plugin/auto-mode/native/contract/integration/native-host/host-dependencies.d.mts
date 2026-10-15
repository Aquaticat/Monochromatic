/**
 Consumer signatures describe the original native factory without replacing its ownership checks.

 @module
 */
import type {
  SessionManager,
  AgentSession
} from '@earendil-works/pi-coding-agent';
import type { RootSessionSdkFactory } from '../native-batch/session-root-types.ts';

export { SessionManager } from '@earendil-works/pi-coding-agent';

export { createRootSessionFactory } from '../native-batch/session-root.ts';

/** Original generated SDK construction retains its private owner-scope input. */
export declare const createAgentSession: RootSessionSdkFactory;
/** Original manager reader returns only its native occurrence. */
export declare const readRootOccurrence: (manager: SessionManager) => object;
/** Original session reader retains native private-field authentication. */
export declare const readActiveSessionManager: (session: AgentSession) => SessionManager;
