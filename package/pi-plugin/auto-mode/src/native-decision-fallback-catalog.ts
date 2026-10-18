/**
 Catalog runner for the native decision fallback fixture modes.

 One run composes the typed fixture owners in the original order and reports its
 summary before the disposal owner reproduces the original cleanup. @module
 */
import { assertDecisionFallbackOutcome, assertFailedStartupChat } from './native-decision-fallback-assertions.ts';
import {
  loadMaintainedPolicyEntries,
  maintainedPolicyHarness,
  policyRuntimeHarness
} from './native-decision-fallback-harness.ts';
import { createDecisionFallbackApprovalHostFactory } from './native-decision-fallback-host.ts';
import { createDecisionFallbackDisposal } from './native-decision-fallback-lifecycle.ts';
import { captureDecisionFallbackEvidence } from './native-decision-fallback-evidence.ts';
import { readDecisionFallbackPlan } from './native-decision-fallback-modes.ts';
import { createDecisionFallbackOperation } from './native-decision-fallback-operation.ts';
import { createDecisionFallbackSession } from './native-decision-fallback-session.ts';
import {
  createDecisionFallbackObservations,
  createDecisionFallbackState
} from './native-decision-fallback-state.ts';
import type {
  DecisionFallbackSummary
} from './native-decision-fallback-types.ts';
import { createDecisionFallbackWireSender } from './native-decision-fallback-wire.ts';

//region One catalog run keeps the original setup, prompt, and cleanup order.

/**
 Run the native decision fallback catalog for one requested mode.

 @param requestedMode - mode argument forwarded by the task configuration

 @param emitSummary - terminal summary sink invoked before catalog disposal

 @throws AssertionError when any strict branch expectation fails
 */
export async function runNativeDecisionFallbackCatalog({ requestedMode, emitSummary }: Readonly<{
  requestedMode: string;
  emitSummary: (summary: DecisionFallbackSummary) => void;
}>): Promise<void> {
  const plan = readDecisionFallbackPlan({ requestedMode });
  const maintained = await loadMaintainedPolicyEntries();
  const observations = createDecisionFallbackObservations();
  const state = createDecisionFallbackState({ plan });
  const capture = captureDecisionFallbackEvidence();
  const sessionFixture = await createDecisionFallbackSession({
    plan,
    state,
    observations
  });
  const operation = createDecisionFallbackOperation({ state });
  const runtime = policyRuntimeHarness.bindNativePolicyRuntime({
    root: sessionFixture.root,
    lifecycle: sessionFixture.lifecycle,
    policyInput: sessionFixture.environment.policyInput,
    rootDirectory: sessionFixture.environment.options.cwd,
    parsePolicy: sessionFixture.environment.parser.parse,
    files: [],
    wrapToolDefinition: sessionFixture.environment.wrapToolDefinition,
    readSessionDisposalState: sessionFixture.environment.readSessionDisposalState,
    trace: function traceRuntimeEvent(): void {
      return undefined;
    },
    ...maintainedPolicyHarness.createNativeSemanticOperatingPolicies(),
    now: function readFixtureClock(): number {
      return performance.now() + state.clockOffset;
    },
    approvalHost: createDecisionFallbackApprovalHostFactory({
      plan,
      state,
      session: sessionFixture.session,
      maintained,
      observations,
      commands: operation.commands,
      environment: sessionFixture.environment
    }),
    sendWire: createDecisionFallbackWireSender({
      plan,
      state,
      session: sessionFixture.session,
      environment: sessionFixture.environment,
      observations
    }),
    terminalFetch: operation.terminalFetch
  });
  await using disposal = createDecisionFallbackDisposal({
    state,
    session: sessionFixture.session,
    runtime,
    environment: sessionFixture.environment,
    capture
  });
  if (plan.startupFailure) {
    await sessionFixture.session.prompt('Reply without using tools.');
    assertFailedStartupChat({ observations });
    state.ordinaryChatPending = false;
  }
  await sessionFixture.session.prompt('Perform the complete proposed local inspection.');
  await state.abortTask;
  assertDecisionFallbackOutcome({
    plan,
    observations,
    capture,
    session: sessionFixture.session,
    commands: operation.commands
  });
  const summary: DecisionFallbackSummary = {
    complete: true,
    mode: plan.requestedMode,
    ...observations,
    reconstructableDecisionLogs: true
  };
  emitSummary(summary);
}

//endregion
