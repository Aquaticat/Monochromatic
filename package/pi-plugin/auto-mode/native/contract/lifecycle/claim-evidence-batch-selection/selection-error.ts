/** Failures admitting fixed question definitions or their original answers. @module */

/** Invalid definition, response attribution, or relation estimate. */
export class QuestionSelectionError extends Error {
  override readonly name: string = 'QuestionSelectionError';
}
