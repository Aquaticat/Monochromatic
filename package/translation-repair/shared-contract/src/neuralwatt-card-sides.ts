import type { NeuralWattCard, } from './model-card.ts';

//region NeuralWatt card sides
// NEURALWATT'S SIDE OF THE TWO CARDS IT SERVES, 2026-10-20, kept beside
// `model-cards.ts` rather than in it because that table sits at the package's
// line budget. The figures are `GET https://api.neuralwatt.com/v1/models`
// (public, fetched 2026-10-20): both models list a context of 1,048,560 and
// image input on the standard lane the owner's free daily energy covers
// (`https://docs.neuralwatt.com/billing/daily-free-energy`).
//
// NO HOLD CHANGES WITH THESE SIDES. The holds on both cards were recorded
// before NeuralWatt joined and stay as they were: the owner unseated
// GLM-5.3-Flash as a judge on 2026-09-02, and no transcription of a picture
// has been measured on any stack of DeepSeek V4.1 Flash.

/**
 NeuralWatt's side of the GLM-5.3-Flash card.

 The listing states no output ceiling for this model (`max_output_tokens`
 null), so the context window stands in and the measured completion cap on the
 card applies as it does everywhere else.

 @example
 ```ts
 const side = GLM_5_3_FLASH_ON_NEURALWATT;
 ```
 */
export const GLM_5_3_FLASH_ON_NEURALWATT: NeuralWattCard = {
  id: 'glm-5.3-flash',
  readsImages: true,
  contextLength: 1_048_560,
  maxOutputLength: 1_048_560,
  // LOW ON A PICTURE CALL, 2026-10-21 (XingZ6016). The listing's reasoning is
  // mandatory with `supported_efforts` `max`, `high`, `low` and `default_effort`
  // `max`, so a call that sends no effort reasons at the deepest level, and on a
  // dense 2400 by 2616 screenshot that spent all 18316 completion tokens of the
  // card's cap on 40652 characters of reasoning and wrote no answer. `low` is the
  // shallowest level the model has, hence the one that leaves the most of an
  // unchanged cap for the transcript. NO MEASUREMENT EXISTS FOR EITHER LEVEL:
  // the choice rests on the one failure at `max` and on the listing's ordering,
  // and the first keyed run at `low` is the measurement. A transcription is not
  // a deduction, so the depth is not what the reading needs.
  // Text calls send nothing: the owner's lift covers NeuralWatt, and the energy
  // matrix was measured on the defaults.
  pictureReasoningEffort: 'low',
};

/**
 NeuralWatt's side of the DeepSeek V4.1 Flash card, whose listing states a
 maximum output of 393,216 tokens.

 THE SERVED ID IS ALREADY THE 1017 WEIGHTS. The listing's `huggingface_id`
 for `deepseek-v4.1-flash` reads `deepseek-ai/DeepSeek-V4.1-Flash-1017`
 (`GET https://api.neuralwatt.com/v1/models`, 2026-10-20), so the owner's
 migration to the 1017 weights of the same day changed nothing on this side.

 @example
 ```ts
 const side = DEEPSEEK_V4_1_FLASH_ON_NEURALWATT;
 ```
 */
export const DEEPSEEK_V4_1_FLASH_ON_NEURALWATT: NeuralWattCard = {
  id: 'deepseek-v4.1-flash',
  readsImages: true,
  contextLength: 1_048_560,
  maxOutputLength: 393_216,
};

//endregion NeuralWatt card sides
