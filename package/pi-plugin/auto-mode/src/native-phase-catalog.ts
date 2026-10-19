/**
 Catalog runner for the native phase fixture modes.

 One run composes the original owner modules through their genuine contracts in
 the original order and reports its summary before the original cleanup. @module
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type {
  AgentSession,
  createBashToolDefinition
} from '@earendil-works/pi-coding-agent';
import { createDomainFixtureAssessment } from '../dist/native/contract/integration/native-batch/domain-fixture-assessment.mjs';
import { createEnvironment } from '../dist/native/contract/integration/native-batch/environment.mjs';
import { bindNativePolicyRuntime } from '../dist/native/contract/integration/native-batch/runtime.mjs';
import { createRootSessionFactory } from '../dist/native/contract/integration/native-batch/session-root.mjs';
import { createNativeSemanticOperatingPolicies } from '../dist/native/contract/integration/maintained-policy.mjs';
import { assertNativePhaseOutcome } from './native-phase-assertions.ts';
import {
  type NativePhaseEvents,
  createPhaseEventSubscriber,
  createPhaseExtensionFactory,
  wrapPhaseBashTool
} from './native-phase-callbacks.ts';
import { readNativePhasePlan } from './native-phase-modes.ts';
import { createNativePhaseTransport } from './native-phase-transport.ts';
import type {
  NativePhaseObservations,
  NativePhaseState,
  NativePhaseSummary
} from './native-phase-types.ts';

/**
 Workspace policy admitting the complete proposed local inspection.
 */
const PHASE_POLICY_TEXT = 'RUL:\n The complete proposed local inspection is permitted.\n';

/**
 Installed SDK bash tool builder narrowed by its exported name.

 The export check establishes callability only; the signature is the installed
 SDK's published declaration, which is separate source-audited ABI evidence.
 */
type BashToolBuilder = Readonly<{ createBashToolDefinition: typeof createBashToolDefinition }>;

/**
 Runtime trace stub keeps policy runtime lifecycle quiet in the fixture.
 */
function traceRuntimeEvent(): void {
  return undefined;
}

/**
 Original session credential slot returns the fixture API key.

 @returns synthetic fixture credential registered by the fixture environment
 */
function fixtureKey(): string {
  /**
   Fixture credential stays registered by the fixture environment.
   */
  const { FIXTURE_API_KEY } = process.env;
  return nonNullishOrThrow(FIXTURE_API_KEY);
}

/**
 Check the installed SDK bash tool export before wrapper construction.

 @param value - installed SDK bash tool module namespace

 @returns callable-only bash tool builder contract

 @throws Error when the bash tool builder is not callable
 */
function assertBashToolBuilder(value: unknown): asserts value is BashToolBuilder {
  if (((typeof value) !== 'object') || (value === null)
    || (!('createBashToolDefinition' in value))
    || ((typeof value.createBashToolDefinition) !== 'function'))
    throw new Error('Installed SDK bash tool builder is unavailable');
}

//region One catalog run keeps the original setup, prompt, and cleanup order.

/**
 Run the native phase catalog for one requested mode.

 @param requestedMode - mode argument forwarded by the task dispatch

 @param emitSummary - terminal summary sink invoked before catalog disposal

 @example
 ```ts
 await runNativePhaseCatalog({
   requestedMode: 'parallel',
   emitSummary
 });
 ```

 @throws AssertionError when any strict branch expectation fails
 */
export async function runNativePhaseCatalog({
  requestedMode,
  emitSummary
}: Readonly<{
  requestedMode: string;
  emitSummary: (summary: NativePhaseSummary) => void;
}>): Promise<void> {
  const plan = readNativePhasePlan({ requestedMode });
  /**
   Event traces retain native call identity without subprocess ordering.
   */
  const events: NativePhaseEvents = [];
  /**
   Observation counters stay shared across every fixture callback.
   */
  const observations: NativePhaseObservations = {
    assessments: 0,
    httpCalls: 0,
    attempts: 0,
    selections: 0,
    executions: 0,
    active: 0,
    maximumActive: 0
  };
  /**
   Live fixture state owns abort retention and deferred update completion.
   */
  const state: NativePhaseState = {
    updates: new Map(),
    sawNotification: false,
    sawSteering: false,
    followupProposed: false
  };
  const environment = await createEnvironment({
    policyText: PHASE_POLICY_TEXT,
    useNativeProvider: true,
    extensionFactories: [createPhaseExtensionFactory({
      plan,
      events
    })]
  });
  /**
   Installed SDK artifact owns the original bash tool definition.
   */
  const bashToolModule: unknown = await import(pathToFileURL(join(
    environment.packageRoot,
    'dist/core/tools/bash.js'
  )).href);
  assertBashToolBuilder(bashToolModule);
  /**
   The SDK `defineTool` erasure runs on the valid original definition before the
   wrapper replaces the preparer, preserving its renderer intersection and
   original execute identity.
   */
  const original = environment.defineTool(bashToolModule.createBashToolDefinition(environment.options
    .cwd));
  /**
   Lazy session reader resolves the original session created below the wrapper.
   */
  function readPhaseSession(): AgentSession {
    return session;
  }
  /**
   Wrapped bash tool observes execution while forwarding original identity.
   */
  const bash = wrapPhaseBashTool({
    plan,
    observations,
    state,
    events,
    original,
    readSession: readPhaseSession
  });
  /**
   Owned construction publishes the flat original result after its await.
   */
  const {
    session,
    root,
    lifecycle
  } = await createRootSessionFactory(environment)
    .create({
      options: {
        ...environment.options,
        tools: ['bash'],
        customTools: [bash]
      }
    });
  session.agent
    .getApiKey = fixtureKey;
  if (plan.sequentialExecution)
    session.agent.toolExecution = 'sequential';
  /**
   Subscription retains its original unsubscribe identity for disposal.
   */
  const unsubscribe = session.agent.subscribe(createPhaseEventSubscriber({
    state,
    events
  }));
  /**
   Assessment settings reproduce the original authored relation answers.
   */
  const sendAssessment = createDomainFixtureAssessment({
    settings: {
      relation: 'permission',
      unresolvedClause: 'prerequisite',
      operationDecision: plan.mode === 'deny' ? 'deny' : 'approve',
      operatingPolicy: true,
      httpTransport: true
    },
    observations
  });
  const transport = createNativePhaseTransport({
    plan,
    state,
    session,
    cwd: environment.options
      .cwd,
    sendAssessment,
    observations,
    events
  });
  const runtime = bindNativePolicyRuntime({
    root,
    lifecycle,
    policyInput: environment.policyInput,
    rootDirectory: environment.options
      .cwd,
    parsePolicy: environment.parser
      .parse,
    files: [],
    wrapToolDefinition: environment.wrapToolDefinition,
    readSessionDisposalState: environment.readSessionDisposalState,
    trace: traceRuntimeEvent,
    ...createNativeSemanticOperatingPolicies(),
    sendWire: transport.sendWire,
    terminalFetch: transport.terminalFetch
  });
  await using cleanup = {
    async [Symbol.asyncDispose](): Promise<void> {
      await state.abortTask;
      session.dispose();
      await session.agent
        .waitForIdle();
      runtime.detach();
      unsubscribe();
      await environment.drain();
      await logger.flush();
    }
  };
  await session.prompt('Perform the complete proposed local inspection.');
  await state.abortTask;
  assertNativePhaseOutcome({
    plan,
    observations,
    state,
    events
  });
  /**
   Terminal summary preserves the original printed field set and order.
   */
  const summary: NativePhaseSummary = {
    complete: true,
    mode: plan.requestedMode,
    ...observations,
    events
  };
  emitSummary(summary);
}

//endregion
