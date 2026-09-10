import type { SelectEvidence, } from './candidate-select-wire.ts';

/**
 * Supplies factual support without making neighboring passages additional translation obligations.
 *
 * @param neighbouringSourceText - local source evidence for interpreting current claims
 *
 * @param documentSourceText - same-entry original checking claims outside the local window
 *
 * @returns Additional evidence blocks in the measured order
 *
 * @example
 * ```ts
 * const evidence = repairSelectionSourceEvidence({ neighbouringSourceText, documentSourceText });
 * ```
 */
export function repairSelectionSourceEvidence(
  {
    neighbouringSourceText,
    documentSourceText,
  }: {
    readonly neighbouringSourceText?: string;
    readonly documentSourceText?: string;
  },
): readonly SelectEvidence[] {
  return [
    ...((neighbouringSourceText === undefined) || (neighbouringSourceText === '')
      ? []
      : [{
        label: 'NEARBY ORIGINAL, source evidence for the current passage rather than additional coverage',
        text: neighbouringSourceText,
      },]),
    ...((documentSourceText === undefined) || (documentSourceText === '')
      ? []
      : [{
        label: 'FULL ORIGINAL DOCUMENT, factual evidence only: use it to check current claims without requiring the rest of this document to be translated in this passage',
        text: documentSourceText,
      },]),
  ];
}
