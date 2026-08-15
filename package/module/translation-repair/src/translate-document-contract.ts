import type { SyntheticModelId, } from './synthetic-catalog.ts';
import type { SliceAlignmentAssessment, } from './translate-alignment.ts';
import type { TranslateStageResult, } from './translate-stage.ts';

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
 */
export const TRANSLATE_SLICE_CACHE_VERSION = 1;

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
  | 'refused-alignment';

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
   * Slices whose replacement was withdrawn at assembly to keep the footnote
   * graph no worse than the archive's.
   */
  readonly withdrawnSliceCount: number;

  /**
   * Slices resumed from the cache rather than translated this run, so a cheap
   * run is distinguishable from a lane that found nothing to do.
   */
  readonly resumedSliceCount: number;

  /**
   * One settled record per slice, in document order.
   */
  readonly slices: readonly TranslateSliceRecord[];

  /**
   * Every slice's findings, flattened for the artifact.
   */
  readonly findings: readonly string[];
};

//endregion Translate document contract
