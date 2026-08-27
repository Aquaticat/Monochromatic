import { foldInvisibleVariants, } from '../invisible-variants.ts';

//region Pass archive
// Archive English enters every pass stage through one visible-byte transform.

/**
 * Normalizes archive bytes before preparation and every downstream decision.
 *
 * @param text - archive English as stored in corpus
 *
 * @returns Text with invisible variants replaced by visible counterparts
 *
 * @example
 * ```ts
 * const archive = passArchiveText({ text: 'non\u2011binary', });
 * ```
 */
export function passArchiveText({ text, }: { readonly text: string; },): string {
  return foldInvisibleVariants({ text, }).text;
}

//endregion Pass archive
