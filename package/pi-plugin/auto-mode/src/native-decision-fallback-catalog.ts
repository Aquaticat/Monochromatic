/**
 Catalog runner for the native decision fallback fixture modes.

 One run composes the typed fixture owners in the original order and reports its
 summary before the disposal owner reproduces the original cleanup. @module
 */
import {
  assertDecisionFallbackOutcome,
  assertFailedStartupChat
} from './native-decision-fallback-assertions.ts';
import { captureDecisionFallbackEvidence } from './native-decision-fallback-evidence.ts';
import {
  loadMaintainedPolicyEntries,
  maintainedPolicyHarness,
  policyRuntimeHarness
} from './native-decision-fallback-harness.ts';
import { createDecisionFallbackApprovalHostFactory } from './native-decision-fallback-host.ts';
import { createDecisionFallbackDisposal } from './native-decision-fallback-lifecycle.ts';
import { readDecisionFallbackPlan } from './native-decision-fallback-modes.ts';
import { createDecisionFallbackOperation } from './native-decision-fallback-operation.ts';
import { createDecisionFallbackSession } from './native-decision-fallback-session.ts';
import {
  createDecisionFallbackObservations,
  createDecisionFallbackState
} from './native-decision-fallback-state.ts';
import type { DecisionFallbackSummary } from './native-decision-fallback-types.ts';
import { createDecisionFallbackWireSender } from './native-decision-fallback-wire.ts';

//region Shared runtime callbacks stay outside the catalog runner scope.

/**
 Runtime trace stub keeps policy runtime lifecycle quiet in the fixture.
 */
function traceRuntimeEvent(): void {
  return undefined;
}

//endregion

//region One catalog run keeps the original setup, prompt, and cleanup order.

/**
 Run the native decision fallback catalog for one requested mode.

 @param requestedMode - mode argument forwarded by the task configuration

 @param emitSummary - terminal summary sink invoked before catalog disposal

 @example
 ```ts
 await runNativeDecisionFallbackCatalog({
   requestedMode: 'approve',
   emitSummary
 });
 ```

 @throws AssertionError when any strict branch expectation fails
 */
export async function runNativeDecisionFallbackCatalog({
  requestedMode,
  emitSummary
}: Readonly<{
  requestedMode: string;
  emitSummary: (summary: DecisionFallbackSummary) => void;
}>): Promise<void> {
  /**
   Mode plan derives every strict branch expectation once.
   */
  const plan = readDecisionFallbackPlan({ requestedMode });
  /**
   Release-bound entries load before the fixture environment changes HOME.
   */
  const maintained = await loadMaintainedPolicyEntries();
  /**
   Observation counters stay shared across every fixture callback.
   */
  const observations = createDecisionFallbackObservations();
  /**
   Live fixture state owns captured capability and abort retention.
   */
  const state = createDecisionFallbackState({ plan });
  /**
   Evidence capture keeps the actual tagged logger payloads for assertions.
   */
  const capture = captureDecisionFallbackEvidence();
  /**
   Fixture session pairs the built environment with its original session.
   */
  const {
    environment,
    session,
    root,
    lifecycle
  } = await createDecisionFallbackSession({
    plan,
    state,
    observations
  });
  /**
   Policy and tool slots forward from the built environment unchanged.
   */
  const {
    parser,
    policyInput,
    wrapToolDefinition,
    readSessionDisposalState
  } = environment;
  /**
   Workspace cwd roots the owned policy runtime binding.
   */
  const { cwd } = environment.options;
  /**
   Operation fixture supplies the proposal commands and terminal replies.
   */
  const operation = createDecisionFallbackOperation({ state });
  /**
   Policy runtime binds judgment, approval, and transport owners once.
   */
  const runtime = policyRuntimeHarness.bindNativePolicyRuntime({
    root,
    lifecycle,
    policyInput,
    rootDirectory: cwd,
    parsePolicy: parser.parse,
    files: [],
    wrapToolDefinition,
    readSessionDisposalState,
    trace: traceRuntimeEvent,
    ...maintainedPolicyHarness.createNativeSemanticOperatingPolicies(),
    now: function readFixtureClock(): number {
      return performance.now() + state.clockOffset;
    },
    approvalHost: createDecisionFallbackApprovalHostFactory({
      plan,
      state,
      session,
      maintained,
      observations,
      commands: operation.commands,
      environment
    }),
    sendWire: createDecisionFallbackWireSender({
      plan,
      state,
      session,
      environment,
      observations
    }),
    terminalFetch: operation.terminalFetch
  });
  /**
   Disposal owner reproduces the original cleanup order at scope exit.
   */
  await using disposal = createDecisionFallbackDisposal({
    state,
    session,
    runtime,
    environment,
    capture
  });
  if (plan.startupFailure) {
    await session.prompt('Reply without using tools.');
    assertFailedStartupChat({ observations });
    state.ordinaryChatPending = false;
  }
  await session.prompt('Perform the complete proposed local inspection.');
  await state.abortTask;
  assertDecisionFallbackOutcome({
    plan,
    observations,
    capture,
    session,
    commands: operation.commands
  });
  /**
   Terminal summary preserves the original printed field set and order.
   */
  const summary: DecisionFallbackSummary = {
    complete: true,
    mode: plan.requestedMode,
    ...observations,
    reconstructableDecisionLogs: true
  };
  emitSummary(summary);
}

//endregion
