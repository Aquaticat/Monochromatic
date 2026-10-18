/**
 Session fixture owner for the native decision fallback catalog.

 Environment, original SDK session, and the wrapped bash tool keep their real
 identities while fixture callbacks observe execution and progress. @module
 */
import { setImmediate as yieldProgress } from 'node:timers/promises';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  createBashToolDefinition,
  ExtensionAPI,
  ExtensionToolContext,
  ToolExecutionUpdateEvent
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  environmentHarness,
  loadBashToolModule,
  relevanceHarness,
  rootSessionHarness
} from './native-decision-fallback-harness.ts';
import { FIXTURE_POLICY_TEXT } from './native-decision-fallback-state.ts';
import type {
  DecisionFallbackObservations,
  DecisionFallbackPlan,
  DecisionFallbackSessionFixture,
  DecisionFallbackState
} from './native-decision-fallback-types.ts';

//region The original session registers fixture progress and credential callbacks.

/**
 Original bash execute parameters retained for the forwarded arguments.
 */
export type OriginalBashParameters = Parameters<ReturnType<typeof createBashToolDefinition>['execute']>;

/**
 Original bash execute signature retained for the forwarded callback identity.
 */
export type OriginalBashExecute = ReturnType<typeof createBashToolDefinition>['execute'];

/**
 Original update details retain the SDK tool's own declared detail shape.
 */
export type OriginalBashDetails = ReturnType<OriginalBashExecute> extends Promise<AgentToolResult<infer TDetails>>
  ? TDetails
  : never;

/**
 Update details carried by the wrapper's fixture progress marker and by the
 forwarded original bash results.
 */
export type FixtureBashDetails = OriginalBashDetails | Readonly<{ fallbackProgress: boolean }>;

/**
 Wrapper execute signature dictated by the SDK tool interface, declaring the
 fixture's update details while forwarding original identities and arguments.
 */
export type FixtureBashExecute = (
  toolCallId: string,
  input: OriginalBashParameters[1],
  signal: OriginalBashParameters[2],
  onUpdate: AgentToolUpdateCallback<FixtureBashDetails>,
  context: ExtensionToolContext
) => Promise<AgentToolResult<FixtureBashDetails>>;

/**
 Installed SDK bash tool definition with only its execute member replaced.
 */
export type FixtureBashTool = Omit<ReturnType<typeof createBashToolDefinition>, 'execute'> & Readonly<{
  execute: FixtureBashExecute;
}>;

/**
 Fixture progress marker projection over the original update payload.
 */
type FixtureProgressUpdate = Readonly<{
  details: Readonly<{ fallbackProgress: boolean }>;
}>;

/**
 Recognize an object member before its marker field read.

 @param value - update payload member arriving from the original SDK event

 @returns whether ordinary property reads can inspect the member
 */
function isUpdateMemberRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 Recognize the fixture fallback progress marker inside an original update.

 @param value - partial result member of a tool execution update event

 @returns whether the payload carries the fixture progress marker
 */
function isFixtureProgressUpdate(value: unknown): value is FixtureProgressUpdate {
  if (!isUpdateMemberRecord(value))
    return false;
  /**
   Marker lives under the partial result's details member.
   */
  const { details } = value;
  if (!isUpdateMemberRecord(details))
    return false;
  return Boolean(details.fallbackProgress);
}

/**
 Original session credential slot returns the fixture API key.

 @returns synthetic fixture credential registered by the fixture environment
 */
function fixtureApiKey(): string {
  /**
   Fixture credential stays registered by the fixture environment.
   */
  const { FIXTURE_API_KEY } = process.env;
  return nonNullishOrThrow(FIXTURE_API_KEY);
}

/**
 Build the isolated fixture environment with its original session.

 @param plan - mode plan selecting startup classification behavior

 @param state - live fixture state retaining captured SDK capabilities

 @param observations - counters incremented by fixture callbacks

 @returns built environment paired with its original session

 @example
 ```ts
 const sessionFixture = await createDecisionFallbackSession({
   plan,
   state,
   observations
 });
 ```

 @throws Error when built harness exports are unavailable
 */
export async function createDecisionFallbackSession({
  plan,
  state,
  observations
}: Readonly<{
  plan: DecisionFallbackPlan;
  state: DecisionFallbackState;
  observations: DecisionFallbackObservations;
}>): Promise<DecisionFallbackSessionFixture> {
  /**
   Isolated environment admits the fixture policy on the native provider.
   */
  const environment = await environmentHarness.createEnvironment({
    policyText: FIXTURE_POLICY_TEXT,
    useNativeProvider: true,
    extensionFactories: [function capturePi(pi: ExtensionAPI): void {
      state.pi = pi;
      pi.on(
        'tool_execution_update',
        async function observeProgress(event: ForeignBorrowed<ToolExecutionUpdateEvent>): Promise<void> {
          /**
           Partial result stays opaque until its marker projection narrows it.
           */
          const partialResult: unknown = event.partialResult;
          if (isFixtureProgressUpdate(partialResult))
            observations.updates++;
          await yieldProgress();
        }
      );
    }],
    ...(plan.startupFailure ? { createRelevance: relevanceHarness.createStartupRelevance } : {})
  });
  /**
   Installed SDK artifact owns the original bash tool definition.
   */
  const bashModule = await loadBashToolModule({ packageRoot: environment.packageRoot });
  /**
   Workspace cwd drives the original bash tool definition.
   */
  const { cwd } = environment.options;
  /**
   Original bash tool keeps its own execute identity for the wrapper.
   */
  const originalBash = bashModule.createBashToolDefinition(cwd);
  /**
   Progress wrapper keeps the original execute identity for admitted members.
   */
  const bash: FixtureBashTool = {
    ...originalBash,
    async execute(
      toolCallId,
      input,
      signal,
      onUpdate,
      context
    ): Promise<AgentToolResult<FixtureBashDetails>> {
      observations.executions++;
      nonNullishOrThrow(onUpdate)({
        content: [{
          type: 'text',
          text: 'Native fallback progress'
        }],
        details: { fallbackProgress: true }
      });
      return await originalBash.execute(
        toolCallId,
        input,
        signal,
        onUpdate,
        context
      );
    }
  };
  /**
   Owned construction publishes the original session with its manager root.
   */
  const {
    session,
    root,
    lifecycle
  } = await rootSessionHarness.createRootSessionFactory(environment)
    .create({
      options: {
        ...environment.options,
        tools: ['bash'],
        customTools: [bash]
      }
    });
  session.agent
    .getApiKey = fixtureApiKey;
  return {
    environment,
    session,
    root,
    lifecycle
  };
}

//endregion
