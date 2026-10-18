/**
 Session fixture owner for the native decision fallback catalog.

 Environment, original SDK session, and the wrapped bash tool keep their real
 identities while fixture callbacks observe execution and progress. @module
 */
import { setImmediate as yieldProgress } from 'node:timers/promises';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type {
  AgentToolResult,
  BashToolDetails,
  createBashToolDefinition,
  ExtensionAPI,
  ToolExecutionUpdateEvent
} from '@earendil-works/pi-coding-agent';
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

/**
 Installed SDK bash tool definition returned by its own artifact.
 */
type FixtureBashTool = ReturnType<typeof createBashToolDefinition>;

//region The original session registers fixture progress and credential callbacks.

/**
 Build the isolated fixture environment with its original session.

 @param plan - mode plan selecting startup classification behavior

 @param state - live fixture state retaining captured SDK capabilities

 @param observations - counters incremented by fixture callbacks

 @returns built environment paired with its original session

 @throws Error when built harness exports are unavailable
 */
export async function createDecisionFallbackSession({ plan, state, observations }: Readonly<{
  plan: DecisionFallbackPlan;
  state: DecisionFallbackState;
  observations: DecisionFallbackObservations;
}>): Promise<DecisionFallbackSessionFixture> {
  const environment = await environmentHarness.createEnvironment({
    policyText: FIXTURE_POLICY_TEXT,
    useNativeProvider: true,
    extensionFactories: [function capturePi(pi: ExtensionAPI): void {
      state.pi = pi;
      pi.on(
        'tool_execution_update',
        async function observeProgress(event: ToolExecutionUpdateEvent): Promise<void> {
          if (event.partialResult?.details?.fallbackProgress)
            observations.updates++;
          await yieldProgress();
        }
      );
    }],
    ...(plan.startupFailure ? { createRelevance: relevanceHarness.createStartupRelevance } : {})
  });
  const bashModule = await loadBashToolModule({ packageRoot: environment.packageRoot });
  const originalBash = bashModule.createBashToolDefinition(environment.options.cwd);
  /**
   Progress wrapper keeps the original execute identity for admitted members.
   */
  const bash: FixtureBashTool = {
    ...originalBash,
    async execute(toolCallId, input, signal, onUpdate, context): Promise<AgentToolResult<BashToolDetails | undefined>> {
      observations.executions++;
      nonNullishOrThrow(onUpdate)({
        content: [{
          type: 'text',
          text: 'Native fallback progress'
        }],
        details: { fallbackProgress: true }
      });
      return await Reflect.apply(
        originalBash.execute,
        originalBash,
        [toolCallId, input, signal, onUpdate, context]
      );
    }
  };
  const created = await rootSessionHarness.createRootSessionFactory(environment)
    .create({
      options: {
        ...environment.options,
        tools: ['bash'],
        customTools: [bash]
      }
    });
  created.session.agent.getApiKey = function fixtureApiKey(): string {
    return nonNullishOrThrow(process.env.FIXTURE_API_KEY);
  };
  return {
    environment,
    session: created.session,
    root: created.root,
    lifecycle: created.lifecycle
  };
}

//endregion
