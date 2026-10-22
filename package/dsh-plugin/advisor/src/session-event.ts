/**
 Durable `advisor/operation` session records: the DSH form of pi's
 `pi-advisor.operation` failure accounting. @module
 */

import type {
  AdvisorOperationSnapshot,
} from '@monochromatic-dev/agent-harness-shared-advisor/ts';
import type {
  Session,
} from '@deepseek-ai/dsh-session';

declare module '@deepseek-ai/dsh-session/types' {
  /* oxlint-disable typescript/consistent-type-definitions -- declaration merging on the dsh-session SessionEventMap interface is the sanctioned way to extend the session event union, so this augmentation must stay an interface */
  /**
   Session event map extension declaring the durable `advisor/operation`
   record kind for the dsh-session append API.
   */
  interface SessionEventMap {
    /**
     Operation ledger snapshot recorded when an Advisor operation fails, so
     attempt states and usage survive the thrown tool or command error.
     */
    'advisor/operation': AdvisorOperationSnapshot;
  }
  /* oxlint-enable typescript/consistent-type-definitions */
}

//region Public API

/**
 Persist one failed Advisor operation to the session log.

 The agent lifecycle attaches the session-log writer, so this append is
 durable exactly like agent-loop events. Successful operations carry their
 ledger in the canonical tool JSON value instead.

 @param session - session log receiving the durable record

 @param operation - failed operation ledger snapshot

 @example
 ```ts
 appendAdvisorOperationRecord({ session: exec.agent.session, operation: error.operation });
 ```
 */
export function appendAdvisorOperationRecord(
  {
    session,
    operation,
  }: {
    readonly session: Pick<Session, 'append'>;
    readonly operation: AdvisorOperationSnapshot;
  },
): void {
  session
    .append(
    'advisor/operation',
    operation,
    );
}

//endregion Public API
