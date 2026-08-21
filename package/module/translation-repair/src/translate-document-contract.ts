import type { LaneSliceText, } from './lane-slice-text.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import type { TranslateAbsenceReason, } from './translate-absence.ts';
import type { SliceAlignmentAssessment, } from './translate-alignment.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';
import type { SliceSelection, } from './slice-selection.ts';

//region Translate document contract
// What the translate lane stores per slice, and what it returns per document.
//
// SEPARATE FROM THE REPAIR CONTRACT on purpose. A repair outcome carries
// issues, repair regions, resolved issue ids and checker verdicts, none of
// which a translation has; a widened type would give every translate slice
// fields that can only be filled with lies, and a widened cache guard would let
// a repair-shape slice resume into a translate run, which nothing downstream
// could detect.

/**
 * Schema of one stored translate slice.
 *
 * Starts at ONE rather than continuing the repair cache's numbering: the two
 * lanes version independently, so a translate change cannot invalidate settled
 * repair work and a repair change cannot invalidate settled translations.
 *
 * Bump for any change to what a record means: the record shape, the decision
 * kinds, the alignment predicate, or what the lane asks the models.
 *
 * VERSION 2, on 2026-08-15, takes the SLICE INDEX out of the key. No record
 * changed; what changed is which slices count as the same slice. Keeping the
 * index meant any renumbering discarded every slice after it, and `#100`
 * renumbers by design, since inserting a slice for an untranslated section
 * shifts everything below it. The index is now stamped onto a resumed record by
 * whoever asked for it, and `translateSliceKey` carries the measurement saying
 * identical-text slices inside one document do not occur in this corpus.
 *
 * VERSION 3, the same day, puts the INCUMBENT KIND into the key, because what a
 * run ASKS about a slice with no translation is a different question: it must
 * be filled or left as the gap it is, while a slice that has one may settle on
 * what is already there. The bump discards nothing, measured before the change:
 * no record had been settled under version 2 at all.
 *
 * VERSION 4, on 2026-08-20, for the declared-name guard. Every slice cached
 * before it was settled without that check, so a resumed run would ship a
 * replacement that dropped a declared name rather than re-deciding it. A guard
 * any cache hit can walk past is not a guard.
 */
export const TRANSLATE_SLICE_CACHE_VERSION = 4;

/**
 * Models the translate lane seats.
 *
 * @example
 * ```ts
 * const models: TranslateModels = { translatorModelIds, judgeModelIds, };
 * ```
 */
export type TranslateModels = {
  /**
   * Models producing independent translations of each slice.
   */
  readonly translatorModelIds: readonly SyntheticModelId[];

  /**
   * Whole roster judging the slate, translators included; a ballot for a
   * judge's own translation counts less rather than not at all.
   */
  readonly judgeModelIds: readonly SyntheticModelId[];
};

/**
 * What the driver did with one slice's stage result.
 *
 * @example
 * ```ts
 * const disposition: TranslateDisposition = 'refused-alignment';
 * ```
 */
export type TranslateDisposition =
  /**
   * Stage result taken as it stands.
   */
  | 'stage-result'
  /**
   * Stage wanted to replace the incumbent and the alignment guard refused,
   * because the source cannot account for the text being replaced.
   */
  | 'refused-alignment'
  /**
   * Stage wanted to replace the incumbent and the quote guard refused, because
   * the replacement carried fewer quoted passages than the archive does.
   */
  | 'refused-quote-loss'
  /**
   * Stage wanted to replace the incumbent and the declared-name guard refused,
   * because the replacement dropped a name the archive text carried and the
   * documents declare.
   */
  | 'refused-declared-name';

/**
 * Settled record for one translate slice.
 *
 * Carries the WHOLE stage result beside the driver's decision, so a reader can
 * tell "judges preferred a replacement and the guard refused it" from "judges
 * kept the incumbent". Those are opposite facts about the same lane and both
 * ship the same text.
 *
 * @example
 * ```ts
 * const changed = record.outputText !== incumbentText;
 * ```
 */
export type TranslateSliceRecord = {
  /**
   * Lane discriminator, checked when a cache file is read so a repair outcome
   * can never be resumed as a translation.
   */
  readonly kind: 'translate-slice';

  /**
   * Schema this record was written under.
   */
  readonly schemaVersion: number;

  /**
   * Global slice index, as preparation stamped it.
   */
  readonly chunkIndex: number;

  /**
   * Everything the stage decided, including the slate, every ballot and its
   * findings.
   */
  readonly stageResult: TranslateStageResult;

  /**
   * Text the driver accepted for assembly.
   */
  readonly outputText: string;

  /**
   * Whether that text differs from the translation already in the archive.
   */
  readonly changed: boolean;

  /**
   * What the driver did with the stage result.
   */
  readonly disposition: TranslateDisposition;

  /**
   * Declared forms the replacement dropped, when that is why it was refused.
   *
   * STORED, unlike the alignment refusal's sentence, because these forms name
   * no slice index and so survive a record being resumed at a different
   * position. The reporter has no preparation to recompute them from.
   */
  readonly droppedDeclaredNames?: readonly string[];

  /**
   * Measurements behind the alignment decision, recorded on every slice rather
   * than only refused ones: a rate needs its denominator.
   */
  readonly alignment: SliceAlignmentAssessment;

  /**
   * Stage findings plus any refusal this driver added.
   */
  readonly findings: readonly string[];
};

/**
 * One passage this run left missing, with why and what it heard.
 *
 * @example
 * ```ts
 * const unfilled: UnfilledSlice = { chunkIndex: 4, reason: 'no-candidate', findings, };
 * ```
 */
export type UnfilledSlice = {
  /**
   * Slice the archive has no translation for.
   */
  readonly chunkIndex: number;

  /**
   * Why this run produced none either.
   */
  readonly reason: TranslateAbsenceReason;

  /**
   * What the stage gathered before it gave up: which translators were heard,
   * what collapsed, what the judges counted.
   *
   * ALSO IN {@link TranslateDocumentResult.findings}, deliberately. The flat
   * list is what a corpus-wide count reads, and this is what says which passage
   * each finding belongs to; neither answers the other's question.
   */
  readonly findings: readonly string[];
};

/**
 * Result of translating one whole document.
 *
 * Has no partial variant. A lane that ran out of time throws, leaving its
 * settled slices in the cache for the next attempt, because a result reporting
 * unvisited slices as unchanged is indistinguishable from a document that
 * needed no translation.
 *
 * @example
 * ```ts
 * const { translatedText, changedSliceCount, } = await translateDocument({ ... },);
 * ```
 */
export type TranslateDocumentResult = {
  /**
   * Translation rebuilt from accepted per-slice text.
   */
  readonly translatedText: string;

  /**
   * Slices preparation produced, which every count below is out of.
   */
  readonly sliceCount: number;

  /**
   * Slices whose accepted text SHIPPED, which is what the document carries.
   *
   * Counted after assembly rather than from the records, because the footnote
   * guard can withdraw a replacement the judges chose: a record saying it
   * changed and a document carrying the archive's text are both true, and this
   * count belongs to the document.
   */
  readonly changedSliceCount: number;

  /**
   * Slices where the alignment guard refused a replacement the judges chose.
   */
  readonly refusedSliceCount: number;

  /**
   * Slices whose replacement was withdrawn at assembly.
   *
   * Three causes, and the findings are what tell them apart: a footnote the
   * assembly would have left worse than the archive's, a structural regression
   * no identifier names, and a surviving set that reassembles to the archive
   * text exactly. The last one withdraws replacements nothing is wrong with,
   * because a document identical to the archive carries no change to name.
   */
  readonly withdrawnSliceCount: number;

  /**
   * Slices the returned document CARRIES a replacement for, in document order.
   *
   * Named rather than counted, because what this lane is measured against is
   * per slice: which slices it replaced, and whether the repair lane touched
   * the same ones. A count answers neither, and re-deriving the set from the
   * records would re-derive it WRONG, since a record says what the slice chose
   * rather than what the document carries.
   */
  readonly shippedChunkIndices: readonly number[];

  /**
   * Who won each slice and whether the document kept it, in document order.
   *
   * The index sets say WHICH slices moved; this says who the text came from
   * and how the judges got there. Every question asked of this lane since it
   * was built is per slice and per producer, and a count answers none of them.
   */
  readonly sliceSelections: readonly SliceSelection[];

  /**
   * Slices whose replacement the assembly guard took back, in document order.
   *
   * Ordered by `orderedChangeSets` rather than left in the order the guard
   * worked, so a reader joining two lanes slice by slice reads both sets by one
   * rule. Disjoint from {@link TranslateDocumentResult.shippedChunkIndices} by
   * construction, and the same fact
   * {@link TranslateDocumentResult.withdrawnSliceCount} counts.
   */
  readonly withdrawnChunkIndices: readonly number[];

  /**
   * Slices resumed from the cache rather than translated this run, so a cheap
   * run is distinguishable from a lane that found nothing to do.
   */
  readonly resumedSliceCount: number;

  /**
   * Whether this document is a whole translation.
   *
   * READ THIS BEFORE {@link TranslateDocumentResult.translatedText}. A result
   * whose status is `unfilled` carries a document with passages the archive
   * never translated and this run could not either, so publishing it or
   * comparing it against a complete one measures something else. The field
   * exists because the gaps were nameable and still missable: a consumer
   * reading only the old fields would have seen an ordinary success.
   */
  readonly status: 'complete' | 'unfilled';

  /**
   * Slices with NO translation in the archive that this run could not fill, in
   * document order, each with the reason and the evidence.
   *
   * A different thing from every other set here, and the reason it is its own
   * field. A slice that is unshipped, unwithdrawn and unchanged elsewhere in
   * this result means the judges looked and kept the archive's wording; these
   * slices have no archive wording to keep, so the document carries the gap it
   * came with. They settle no record and cache nothing, so the next run asks
   * again.
   *
   * STRUCTURED RATHER THAN A LIST OF INDICES, because the evidence has to have
   * an owner: several unfilled slices flatten their stage findings into one
   * document-level list, where nothing says which passage each belongs to.
   */
  readonly unfilled: readonly UnfilledSlice[];

  /**
   * One settled record per slice, in document order.
   *
   * SHORTER THAN THE SLICE COUNT when {@link TranslateDocumentResult.unfilled}
   * names any slice, since a slice that produced nothing settles no record.
   */
  readonly slices: readonly TranslateSliceRecord[];

  /**
   * What this lane DECIDED for every prepared slice, beside the archive's own
   * wording, in document order.
   *
   * Built at the document level rather than stored on
   * {@link TranslateDocumentResult.slices}, which are CACHE records: an
   * incumbent belongs to a preparation, and a slice resumed from an earlier run
   * would otherwise serve the wording that preparation had then. Carries no
   * shipped flag for the same reason, since whether a slice shipped is decided
   * by an assembly guard reading the whole document and can differ between two
   * runs of the same slice.
   */
  readonly sliceTexts: readonly LaneSliceText[];

  /**
   * Every slice's findings, flattened for the artifact.
   */
  readonly findings: readonly string[];
};

//endregion Translate document contract
