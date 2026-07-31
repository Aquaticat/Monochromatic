/**
 * Pi Advisor extension entry point.
 *
 * Registers an `advisor` tool and `/advisor` command that consult a scoped
 * secondary reviewer model using serialized conversation context.
 *
 * @module
 */

import type {
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
  MessageRenderOptions,
  Theme,
} from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { buildAdvisorSystemPrompt, } from './advisor-client.ts';
import {
  createAdvisorSessionState,
  registerAdvisorCommands,
  syncAdvisorActiveTool,
} from './commands.ts';
import { loadMergedConfig, } from './config.ts';
import {
  ADVISOR_MESSAGE_TYPE,
  MAIN_MODEL_GUIDANCE_PREFIX,
} from './constants.ts';
import { resolveEffectiveScope, } from '@monochromatic-dev/pi-shared-model-selection/ts';
import { selectAdvisorModel, } from './advisor-selection.ts';
import { renderAdvisorMessage, } from './rendering.ts';
import { createAdvisorTool, } from './tool.ts';

/**
 * Logger root for pi-advisor after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'pi-advisor', },);

/**
 * Tagged logger for the Advisor entry point.
 */
const l = tagged({
  tag: 'index',
  l: parentLogger,
},);

//region Extension entry point

/**
 * Advisor pi extension.
 *
 * @param pi - pi extension API
 *
 * @mutates pi - `pi.registerTool`, `pi.registerMessageRenderer`, `pi.on`, and delegated `pi.registerCommand` change Pi host registrations
 *
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * { "packages": ["./packages/pi-plugin/advisor"] }
 * ```
 */
export default async function advisor(
  pi: ForeignBorrowed<ExtensionAPI>,
): Promise<void> {
  /**
   * Logger tagged with the extension factory name.
   */
  const innerL = tagged({
    tag: advisor.name,
    l,
  },);
  /**
   * Runtime config loaded at extension startup.
   */
  const config = await loadMergedConfig({ cwd: process.cwd(), },);
  /**
   * Mutable session state controlled by `/advisor on` and `/advisor off`.
   */
  const state = createAdvisorSessionState(config.enabled,);

  innerL.debug(`advisor extension loaded; enabled=${String(state.getEnabled(),)}`,);

  pi.registerTool(createAdvisorTool({
    getConfig: function getConfig() {
      return config;
    },
    getSessionEnabled: function getSessionEnabled() {
      return state.getEnabled();
    },
  },),);

  registerAdvisorCommands({
    pi,
    getConfig: function getConfig() {
      return config;
    },
    state,
  },);

  pi.registerMessageRenderer(
    ADVISOR_MESSAGE_TYPE,
    function renderMessage(
      message: ReadonlyDeep<{
        content: unknown;
        details?: unknown;
      }>,
      options: Readonly<MessageRenderOptions>,
      theme: ForeignBorrowed<Theme>,
    ) {
      return renderAdvisorMessage({
        message,
        expanded: options.expanded,
        theme,
      },);
    },
  );

  pi.on(
    'session_start',
    function handleSessionStart() {
      syncAdvisorActiveTool({
        pi,
        enabled: state.getEnabled(),
      },);
    },
  );

  pi.on(
    'before_agent_start',
    /**
     * Adds Advisor guidance before each enabled agent turn.
     *
     * @param event - Pi prompt event.
     *
     * @param ctx - Pi extension context.
     *
     * @returns Prompt replacement when Advisor is enabled.
     *
     * @mutates ctx - `buildMainModelGuidance` invokes context scope and model-registry callbacks
     */
    async function handleBeforeAgentStart(
      event: ForeignBorrowed<BeforeAgentStartEvent>,
      ctx: ForeignBorrowed<ExtensionContext>,
    ) {
      if (!state.getEnabled())
        return undefined;

      /**
       * Advisor guidance appended to the main model system prompt.
       */
      const guidance = await buildMainModelGuidance({
        ctx,
        config,
      },);
      return {
        systemPrompt: `${event.systemPrompt}\n\n${guidance}`,
      };
    },
  );
}

//endregion Extension entry point

//region Prompt guidance

/**
 * Build dynamic main-model guidance for Advisor.
 *
 * @param ctx - pi extension context
 *
 * @param config - runtime Advisor config
 *
 * @returns prompt text appended to main model system prompt
 *
 * @mutates ctx - `resolveEffectiveScope` invokes context live-scope and model-registry callbacks
 *
 * @example
 * ```typescript
 * buildMainModelGuidance({ ctx, config });
 * ```
 */
async function buildMainModelGuidance(
  {
    ctx,
    config,
  }: {
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly config: Awaited<ReturnType<typeof loadMergedConfig>>;
  },
): Promise<string> {
  /**
   * Effective scoped model set.
   */
  const scope = await resolveEffectiveScope({
    ctx,
    errorPrefix: 'advisor',
  },);
  /**
   * Default model for empty Advisor params.
   */
  const defaultSelection = scope.entries
    .length
    === 0
    ? undefined
    : selectAdvisorModel({
      scope,
      config,
      estimatedInputTokens: 0,
      modelRegistry: ctx.modelRegistry,
      ...(ctx.model
        === undefined ? {} : { currentMainModel: ctx.model, }),
    },)
      .defaultSelection;
  /**
   * Canonical slugs available to Advisor.
   */
  const scopedSlugs = scope.entries
    .map(function mapEntry(
      entry: ReadonlyDeep<(typeof scope.entries)[number]>,
    ) {
    return entry.canonicalSlug;
  },);

  return [
    MAIN_MODEL_GUIDANCE_PREFIX,
    `Allowed Advisor model slugs: ${
      scopedSlugs.length
        === 0 ? 'none' : scopedSlugs.join(', ',)
    }`,
    `advisor({}) default model: ${defaultSelection?.selected
      .canonicalSlug
      ?? 'none'}`,
    `Advisor prompt: ${buildAdvisorSystemPrompt(config,)
      .split('\n',)[0]}`,
  ]
    .join('\n',);
}

//endregion Prompt guidance

export { buildAdvisorStatus, } from './commands.ts';
export { buildMainModelGuidance, };

/**
 * Internal provider-call behavior exported for built-artifact verification.
 *
 * @internal
 */
export {
  completeAdvisor,
  type CompleteAdvisorModel,
} from './advisor-client.ts';

/**
 * Internal config fixtures exported for built-artifact verification.
 *
 * @internal
 */
export { DEFAULT_CONFIG, } from './config.ts';

/**
 * Internal Advisor data types exported for built-artifact verification.
 *
 * @internal
 */
export type {
  AdvisorConfig,
  AdvisorContext,
} from './types.ts';
