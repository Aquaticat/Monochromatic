/**
 Approval host construction for the native decision fallback catalog.

 Scoped confirmation keeps the original SDK dialog callback identities while
 headless, cancel, and abort modes retain their exact behavior. @module
 */
import assert from 'node:assert/strict';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { MaintainedPolicyEntries } from './native-decision-fallback-harness.ts';
import { replaceFixturePolicyWithProhibition } from './native-decision-fallback-state.ts';
import type {
  DecisionFallbackApprovalHost,
  DecisionFallbackNotificationReceipt,
  DecisionFallbackObservations,
  DecisionFallbackPlan,
  DecisionFallbackState,
  HarnessEnvironment
} from './native-decision-fallback-types.ts';

//region The approval host assembles the original requester and dialog surface.

/**
 Build the approval host factory consumed by the policy runtime.

 @param plan - mode plan selecting dialog outcome and headless withholding

 @param state - live fixture state owning abort and captured SDK capability

 @param session - original session aborted by cancel and abort modes

 @param maintained - release-bound requester identity and verdict discriminator

 @param observations - counters asserted at dialog time

 @param commands - proposed commands appearing in the dialog title

 @param environment - built environment owning the fixture workspace

 @returns approval host factory returning one host per approval round
 */
export function createDecisionFallbackApprovalHostFactory({ plan, state, session, maintained, observations, commands, environment }: Readonly<{
  plan: DecisionFallbackPlan;
  state: DecisionFallbackState;
  session: AgentSession;
  maintained: MaintainedPolicyEntries;
  observations: DecisionFallbackObservations;
  commands: readonly string[];
  environment: HarnessEnvironment;
}>): () => DecisionFallbackApprovalHost {
  return function fixtureApprovalHost(): DecisionFallbackApprovalHost {
    return {
      pi: nonNullishOrThrow(state.pi),
      askUser: maintained.askUser,
      verdictEntryType: maintained.VERDICT_ENTRY_TYPE,
      trace: function traceHostEvent(): void {
        return undefined;
      },
      notificationInvoker: async function ignoreNotification(): Promise<DecisionFallbackNotificationReceipt> {
        return {
          exitCode: 0,
          stdout: '',
          stderr: ''
        };
      },
      ctx: {
        hasUI: plan.mode !== 'headless',
        abort(): void {
          state.abortTask = session.abort();
        },
        ui: {
          async select(title: string, options: string[]): Promise<string | undefined> {
            observations.selections++;
            assert.equal(
              observations.attempts,
              plan.expectedAttempts,
              'Dialog must follow the available automatic path'
            );
            assert.deepEqual(
              options,
              ['Allow', 'Stop']
            );
            for (const command of commands)
              assert.ok(title.includes(command));
            if (plan.mode === 'cancel') {
              state.abortTask = session.abort();
              return undefined;
            }
            if (plan.mode === 'allow-stale')
              await replaceFixturePolicyWithProhibition({ cwd: environment.options.cwd });
            if (plan.mode === 'allow-abort')
              state.abortTask = session.abort();
            return plan.mode === 'stop' ? 'Stop' : 'Allow';
          }
        }
      }
    };
  };
}

//endregion
