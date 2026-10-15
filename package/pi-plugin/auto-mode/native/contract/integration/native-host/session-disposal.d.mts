/**
 Original private-state reader reports native terminal disposal completion.

 @module
 */
import type { AgentSession } from '@earendil-works/pi-coding-agent';

/**
 Native runtime consumes the original generated function without changing its identity.
 */
export declare const readSessionDisposalState: (session: AgentSession) => { readonly completed: boolean };
