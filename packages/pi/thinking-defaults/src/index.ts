/**
 * Pi extension entry point for model-aware thinking defaults.
 *
 * GPT-shaped models use `xhigh`; every other selected model uses `high`.
 *
 * @module
 */

import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import { applyThinkingDefault, } from './apply-thinking-default.ts';
import { restoreGlobalDefaultThinkingLevel, } from './global-settings.ts';
import type { ThinkingDefaultLevel, } from './model-policy.ts';

//region Types

/** Dependencies used while registering the extension. */
type RegisterThinkingDefaultsOptions = {
  /** Pi extension API. */
  readonly pi: ExtensionAPI;
  /** Restores persisted scalar thinking default after active-level changes. */
  readonly restoreDefaultThinkingLevel?: () => boolean;
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

  pi.on(
    'session_start',
    function onSessionStart(
      _event,
      ctx,
    ) {
      /** Current model carried by the session-start context. */
      const { model, } = ctx;
      if (model === undefined)
        return;
      /** Thinking application result for the session-start context model. */
      const result = applyThinkingDefault({
        model,
        getThinkingLevel: getCurrentThinkingLevel,
        setThinkingLevel: setCurrentThinkingLevel,
      },);
      if (result.target
        !== undefined)
        restoreDefaultThinkingLevel();
    },
  );
  pi.on(
    'model_select',
    function onModelSelect(event,) {
      /** Thinking application result for the newly selected model. */
      const result = applyThinkingDefault({
        model: event.model,
        getThinkingLevel: getCurrentThinkingLevel,
        setThinkingLevel: setCurrentThinkingLevel,
      },);
      if (result.target
        !== undefined)
        restoreDefaultThinkingLevel();
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
