/**
 * Model-id policy for choosing pi thinking defaults.
 *
 * @module
 */

import { getModelIdLeaf, } from '@monochromatic-dev/pi-shared-model-selection/ts';

export { getModelIdLeaf, } from '@monochromatic-dev/pi-shared-model-selection/ts';

//region Thinking default constants

/**
 * Thinking levels this extension writes as defaults.
 */
export type ThinkingDefaultLevel = 'high' | 'xhigh';

/**
 * Thinking level used for GPT-shaped model ids.
 */
const GPT_THINKING_DEFAULT: ThinkingDefaultLevel = 'xhigh';

/**
 * Thinking level used for all non-GPT model ids.
 */
const NON_GPT_THINKING_DEFAULT: ThinkingDefaultLevel = 'high';

//endregion Thinking default constants

//region Model shapes

/**
 * Minimal model shape needed by the thinking policy.
 */
type ModelWithId = {
  /**
   * Model identifier as passed through pi.
   */
  readonly id: string;
};

//endregion Model shapes

//region Model id helpers

/**
 * Detects whether a model id is GPT-shaped.
 *
 * A model is GPT-shaped when the final slash-delimited segment, taken via
 * {@link getModelIdLeaf}, starts with `gpt-` after lowercasing. Other
 * provider separators are intentionally not special-cased.
 *
 * @param modelId - model id to inspect
 *
 * @returns whether the model id leaf starts with `gpt-`
 *
 * @example
 * ```typescript
 * isGptModelId({ modelId: 'openai/gpt-5.5' }); // true
 * ```
 */
export function isGptModelId(
  {
    modelId,
  }: {
    readonly modelId: string;
  },
): boolean {
  /**
   * Lowercased final segment used for case-insensitive GPT detection.
   */
  const normalizedLeaf = getModelIdLeaf({ modelId, },)
    .toLowerCase();
  return normalizedLeaf.startsWith('gpt-',);
}

/**
 * Returns the desired thinking default for a model, delegating the GPT check
 * to {@link isGptModelId}.
 *
 * GPT-shaped ids get `xhigh`; every other id gets `high`.
 *
 * @param model - model with an id field from pi
 *
 * @returns thinking level target for that model
 *
 * @example
 * ```typescript
 * getThinkingDefaultForModel({ model: { id: 'gpt-5.5' } }); // 'xhigh'
 * ```
 */
export function getThinkingDefaultForModel(
  {
    model,
  }: {
    readonly model: ModelWithId;
  },
): ThinkingDefaultLevel {
  if (isGptModelId({ modelId: model.id, },))
    return GPT_THINKING_DEFAULT;
  return NON_GPT_THINKING_DEFAULT;
}

//endregion Model id helpers

export {
  GPT_THINKING_DEFAULT,
  NON_GPT_THINKING_DEFAULT,
};
