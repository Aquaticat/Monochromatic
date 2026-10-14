/**
 Static imports retain native module cycles and original generated constructor identities.
 */
export { createRootSessionFactory } from '../native-batch/session-root.ts';
export { createAgentSession } from '../native-batch/generated/sdk.mjs';
export { SessionManager, readRootOccurrence } from '../native-batch/generated/session-manager.mjs';
export { readActiveSessionManager } from '../native-batch/generated/agent-session.mjs';
