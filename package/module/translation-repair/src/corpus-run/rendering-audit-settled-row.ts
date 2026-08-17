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
 * Joins the parts of a composite key over these rows.
 *
 * NUL, WRITTEN AS AN ESCAPE so it is visible in source. A run set, an entry id
 * and a slice index are joined into one string wherever rows are grouped, and
 * any separator that can occur inside a part makes two different tuples collide
 * on one key. NUL cannot occur in any of them.
 *
 * ONE CONSTANT, SHARED, because the failure mode here is two key builders that
 * disagree. That has already happened once in this package, between a NUL and a
 * space, and every fixture that spelled its own key passed while no live run
 * ever paired anything.
 */
export const SLOT_SEPARATOR = '\u0000';

/**
 * Digests of the exact two texts one audit was shown.
 *
 * A TAGGED ABSENCE rather than two optional strings, because the question a
 * reader asks of this field is whether two rows audited the SAME characters,
 * and a missing digest must answer "cannot say" rather than compare equal to
 * another missing digest. Rows persisted before this field existed carry
 * nothing here, and pairing them by slot alone would assert text identity from
 * index equality, which is the assumption the field was added to stop.
 *
 * @example
 * ```ts
 * const identity: AuditedTextIdentity = { kind: 'digested', source, candidate, };
 * ```
 */
export type AuditedTextIdentity = {
  readonly kind: 'digested';

  /**
   * Original this audit read.
   */
  readonly source: string;

  /**
   * Rendering it judged.
   */
  readonly candidate: string;
} | {
  readonly kind: 'unrecorded';
};

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
   * What this audit was actually shown, by digest.
   *
   * Carries NO TEXT. The corpus is licensed material that leaves this machine
   * only for the production provider, and a run file is read, quoted and pasted
   * freely. A digest answers the one question a reading needs, which is whether
   * two rows saw identical characters, and answers nothing else.
   */
  readonly textIdentity: AuditedTextIdentity;

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
