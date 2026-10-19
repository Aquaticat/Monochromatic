/**
 Model-facing transport for the native phase catalog.

 Assessment wiring, notification delivery, steering, policy replacement, and
 terminal stream replies keep their original timing and embedded programs. @module
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { createAssessmentSender } from './assessment-sender.ts';
import type { DomainFixtureAssessmentSender } from '../dist/native/contract/integration/native-batch/domain-fixture-assessment.mjs';
import type {
  NativePhaseObservations,
  NativePhasePlan,
  NativePhaseState
} from './native-phase-types.ts';
import type { NativePhaseEvents } from './native-phase-callbacks.ts';

/**
 Workspace policy prohibiting the proposed inspection.
 */
const PROHIBITED_POLICY_TEXT = 'RUL:\n The proposed inspection is prohibited.\n';

/**
 Steering text stopping the proposed operation without tool execution.
 */
const STEERING_TEXT = 'Stop the proposed operation. Reply without executing tools.';

/**
 Custom message content signaling authored process completion.
 */
const NOTIFICATION_CONTENT = 'Authored process completion';

/**
 Followup tool-call identifier the notification flow proposes.
 */
const FOLLOWUP_ID = 'phase-3';

/**
 Assessment round at which secondary interventions arrive.
 */
const SECONDARY_ROUND = 2;

/**
 Maintained sender signature shared with the policy runtime contract.
 */
type AssessmentTransport = ReturnType<typeof createAssessmentSender>;

//region The fixture transport reproduces original request timing exactly.

/**
 Build the fixture wire sender and terminal stream replies.

 @param plan - mode plan selecting notification, steering, and policy timing

 @param state - live fixture state retaining notification capture flags

 @param session - original session receiving notifications and steering

 @param cwd - fixture workspace holding the policy file

 @param sendAssessment - authored answer sender from the assessment fixture

 @param observations - counters incremented per assessment round

 @param events - event trace entries recording native call identity

 @returns fixture wire sender and terminal fetch for the policy runtime

 @example
 ```ts
 const transport = createNativePhaseTransport({
   plan,
   state,
   session,
   cwd,
   sendAssessment,
   observations,
   events
 });
 ```
 */
export function createNativePhaseTransport({
  plan,
  state,
  session,
  cwd,
  sendAssessment,
  observations,
  events
}: Readonly<{
  plan: NativePhasePlan;
  state: NativePhaseState;
  session: AgentSession;
  cwd: string;
  sendAssessment: DomainFixtureAssessmentSender;
  observations: NativePhaseObservations;
  events: NativePhaseEvents;
}>): Readonly<{
  sendWire: AssessmentTransport;
  terminalFetch: typeof fetch;
}> {
  /**
   Proposed tool calls carry the authored padded commands for this group.
   */
  const calls = [
    'A',
    'B',
    'C'
  ].map(function proposal(
    letter: string,
    index: number
  ): Readonly<Record<string, unknown>> {
    return {
      index,
      id: `phase-${index}`,
      type: 'function',
      function: {
        name: 'bash',
        arguments: JSON.stringify((plan.mode === 'invalid') && (index === 1)
          ? {}
          : { command: `  printf PHASE_${letter}  ` })
      }
    };
  });
  /**
   Terminal request counter selects proposal, intervention, and followup rounds.
   */
  const requests = { count: 0 };
  /**
   Replace the workspace policy with the prohibition fixture text.
   */
  async function writeProhibitedPolicy(): Promise<void> {
    /**
     Policy path stays directly under the fixture workspace root.
     */
    const policyPath = join(
      cwd,
      'AGENTS.md'
    );
    await writeFile(
      policyPath,
      PROHIBITED_POLICY_TEXT
    );
  }
  /**
   Deliver the authored process-completion notification through the real session.
   */
  async function notify(): Promise<void> {
    await session.sendCustomMessage(
      {
        customType: 'ad-process:notification',
        content: NOTIFICATION_CONTENT,
        display: true,
        details: {
          command: 'printf PHASE_NOTIFICATION',
          processId: 'fixture-process'
        }
      },
      plan.notificationDelivery
    );
  }
  /**
   Fixture wire sender reproduces the original assessment intervention timing.

   @param input - authored decision request forwarded to the assessment sender

   @returns raw authored answer text for the policy runtime
   */
  async function fixtureWireSender(input: Parameters<AssessmentTransport>[0]): Promise<string> {
    observations.attempts++;
    events.push('assess');
    if (plan.notification
      && (!plan.notificationPrimary)
      && (observations.attempts === SECONDARY_ROUND))
      await notify();
    if ((plan.mode === 'steer-user') && (observations.attempts === SECONDARY_ROUND))
      await session.steer(STEERING_TEXT);
    if ((plan.mode === 'policy-change') && (observations.attempts === SECONDARY_ROUND))
      await writeProhibitedPolicy();
    return await sendAssessment(input);
  }
  return {
    sendWire: fixtureWireSender,
    async terminalFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      /**
       Original request is reused when the observer already built one.
       */
      const request = input instanceof Request
        ? input
        : new Request(
          input,
          init
        );
      /**
       Request body determines whether authored notification data already arrived.
       */
      const body = await request.clone()
        .text();
      if (body.includes(NOTIFICATION_CONTENT))
        state.sawNotification = true;
      if (body.includes(STEERING_TEXT))
        state.sawSteering = true;
      /**
       Terminal round selects proposal, intervention, and followup behavior.
       */
      const ordinal = requests.count++;
      if (plan.notificationPrimary && (ordinal === 0))
        await notify();
      if ((plan.mode === 'steer-primary') && (ordinal === 0))
        await session.steer(STEERING_TEXT);
      if ((plan.mode === 'policy-primary') && (ordinal === 0))
        await writeProhibitedPolicy();
      /**
       Followup proposal appears once notification data reached the next request.
       */
      const followup = plan.notification
        && (ordinal > 0)
        && state.sawNotification
        && (!state.followupProposed);
      if (followup)
        state.followupProposed = true;
      /**
       Proposed streams carry tool calls while later rounds may stay plain.
       */
      const proposed = (ordinal === 0) || followup;
      /**
       Selected calls carry the original proposal or followup group.
       */
      const selected = ordinal === 0
        ? calls
        : [{
          index: 0,
          id: FOLLOWUP_ID,
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({ command: 'printf PHASE_FOLLOWUP' })
          }
        }];
      /**
       Chunk envelope matches the original fixture completion identity.
       */
      const chunk = {
        id: 'native-phase-fixture',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'fixture'
      };
      /**
       First delta carries either the proposed tool calls or plain completion.
       */
      const first = {
        ...chunk,
        choices: [{
          index: 0,
          delta: proposed
            ? {
              role: 'assistant',
              tool_calls: selected
            }
            : {
              role: 'assistant',
              content: 'done'
            },
          finish_reason: null
        }]
      };
      /**
       Last delta closes the stream with its finish reason and usage.
       */
      const last = {
        ...chunk,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: proposed ? 'tool_calls' : 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 10,
          total_tokens: 110
        }
      };
      return new Response(
        `data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`,
        { headers: { 'content-type': 'text/event-stream' } }
      );
    }
  };
}

//endregion
