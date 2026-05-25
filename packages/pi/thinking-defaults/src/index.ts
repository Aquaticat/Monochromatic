/**
 * Pi extension entry point for model-aware thinking defaults.
 *
 * GPT-shaped models use `xhigh`; every other selected model uses `high`.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
} from '@earendil-works/pi-coding-agent';
import { applyThinkingDefault, } from './apply-thinking-default.ts';
import { restoreGlobalDefaultThinkingLevel, } from './global-settings.ts';
import type { ThinkingDefaultLevel, } from './model-policy.ts';

//region Types

/** Minimal model-selection event shape used by the thinking policy. */
type ModelSelectEventLike = {
  /** Newly selected model from pi's `model_select` event. */
  model: {
    /** Model identifier. */
    id: string;
  };
};

/** Dependencies used while registering the extension. */
type RegisterThinkingDefaultsOptions = {
  /** Pi extension API. */
  pi: ExtensionAPI;
  /** Restores persisted scalar thinking default after active-level changes. */
  restoreDefaultThinkingLevel?: () => boolean;
};

//endregion Types

//region Extension entry point

/**
 * Registers thinking-defaults event handlers.
 *
 * @param pi - pi extension API
 *
 * @param restoreDefaultThinkingLevel - settings restorer dependency
 *
 * @example
 * ```typescript
 * registerThinkingDefaults({ pi });
 * ```
 */
export function registerThinkingDefaults(
  {
    pi,
    restoreDefaultThinkingLevel = restoreGlobalDefaultThinkingLevel,
  }: RegisterThinkingDefaultsOptions,
): void {
  /**
   * Reads the active pi thinking level.
   *
   * @returns current pi thinking level
   *
   * @example
   * ```typescript
   * getCurrentThinkingLevel(); // 'high'
   * ```
   */
  function getCurrentThinkingLevel(): string {
    return pi.getThinkingLevel();
  }

  /**
   * Sets the active pi thinking level.
   *
   * @param level - policy-selected thinking default
   *
   * @example
   * ```typescript
   * setCurrentThinkingLevel('xhigh');
   * ```
   */
  function setCurrentThinkingLevel(level: ThinkingDefaultLevel,): void {
    pi.setThinkingLevel(level,);
  }

  /**
   * Applies the thinking policy to the model held by the current context.
   *
   * @param event - session-start event, unused because context carries model
   *
   * @param ctx - extension context with current model
   *
   * @example
   * ```typescript
   * handleSessionStart({ event: { type: 'session_start', reason: 'startup' }, ctx });
   * ```
   */
  function handleSessionStart(
    {
      event: _event,
      ctx,
    }: {
      event: SessionStartEvent;
      ctx: ExtensionContext;
    },
  ): void {
    /** Thinking application result for the session-start context model. */
    const result = applyThinkingDefault({
      model: ctx.model,
      getThinkingLevel: getCurrentThinkingLevel,
      setThinkingLevel: setCurrentThinkingLevel,
    },);
    if (result.target
      !== undefined)
      restoreDefaultThinkingLevel();
  }

  /**
   * Applies the thinking policy to the newly selected model.
   *
   * @param event - model-selection event carrying next model
   *
   * @param ctx - extension context, unused because event carries model
   *
   * @example
   * ```typescript
   * handleModelSelect({ event: { type: 'model_select', model }, ctx });
   * ```
   */
  function handleModelSelect(
    {
      event,
      ctx: _ctx,
    }: {
      event: ModelSelectEventLike;
      ctx: ExtensionContext;
    },
  ): void {
    /** Thinking application result for the newly selected model. */
    const result = applyThinkingDefault({
      model: event.model,
      getThinkingLevel: getCurrentThinkingLevel,
      setThinkingLevel: setCurrentThinkingLevel,
    },);
    if (result.target
      !== undefined)
      restoreDefaultThinkingLevel();
  }

  pi.on(
    'session_start',
    function onSessionStart(
      event,
      ctx,
    ) {
      handleSessionStart({
        event,
        ctx,
      },);
    },
  );
  pi.on(
    'model_select',
    function onModelSelect(
      event,
      ctx,
    ) {
      handleModelSelect({
        event,
        ctx,
      },);
    },
  );
}

/**
 * Thinking defaults pi extension.
 *
 * Subscribes to session and model-selection events so restored sessions,
 * startup defaults, `/model`, and Ctrl+P cycling all receive the same policy.
 * Manual thinking-level changes remain untouched until the next session start
 * or model selection.
 *
 * @param pi - pi extension API
 *
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * // { "packages": ["./packages/pi/thinking-defaults"] }
 * ```
 */
export default function thinkingDefaults(pi: ExtensionAPI,): void {
  registerThinkingDefaults({ pi, },);
}

//endregion Extension entry point
