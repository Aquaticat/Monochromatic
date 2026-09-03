import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import { foldInvisibleVariants, } from '../invisible-variants.ts';
import { stripStubMarkers, } from './archive-stub.ts';

//region Pass archive
// Archive English enters every pass stage through one transform: the
// invisible-variant fold, then the stub-marker strip (`archive-stub.ts`), in
// that order so a marker spelled with an invisible variant is folded before it
// is read. Preparation, both lanes, the artifact's stored archive and the
// published page all describe the text this returns, so no later check has to
// know a marker was ever there.

/**
 * Normalizes archive bytes before preparation and every downstream decision.
 *
 * @param text - archive English as stored in corpus
 *
 * @param l - entry logger, which records every stub marker removed so a run's
 * log witnesses it
 *
 * @returns Text with invisible variants replaced by visible counterparts and
 * placeholder paragraphs removed
 *
 * @example
 * ```ts
 * const archive = passArchiveText({ text: 'non‑binary', l, });
 * ```
 */
export function passArchiveText(
  {
    text,
    l,
  }: {
    readonly text: string;
    readonly l: Logger;
  },
): string {
  /**
   * Visible text from shared fold.
   */
  const { text: folded, } = foldInvisibleVariants({ text, },);
  /**
   * Folded text without placeholder paragraphs, and what was removed.
   */
  const {
    text: stripped,
    stripped: markers,
  } = stripStubMarkers({ text: folded, },);
  for (const marker of markers) {
    l.warn(
      `archive: stripped stub marker ${JSON.stringify(marker.text,)} at line ${String(marker.lineNumber,)}: a `
        + 'placeholder is not content the ORIGINAL carries '
        + '(doc/decision/translation-repair-good-result-over-bad-original.md)',
    );
  }
  return stripped;
}

//endregion Pass archive
