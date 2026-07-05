/**
 * Applies model-aware thinking defaults through pi's thinking API.
 *
 * @module
 */

import {
  getThinkingDefaultForModel,
  type ModelWithId,
  type ThinkingDefaultLevel,
} from './model-policy.ts';

//region Types

/**
 * Result returned after applying, or skipping, a thinking default.
 */
export type ApplyThinkingDefaultResult = {
  /**
   * Whether `setThinkingLevel` was called.
   */
  changed: boolean;
  /**
   * Target level derived from the model, absent when no model is available.
   */
  target?: ThinkingDefaultLevel;
};

/**
 * Dependencies needed by {@link applyThinkingDefault}.
 */
type ApplyThinkingDefaultOptions = {
  /**
   * Current model; absent when pi has not selected one yet.
   */
  readonly model?: ModelWithId;
  /**
   * Reads pi's current thinking level.
   */
  readonly getThinkingLevel: () => string;
  /**
   * Sets pi's current thinking level.
   */
  readonly setThinkingLevel: (level: ThinkingDefaultLevel,) => void;
};

//endregion Types

//region Application

/**
 * Applies the policy-selected thinking level for a model, as chosen by
 * {@link getThinkingDefaultForModel}.
 *
 * Missing models are ignored because pi can emit startup events before a model
 * is available. Matching current and target levels are also ignored to avoid
 * emitting redundant `thinking_level_select` events.
 *
 * @param options - model and pi thinking accessors
 *
 * @returns result describing whether a set call occurred
 *
 * @example
 * ```typescript
 * applyThinkingDefault({
 *   model: { id: 'gpt-5.5' },
 *   getThinkingLevel: () => 'high',
 *   setThinkingLevel: level => console.log(level),
 * });
 * ```
 */
export function applyThinkingDefault(
  options: ApplyThinkingDefaultOptions,
): ApplyThinkingDefaultResult {
  /**
   * Model selected in pi at the event boundary.
   */
  const { model, } = options;
  if (model === undefined)
    return { changed: false, };

  /**
   * Target level selected by model-id policy.
   */
  const target = getThinkingDefaultForModel({ model, },);
  /**
   * Current level read from pi before deciding whether to write.
   */
  const current = options.getThinkingLevel();
  if (current === target) {
    return {
      changed: false,
      target,
    };
  }

  options.setThinkingLevel(target,);
  return {
    changed: true,
    target,
  };
}

//endregion Application
