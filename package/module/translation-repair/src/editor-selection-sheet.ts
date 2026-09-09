//region Editor selection sheet
// Task and criteria the two editor selections put to the judges, apart from
// `editor-ensemble.ts` at the line cap on 2026-09-09 when the community
// glossary reached the select sheet.

/**
 * What the per-envelope selection asks.
 */
export const ENVELOPE_SELECTION_TASK =
  'Each candidate replaces the SAME passage of an English translation of the Chinese ORIGINAL below.';

/**
 * How the per-envelope selection decides, earlier criteria outranking later.
 */
export const ENVELOPE_SELECTION_CRITERIA: readonly string[] = [
  'Faithfulness to the ORIGINAL: no content added, dropped, or altered in meaning.',
  'Natural, idiomatic English that carries the ORIGINAL\'s feeling.',
  'Fits the surrounding text in register and tense.',
];

/**
 * What the whole-chunk selection asks.
 */
export const CHUNK_SELECTION_TASK =
  'Each candidate is a full English translation of the Chinese ORIGINAL below, after repairs were applied.';

/**
 * How the whole-chunk selection decides, earlier criteria outranking later.
 */
export const CHUNK_SELECTION_CRITERIA: readonly string[] = [
  'Faithfulness to the ORIGINAL: no content added, dropped, or altered in meaning.',
  'Natural, idiomatic English reading as one coherent passage, not as stitched fragments.',
  'Consistent voice, tense, and terminology across the whole passage.',
];

//endregion Editor selection sheet
