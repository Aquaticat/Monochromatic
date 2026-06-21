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
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ReadonlyDeep, } from 'type-fest';
import { buildAdvisorSystemPrompt, } from './advisor-client.ts';
import {
  buildAdvisorStatus,
  createAdvisorSessionState,
  registerAdvisorCommands,
  syncAdvisorActiveTool,
} from './commands.ts';
import { loadMergedConfig, } from './config.ts';
import {
  ADVISOR_MESSAGE_TYPE,
  MAIN_MODEL_GUIDANCE_PREFIX,
} from './constants.ts';
import { l as parentLogger, } from './log.ts';
import { resolveEffectiveScope, } from '@monochromatic-dev/pi-shared-model-selection/ts';
import { selectAdvisorModel, } from './advisor-selection.ts';
import { renderAdvisorMessage, } from './rendering.ts';
import { createAdvisorTool, } from './tool.ts';

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
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * { "packages": ["./packages/pi/advisor"] }
 * ```
 */
export default function advisor(
  pi: ExtensionAPI,
): void {
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
  const config = loadMergedConfig({ cwd: process.cwd(), },);
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
      message,
      options,
      theme,
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
    function handleBeforeAgentStart(
      event: ReadonlyDeep<BeforeAgentStartEvent>,
      ctx: ReadonlyDeep<ExtensionContext>,
    ) {
      if (!state.getEnabled())
        return undefined;

      /**
       * Advisor guidance appended to the main model system prompt.
       */
      const guidance = buildMainModelGuidance({
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
 * @example
 * ```typescript
 * buildMainModelGuidance({ ctx, config });
 * ```
 */
function buildMainModelGuidance(
  {
    ctx,
    config,
  }: {
    readonly ctx: ReadonlyDeep<ExtensionContext>;
    readonly config: ReturnType<typeof loadMergedConfig>;
  },
): string {
  /**
   * Effective scoped model set.
   */
  const scope = resolveEffectiveScope({
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
    .map(function mapEntry(entry,) {
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

export {
  buildAdvisorStatus,
  buildMainModelGuidance,
};
