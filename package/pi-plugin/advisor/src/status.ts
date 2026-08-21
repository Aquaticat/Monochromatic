/**
 * Advisor status rendering for slash-command inspection.
 *
 * @module
 */

import type { ExtensionCommandContext, } from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { buildAdvisorSystemPrompt, } from './advisor-client.ts';
import { maxContextCharsForAdvisorModel, } from './context.ts';
import { resolveEffectiveScope, } from '@monochromatic-dev/pi-shared-model-selection/ts';
import { filterAdvisorScopeByOutputCapacity, } from './output-eligibility.ts';
import { selectAdvisorModel, } from './advisor-selection.ts';
import type { AdvisorConfig, } from './types.ts';

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
  }: {
    readonly ctx: ForeignHostCapability<ExtensionCommandContext>;
    readonly config: AdvisorConfig;
    readonly enabled: boolean;
  },
): Promise<string> {
  /**
   * Effective model scope for status.
   */
  const scope = await resolveEffectiveScope({
    ctx,
    errorPrefix: 'advisor',
  },);
  /**
   * Scoped models whose endpoints advertise configured output capacity.
   */
  const eligibleScope = filterAdvisorScopeByOutputCapacity({
    scope,
    maxAdvisorOutputTokens: config.maxAdvisorOutputTokens,
  },);
  /**
   * Empty-context default ranking for status display.
   */
  const defaultSelection = eligibleScope.entries
    .length
    === 0
    ? undefined
    : selectAdvisorModel({
      scope: eligibleScope,
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
    `Eligible Advisor models (>=${
      String(config.maxAdvisorOutputTokens,)
    } output tokens): ${
      eligibleScope.entries
        .length
        === 0 ? 'none' : eligibleScope
        .entries
          .map(function mapEligibleEntry(
            entry: ReadonlyDeep<(typeof eligibleScope.entries)[number]>,
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
