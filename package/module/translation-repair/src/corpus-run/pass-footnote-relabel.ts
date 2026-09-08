import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  applyFootnoteRelabel,
  footnoteRelabelOf,
} from '../archive-footnote-relabel.ts';
import type { ChunkPair, } from '../chunk-document.ts';

//region Pass footnote relabel
// How the pass applies the archive footnote relabel
// (`archive-footnote-relabel.ts`): read off the first preparation's slices,
// rewrite the archive, and let the caller prepare again over the rewritten
// text. Split out of `pass-prepare.ts` so that file keeps to its two-step
// shape and its line budget.

/**
 * Archive text after the relabel, with whether anything changed and what the
 * artifact's findings should say about it.
 *
 * @example
 * ```ts
 * const relabel: RelabelledArchive = { archiveText, changed: false, findings: [], };
 * ```
 */
export type RelabelledArchive = {
  /**
   * Archive text under the original's labels, or as it came when nothing
   * changed.
   */
  readonly archiveText: string;

  /**
   * Whether the text differs from what came in, so the caller knows to
   * prepare again.
   */
  readonly changed: boolean;

  /**
   * Preparation findings naming what was relabelled or why nothing was.
   */
  readonly findings: readonly string[];
};

/**
 * Rewrites the archive's footnote labels to the original's, read off the
 * paired slices, logging the map or why the archive stands.
 *
 * @param entryId - entry being prepared, for the log
 *
 * @param slices - first preparation's slices
 *
 * @param archiveText - archive text that preparation was over
 *
 * @param l - entry logger
 *
 * @returns Archive text to prepare again over when changed
 *
 * @example
 * ```ts
 * const relabel = relabelArchiveFootnotes({ entryId, slices: firstPaired.prepared.slices, archiveText, l, },);
 * ```
 */
export function relabelArchiveFootnotes(
  {
    entryId,
    slices,
    archiveText,
    l,
  }: {
    readonly entryId: string;
    readonly slices: readonly ChunkPair[];
    readonly archiveText: string;
    readonly l: Logger;
  },
): RelabelledArchive {
  /**
   * What the slices say about the labels.
   */
  const reading = footnoteRelabelOf({ slices, },);
  if (reading.kind === 'unchanged') {
    l.debug(`${relabelArchiveFootnotes.name}: entry ${entryId} archive footnote labels agree with the original's`,);
    return {
      archiveText,
      changed: false,
      findings: [],
    };
  }
  if (reading.kind === 'ambiguous') {
    l.warn(
      `FOOTNOTES entry=${entryId} archive labels stand, since the slices disagree: ${reading.detail}`,
    );
    return {
      archiveText,
      changed: false,
      findings: [ `footnotes: archive labels stand, since the slices disagree: ${reading.detail}`, ],
    };
  }
  /**
   * The map, spelled for the log and the finding.
   */
  const spelled = reading.map
    .map(function spell(relabel,): string {
      return `[^${relabel.from}]->[^${relabel.to}]`;
    },)
    .join(', ',);
  l.info(
    `FOOTNOTES entry=${entryId} relabelled ${spelled}: the archive's footnote labels follow the original's`,
  );
  return {
    archiveText: applyFootnoteRelabel({
      text: archiveText,
      map: reading.map,
    },),
    changed: true,
    findings: [ `footnotes: archive relabelled ${spelled} to follow the original's labels`, ],
  };
}

//endregion Pass footnote relabel
