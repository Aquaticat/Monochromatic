import type { ChunkPair, } from './chunk-document.ts';
import type { SectionPair, } from './pair-sections-wire.ts';
import type { SectionBlockPairing, } from './section-pairing.ts';

//region Prepared document pair
// The shapes preparation produces, moved out of `document-preparation.ts` at
// its line budget: what a document pair is reduced to, and a target block the
// pairing left without a source claim.

/**
 * Target block pairing roster left without source claim.
 *
 * @example
 * ```ts
 * const block: UnclaimedTargetBlock = {
 *   location: { kind: 'aligned-pair', pairIndex: 0, },
 *   blockId: 'block/2',
 *   startOffset: 41,
 *   endOffset: 73,
 * };
 * ```
 */
export type UnclaimedTargetBlock = {
  /**
   * Alignment location whose source claim is absent.
   */
  readonly location: {
    /**
     * Block sits inside aligned section pair.
     */
    readonly kind: 'aligned-pair';

    /**
     * Aligned pair index.
     */
    readonly pairIndex: number;
  } | {
    /**
     * Whole target section sits outside alignment.
     */
    readonly kind: 'target-section';

    /**
     * Target section index.
     */
    readonly sectionIndex: number;
  };

  /**
   * Stable parser id within target document.
   */
  readonly blockId: string;

  /**
   * First target-text offset owned by block.
   */
  readonly startOffset: number;

  /**
   * Target-text boundary immediately after block.
   */
  readonly endOffset: number;
};

/**
 * A document pair reduced to the slices both lanes run over.
 *
 * @example
 * ```ts
 * const prepared = prepareDocumentPair({ sourceText, targetText, },);
 * ```
 */
export type PreparedDocumentPair = {
  /**
   * Marks body-only slicing rebuilt for artifact generations before five.
   *
   * Current preparations omit it and use metadata-aware identity scheme.
   */
  readonly legacyIdentity?: true;

  /**
   * Original document this preparation was made from.
   */
  readonly sourceText: string;

  /**
   * Translation the target spans and offsets index into.
   *
   * Carried so a lane assembles against the document it was prepared from. A
   * driver handed a preparation and an unrelated translation would splice at
   * offsets that mean nothing there, and produce plausible-looking text.
   */
  readonly targetText: string;

  /**
   * Paragraph-bound slice pairs across every aligned section, indexed globally
   * in document order.
   */
  readonly slices: readonly ChunkPair[];

  /**
   * Slice indexes the line-structure rule governs, inherited from the enclosing
   * chunk rather than decided per slice.
   */
  readonly lineStructuredSliceIndices: ReadonlySet<number>;

  /**
   * Declared names and handles from front matter plus target-authoritative
   * contributor identities, the original's pronoun for its subject, the notes
   * both documents carry and any web-lookup evidence, joined into prompt block.
   * Each line says which kind it is; the sheets read declarations as
   * authoritative and notes and lookups as vocabulary evidence only.
   *
   * Absent rather than empty when nothing is declared, noted or looked up, so
   * a caller spreading it into a prompt never emits a heading with nothing
   * under it.
   */
  readonly identityContext?: string;

  /**
   * Declared name and contributor forms as TRANSLATION side spells them.
   *
   * SEPARATE FROM `identityContext`, which is prose for a prompt. These are the
   * strings a guard compares, and the guard exists because asking a model to
   * keep a name does not work: probed on the repair lane's own judge sheet,
   * six of six judges preferred the candidate that dropped a declared alias.
   *
   * TRANSLATION SIDE ONLY, because the text being guarded is English.
   */
  readonly declaredNames: readonly string[];

  /**
   * Alignment findings in scorecard-stable wording.
   */
  readonly alignmentFindings: readonly string[];

  /**
   * Archive blocks pairing roster deliberately left outside every source claim.
   *
   * STRUCTURED APART FROM `alignmentFindings` so publication safety never parses
   * diagnostic prose to decide whether unreviewed archive wording exists.
   */
  readonly unclaimedTargetBlocks: readonly UnclaimedTargetBlock[];

  /**
   * Entries in the aligned unit list, which is the count worth logging beside
   * the slice count: a document with far more slices than units subdivided
   * heavily.
   *
   * INSERTIONS ARE INCLUDED, and they are not section PAIRS: an insertion names
   * a place in the translation where an untranslated original belongs, so it
   * has an original on one side and a boundary on the other. The name predates
   * insertions existing and is kept because settled version 2 artifacts record
   * it, and because every consumer wants exactly this number: it is the bound
   * `parseBlockPairing` refuses a section index against, and a real-pair
   * count there would falsely refuse a block pairing filed after an insertion.
   *
   * WHICH entries are insertions is reported by
   * {@link PreparedDocumentPair.alignmentFindings}, where each one names its
   * source section and either the boundary it was placed at or the refusal that
   * stopped it. That is the separate report, rather than a second count here.
   */
  readonly alignmentPairCount: number;

  /**
   * Pairing this slicing was built on, echoed back so what gets recorded is the
   * object slicing consumed rather than a second copy assembled beside it.
   *
   * ABSENT WHEN NOBODY WAS ASKED, present and possibly empty when somebody was.
   * A section missing from a present list had no pairing consumed for it, and
   * which of the several reasons applies is legible from
   * {@link PreparedDocumentPair.alignmentFindings}, not from here.
   */
  readonly blockPairing?: readonly SectionBlockPairing[];

  /**
   * Section pairing this alignment was built on, echoed back the same way and
   * for the same reason as {@link PreparedDocumentPair.blockPairing}: the
   * artifact records the value slicing consumed, not a copy assembled beside it.
   *
   * ABSENT WHEN THE DETERMINISTIC ALIGNER DECIDED THE SECTIONS, present when a
   * supplied pairing did. The roster shell supplies one only when its section
   * round agreed on at least one pair, so a present list is non-empty in
   * production; a direct caller's empty list is echoed as consumed rather than
   * normalised away, because an empty supplied pairing aligns nothing and the
   * deterministic path aligns by shape, and those are different slicings.
   */
  readonly sectionPairing?: readonly SectionPair[];
};

//endregion Prepared document pair
