import type { SliceSyntax, } from './chunk-document.ts';
import { renderedBreakPrompt, } from './rendered-break-prompt.ts';
import { translateSelectionCriteria, } from './translate-selection-sheet.ts';
import type { TranslateSlateEntry, } from './translate-slate.ts';

/**
 * Adds rendered-structure evidence to the actual anonymous slate's criteria.
 * The original criteria object survives unchanged where no extra evidence is due.
 *
 * @param sourceText - exact original, excluding supplemental evidence
 *
 * @param archiveText - canonical archive wording, not a generated standing
 *
 * @param lineStructured - existing blank-separated verse-unit fact
 *
 * @param syntax - dedicated metadata grammar when present
 *
 * @param slate - recorded order also given to the judge renderer
 *
 * @returns Selection criteria with source-only rendered facts when applicable
 *
 * @example
 * ```ts
 * const criteria = translatedSlateCriteria({ sourceText, archiveText, lineStructured, slate });
 * ```
 */
export function translatedSlateCriteria(
  {
    sourceText,
    archiveText,
    lineStructured,
    syntax,
    slate,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly lineStructured: boolean;
    readonly syntax?: SliceSyntax;
    readonly slate: readonly TranslateSlateEntry[];
  },
): readonly string[] {
  /**
   * Existing criteria retain their established precedence.
   */
  const criteria = translateSelectionCriteria({
    lineStructured,
    ...((syntax === undefined) ? {} : { syntax, }),
  },);
  /**
   * Labels come from the recorded rotated slate, never producer identities.
   */
  const rendered = renderedBreakPrompt({
    sourceText,
    archiveText,
    ...((syntax === undefined) ? {} : { syntax, }),
    renderings: slate.map(function displayed(entry,) {
      return {
        label: `Candidate ${String(entry.index,)}`,
        text: entry.text,
      };
    },),
  },);
  return rendered === '' ? criteria : [
    ...criteria,
    rendered,
  ];
}
