/**
 * Slash command registration for Advisor.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed';
import { buildAdvisorSystemPrompt, } from './advisor-client.ts';
import { sendAdvisorMessage, } from './command-message.ts';
import { ADVISOR_TOOL_NAME, } from './constants.ts';
import { maxContextCharsForAdvisorModel, } from './context.ts';
import { resolveEffectiveScope, } from '@monochromatic-dev/pi-shared-model-selection/ts';
import { selectAdvisorModel, } from './advisor-selection.ts';
import { runAdvisor, } from './tool.ts';
import type { AdvisorConfig, } from './types.ts';

//region Types

/**
 * Session-scoped Advisor toggle controlled by `/advisor on` and `/advisor off`.
 *
 * Exposes a readonly handle pair (`getEnabled` / `setEnabled`) backed by a
 * closure-private boolean so parameter types stay readonly while the toggle
 * mutation remains intentional and centralised in {@link createAdvisorSessionState}.
 */
export type AdvisorSessionState = {
  /**
   * Read current session-enable flag.
   */
  readonly getEnabled: () => boolean;
  /**
   * Update session-enable flag.
   */
  readonly setEnabled: (enabled: boolean) => void;
};

/**
 * Build an {@link AdvisorSessionState} handle around a private mutable flag.
 *
 * @param initialEnabled - starting toggle value
 *
 * @returns session-state handle with readonly getter and setter
 *
 * @example
 * ```typescript
 * const state = createAdvisorSessionState(true);
 * ```
 */
export function createAdvisorSessionState(
  initialEnabled: boolean,
): AdvisorSessionState {
  /**
   * Closure-private session-enable flag.
   */
  let enabled = initialEnabled;
  /**
   * Handle exposing getter and setter over the closure-private flag.
   */
  const state: AdvisorSessionState = {
    getEnabled: function getEnabled() {
      return enabled;
    },
    setEnabled: function setEnabled(value: boolean) {
      enabled = value;
    },
  };
  return state;
}

/**
 * Options for command registration.
 */
export type RegisterAdvisorCommandsOptions = {
  /**
   * Pi extension API.
   */
  readonly pi: ExtensionAPI;
  /**
   * Runtime config accessor.
   */
  readonly getConfig: () => AdvisorConfig;
  /**
   * Session enablement state.
   */
  readonly state: AdvisorSessionState;
};

//endregion Types

//region Public API

/**
 * Register `/advisor` command and subcommands.
 *
 * @param options - pi API and runtime state
 *
 * @mutates options - `options.pi.registerCommand` stores command registration in Pi host state
 *
 * @example
 * ```typescript
 * registerAdvisorCommands({ pi, getConfig, state });
 * ```
 */
export function registerAdvisorCommands(
  options: ForeignBorrowed<RegisterAdvisorCommandsOptions>,
): void {
  options.pi
    .registerCommand(
    ADVISOR_TOOL_NAME,
    {
      description:
        'Run Advisor, inspect scoped models, or toggle Advisor for this session',
      async handler(
        args,
        ctx,
      ) {
        await handleAdvisorCommand({
          args,
          ctx,
          pi: options.pi,
          getConfig: options.getConfig,
          state: options.state,
        },);
      },
    },
  );
}

/**
 * Synchronize active tools with Advisor session state.
 *
 * @param pi - pi extension API
 *
 * @param enabled - whether Advisor should be active
 *
 * @mutates pi - `pi.setActiveTools` changes active Pi host tools when Advisor state differs
 *
 * @example
 * ```typescript
 * syncAdvisorActiveTool({ pi, enabled: false });
 * ```
 */
export function syncAdvisorActiveTool(
  {
    pi,
    enabled,
  }: ForeignBorrowed<Readonly<{
    pi: ExtensionAPI;
    enabled: boolean;
  }>>,
): void {
  /**
   * Current active tool names.
   */
  const activeTools = pi.getActiveTools();
  /**
   * Whether Advisor is active.
   */
  const alreadyActive = activeTools.includes(ADVISOR_TOOL_NAME,);
  if (enabled && (!alreadyActive)) {
    pi.setActiveTools([
      ...activeTools,
      ADVISOR_TOOL_NAME,
    ],);
    return;
  }
  if ((!enabled) && alreadyActive) {
    pi.setActiveTools(activeTools.filter(function keepTool(toolName,) {
      return toolName !== ADVISOR_TOOL_NAME;
    },),);
  }
}

/**
 * Build `/advisor status` text.
 *
 * @param ctx - command-capable extension context
 *
 * @param config - runtime Advisor config
 *
 * @param enabled - session enablement state
 *
 * @returns status text
 *
 * @mutates ctx - `resolveEffectiveScope` invokes context live-scope and model-registry callbacks
 *
 * @example
 * ```typescript
 * const text = buildAdvisorStatus({ ctx, config, enabled: true });
 * ```
 */
export async function buildAdvisorStatus(
  {
    ctx,
    config,
    enabled,
  }: ForeignBorrowed<Readonly<{
    ctx: ExtensionCommandContext;
    config: AdvisorConfig;
    enabled: boolean;
  }>>,
): Promise<string> {
  /**
   * Effective model scope for status.
   */
  const scope = await resolveEffectiveScope({
    ctx,
    errorPrefix: 'advisor',
  },);
  /**
   * Empty-context default ranking for status display.
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
   * Advisor model system prompt used for budget reserve estimate.
   */
  const advisorSystemPrompt = buildAdvisorSystemPrompt(config,);
  /**
   * Effective context budget for status default model.
   */
  const defaultContextBudget = defaultSelection === undefined
    ? undefined
    : maxContextCharsForAdvisorModel({
      config,
      model: defaultSelection.selected
        .model,
      advisorSystemPrompt,
    },);
  /**
   * Effective context budget shown when present.
   */
  const defaultContextBudgetText = defaultContextBudget === undefined
    ? 'none'
    : `${defaultContextBudget} chars`;
  /**
   * Configured context cap shown when present.
   */
  const configuredContextCap = config.maxContextChars
    === undefined
    ? 'none'
    : `${config.maxContextChars} chars`;

  return [
    `Advisor: ${enabled ? 'on' : 'off'}`,
    `Scope source: ${scope.source}`,
    `Scoped models: ${
      scope.entries
        .length
        === 0 ? 'none' : scope
        .entries
          .map(function mapEntry(
            entry: ReadonlyDeep<(typeof scope.entries)[number]>,
          ) {
          return entry.canonicalSlug;
        },)
          .join(', ',)
    }`,
    `Default model: ${defaultSelection?.selected
      .canonicalSlug
      ?? 'none'}`,
    `Default ranking: ${defaultSelection?.reason
      ?? 'none'}`,
    `Config: global=${
      config.source
        .globalLoaded ? config.source
          .globalPath : 'absent'
    } project=${config.source
      .projectLoaded ? config.source
        .projectPath : 'absent'}`,
    [
      `Context budget: ${defaultContextBudgetText} effective for default model,`,
      `cap=${configuredContextCap},`,
      `${config.maxAdvisorOutputTokens} output tokens`,
    ]
      .join(' ',),
    `Prior Advisor results: ${
      config.includePriorAdvisorResults ? 'included' : 'omitted'
    }`,
  ]
    .join('\n',);
}

//endregion Public API

//region Handler

/**
 * Options for the command handler.
 */
type HandleAdvisorCommandOptions = {
  /**
   * Raw command args.
   */
  readonly args: string;
  /**
   * Command context.
   */
  readonly ctx: ExtensionCommandContext;
  /**
   * Pi extension API.
   */
  readonly pi: ExtensionAPI;
  /**
   * Runtime config accessor.
   */
  readonly getConfig: () => AdvisorConfig;
  /**
   * Mutable session state.
   */
  readonly state: AdvisorSessionState;
};

/**
 * Handle one `/advisor` invocation.
 *
 * @param options - command handler inputs
 *
 * @mutates options - changes session toggle and invokes Pi active-tool and notification capabilities
 */
async function handleAdvisorCommand(
  options: ForeignBorrowed<HandleAdvisorCommandOptions>,
): Promise<void> {
  /**
   * Trimmed command args.
   */
  const trimmed = options.args
    .trim();
  if (trimmed === 'status') {
    options
      .ctx
      .ui
      .notify(await buildAdvisorStatus({
      ctx: options.ctx,
      config: options.getConfig(),
      enabled: options.state
        .getEnabled(),
    },),);
    return;
  }

  if (trimmed === 'off') {
    options.state
      .setEnabled(false,);
    syncAdvisorActiveTool({
      pi: options.pi,
      enabled: false,
    },);
    options
      .ctx
      .ui
      .notify('Advisor disabled for this session.',);
    return;
  }

  if (trimmed === 'on') {
    options.state
      .setEnabled(true,);
    syncAdvisorActiveTool({
      pi: options.pi,
      enabled: true,
    },);
    options
      .ctx
      .ui
      .notify('Advisor enabled for this session.',);
    return;
  }

  if (!options.state
    .getEnabled()) {
    options
      .ctx
      .ui
      .notify(
      'Advisor is disabled for this session. Run /advisor on to re-enable.',
      'error',
    );
    return;
  }

  await runImmediateAdvisor({
    ctx: options.ctx,
    pi: options.pi,
    config: options.getConfig(),
    ...(trimmed === '' ? {} : { requestedSlug: trimmed, }),
  },);
}

/**
 * Run immediate manual Advisor review and append a custom message.
 *
 * @mutates ctx - `ctx.ui.notify` changes displayed Pi notification state on completion failures
 *
 * @mutates pi - `sendAdvisorMessage` calls `pi.sendMessage` to append Advisor output
 */
async function runImmediateAdvisor(
  {
    ctx,
    pi,
    config,
    requestedSlug,
  }: ForeignBorrowed<Readonly<{
    ctx: ExtensionCommandContext;
    pi: ExtensionAPI;
    config: AdvisorConfig;
    requestedSlug?: string;
  }>>,
): Promise<void> {
  await ctx.waitForIdle();
  try {
    /**
     * Manual Advisor review result.
     */
    const result = await runAdvisor({
      ctx,
      config,
      ...(requestedSlug === undefined ? {} : { requestedSlug, }),
      ...(ctx.signal
        === undefined ? {} : { signal: ctx.signal, }),
    },);
    sendAdvisorMessage({
      pi,
      result,
    },);
  }
  catch (error) {
    if (ctx.signal
      ?.aborted
      === true) {
      ctx.ui
        .notify(
        'Advisor review cancelled.',
        'warning',
      );
      return;
    }
    ctx.ui
      .notify(
      `Advisor review failed: ${Error.isError(error,) ? error.message : String(error,)}`,
      'error',
    );
  }
}

//endregion Handler
