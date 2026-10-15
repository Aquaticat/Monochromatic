/**
 Failures admitting fixed question definitions or their original answers. @module
 */

/**
 Invalid definition, response attribution, or relation estimate.
 */
export class QuestionSelectionError extends Error {
  /** Stable category retained by native boundary consumers. */
  override readonly name: string = 'QuestionSelectionError';
}
