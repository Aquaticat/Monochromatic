/**
 * Pi extension entry point for model-aware thinking defaults.
 *
 * GPT-shaped models use `xhigh`; other selected models use `xhigh` when the
 * model supports it and `high` otherwise.
 *
 * @module
 */

import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { applyThinkingDefault, } from './apply-thinking-default.ts';
import { restoreGlobalDefaultThinkingLevel, } from './global-settings.ts';
import type {
  ModelWithId,
  ThinkingDefaultLevel,
} from './model-policy.ts';

//region Types

/**
 * Dependencies used while registering the extension.
 */
type RegisterThinkingDefaultsOptions = {
  /**
   * Pi extension API.
   */
  readonly pi: ForeignBorrowed<ExtensionAPI>;
  /**
   * Restores persisted scalar thinking default after active-level changes.
   */
  readonly restoreDefaultThinkingLevel?: () => Promise<boolean>;
};

/**
 * Session-start event surface consumed by this extension.
 */
type SessionStartEvent = Readonly<{
  /**
   * Event discriminant.
   */
  type: 'session_start';
}>;

/**
 * Model-selection event surface consumed by this extension.
 */
type ModelSelectEvent = Readonly<{
  /**
   * Newly selected model used by thinking policy.
   */
  model: ModelWithId;
}>;

//endregion Types

//region Extension entry point

/**
 * Registers thinking-default event handlers, applying levels through
 * {@link applyThinkingDefault}.
 *
 * @param pi - pi extension API
 *
 * @param restoreDefaultThinkingLevel - settings restorer dependency; defaults to {@link restoreGlobalDefaultThinkingLevel}
 *
 * @mutates pi - `pi.on` registers lifecycle handlers and `pi.setThinkingLevel` changes active host state
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
    async function onSessionStart(
      _event: Readonly<SessionStartEvent>,
      ctx,
    ) {
      /**
       * Current model carried by the session-start context.
       */
      const { model, } = ctx;
      if (model === undefined)
        return;
      /**
       * Thinking application result for the session-start context model.
       */
      const result = applyThinkingDefault({
        model,
        getThinkingLevel: getCurrentThinkingLevel,
        setThinkingLevel: setCurrentThinkingLevel,
      },);
      if (result.target
        !== undefined)
        await restoreDefaultThinkingLevel();
    },
  );
  pi.on(
    'model_select',
    async function onModelSelect(event: Readonly<ModelSelectEvent>,) {
      /**
       * Thinking application result for the newly selected model.
       */
      const result = applyThinkingDefault({
        model: event.model,
        getThinkingLevel: getCurrentThinkingLevel,
        setThinkingLevel: setCurrentThinkingLevel,
      },);
      if (result.target
        !== undefined)
        await restoreDefaultThinkingLevel();
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
 * Delegates registration to {@link registerThinkingDefaults}.
 *
 * @param pi - pi extension API
 *
 * @mutates pi - `registerThinkingDefaults` delegates `pi.on` registration and `pi.setThinkingLevel` updates
 *
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * // { "packages": ["./packages/pi-plugin/thinking-default"] }
 * ```
 */
export default function thinkingDefaults(pi: ForeignBorrowed<ExtensionAPI>,): void {
  registerThinkingDefaults({ pi, },);
}

//endregion Extension entry point
