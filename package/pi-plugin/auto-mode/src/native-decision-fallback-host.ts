/**
 Approval host construction for the native decision fallback catalog.

 Scoped confirmation keeps the original SDK dialog callback identities while
 headless, cancel, and abort modes retain their exact behavior. @module
 */
import assert from 'node:assert/strict';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type {
  AgentSession,
  ExtensionUIContext
} from '@earendil-works/pi-coding-agent';
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

//region Shared host callbacks stay outside the host factory scope.

/**
 Host trace stub keeps runtime approval diagnostics quiet in the fixture.
 */
function traceHostEvent(): void {
  return undefined;
}

/**
 Notification runner replaces the host terminal utility deterministically.

 @returns settled notification receipt without host subprocess activity
 */
function ignoreNotification(): Promise<DecisionFallbackNotificationReceipt> {
  return Promise.resolve({
    exitCode: 0,
    stdout: '',
    stderr: ''
  });
}

//endregion

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

 @example
 ```ts
 const approvalHost = createDecisionFallbackApprovalHostFactory({
   plan,
   state,
   session,
   maintained,
   observations,
   commands,
   environment
 });
 ```
 */
export function createDecisionFallbackApprovalHostFactory({
  plan,
  state,
  session,
  maintained,
  observations,
  commands,
  environment
}: Readonly<{
  plan: DecisionFallbackPlan;
  state: DecisionFallbackState;
  session: AgentSession;
  maintained: MaintainedPolicyEntries;
  observations: DecisionFallbackObservations;
  commands: readonly string[];
  environment: HarnessEnvironment;
}>): () => DecisionFallbackApprovalHost {
  /**
   Workspace cwd drives the allow-stale policy replacement.
   */
  const { cwd } = environment.options;
  /**
   Each approval round assembles one host from the live fixture state.

   @returns approval host carrying the original requester and dialog surface
   */
  function fixtureApprovalHost(): DecisionFallbackApprovalHost {
    return {
      pi: nonNullishOrThrow(state.pi),
      askUser: maintained.askUser,
      verdictEntryType: maintained.VERDICT_ENTRY_TYPE,
      trace: traceHostEvent,
      notificationInvoker: ignoreNotification,
      ctx: {
        hasUI: plan.mode !== 'headless',
        abort(): void {
          state.abortTask = session.abort();
        },
        ui: {
          async select(
            title,
            options
          ): ReturnType<ExtensionUIContext['select']> {
            observations.selections++;
            assert.equal(
              observations.attempts,
              plan.startupFailure ? 0 : 2,
              'Dialog must follow the available automatic path'
            );
            assert.deepEqual(
              options,
              [
                'Allow',
                'Stop'
              ]
            );
            for (const command of commands)
              assert.ok(title.includes(command));
            if (plan.mode === 'cancel') {
              state.abortTask = session.abort();
              return undefined;
            }
            if (plan.mode === 'allow-stale')
              await replaceFixturePolicyWithProhibition({ cwd });
            if (plan.mode === 'allow-abort')
              state.abortTask = session.abort();
            return plan.mode === 'stop' ? 'Stop' : 'Allow';
          }
        }
      }
    };
  }
  return fixtureApprovalHost;
}

//endregion
