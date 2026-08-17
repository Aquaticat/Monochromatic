import type { RenderingAuditReport, } from '../rendering-audit.ts';

//region Settled audit row
// What one audited slice becomes on disk.
//
// ITS OWN MODULE so the probe that writes rows and the reading that interprets
// them can share a shape without the reading importing the probe. Importing the
// probe would drag in a model client and a roster to read a file that is
// already on disk, and a reading that costs quota to run is a reading nobody
// runs twice.

/**
 * One audited slice, with everything needed to say which decision it describes.
 *
 * @example
 * ```ts
 * const row: SettledAuditRow = { runSet, entryId, chunkIndex, report, ... };
 * ```
 */
export type SettledAuditRow = {
  /**
   * Archive subdirectory, which is the only thing separating two runs of one
   * entry: both write a file named for the entry.
   */
  readonly runSet: string;

  /**
   * Corpus entry.
   */
  readonly entryId: string;

  /**
   * Global slice index.
   */
  readonly chunkIndex: number;

  /**
   * What the lane's document carries here.
   */
  readonly deliveryKind: string;

  /**
   * Whether this audited the archive's own English rather than a fresh
   * rendering, which is the split every aggregate must respect.
   */
  readonly auditsArchiveText: boolean;

  /**
   * Built output that produced the decision under audit.
   */
  readonly artifactDigest: string;

  /**
   * Corpus commit the pair was read at.
   */
  readonly corpusSha: string;

  /**
   * Whether the producing run had declared names to pass on.
   */
  readonly identityKind: string;

  /**
   * Everything the instrument said, WHOLE and uninterpreted.
   *
   * NOT SUMMARISED INTO COUNTS, which the first two-subject buy was bought to
   * find out. Counts read `corroborated=0 agreed=0 near=1` over two voices
   * claiming two defects each and a third dropping one, and nothing in the file
   * could say WHAT any of them claimed. That leaves three questions
   * unanswerable from the artifact this probe exists to produce: whether the
   * matcher was right to bring nothing together (`#68`), which voice was right
   * when they disagreed (`#66`), and whether a paired omission and addition on
   * adjacent slices is one relocation rather than two defects (`#107`), a rule
   * fixed before the run and unenforceable without categories and spans.
   *
   * Every count a reader wants is derivable from this. None of this is
   * recoverable from the counts.
   */
  readonly report: RenderingAuditReport;
};

//endregion Settled audit row
