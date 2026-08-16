import type {
  ArtifactComparisonRowV2,
  ArtifactDecisionComparisonV2,
  ArtifactDeliveryRowV2,
  ArtifactLaneVerdictV2,
  ArtifactSliceOutcomeV2,
} from './artifact-v2-vocabulary.ts';

//region Artifact version 2 comparison
// How version 2 decides what a comparison row SAYS, frozen the way its
// vocabulary is.
//
// The vocabulary froze the words and this freezes the rules, which are two
// different things and only one of them was done. `buildSettledArtifactV2`
// derived its persisted comparison by calling the LIVE comparator and
// projecting the answer, so a later change to how a verdict is decided would
// have silently reinterpreted every artifact already on disk: nothing in the
// file records which rules produced it, and a reader recomputing with the same
// changed comparator would agree with itself while both disagreed with what the
// artifact meant when it was written.
//
// So the rules live here, under a version 2 name, over version 2 ROWS. Changing
// them means editing a file whose name says which generation it defines, which
// is as loud as the union snapshot next door. The live comparator keeps its own
// job: it checks two ledgers against each other and refuses pairs that cannot
// be compared at all, which is a runtime invariant rather than a persisted
// meaning.
//
// DELIBERATELY DUPLICATED, therefore, and the duplication is checked rather
// than trusted: `buildSettledArtifactV2` runs both and refuses a disagreement,
// so the day the live rules move, a corpus pass stops rather than quietly
// writing artifacts that mean something new under an unchanged version number.

/**
 * Names how one slice's two carried wordings relate, as version 2 decides it.
 *
 * @param repairText - wording the repair document carries
 *
 * @param translateText - wording the translate document carries
 *
 * @param incumbentKind - whether the archive holds any wording here, which is
 * what separates its wording standing from a passage still missing
 *
 * @param incumbentText - archive wording both fall back to
 *
 * @returns Verdict for this slice
 *
 * @example
 * ```ts
 * const verdict = judgeSliceV2({ repairText, translateText, incumbentKind, incumbentText, },);
 * ```
 */
function judgeSliceV2(
  {
    repairText,
    translateText,
    incumbentKind,
    incumbentText,
  }: {
    readonly repairText: string;
    readonly translateText: string;
    readonly incumbentKind: 'present' | 'absent';
    readonly incumbentText: string;
  },
): ArtifactLaneVerdictV2 {
  /**
   * Whether the repair document moved off the archive wording.
   */
  const repairMoved = repairText !== incumbentText;

  /**
   * Whether the translate document did.
   */
  const translateMoved = translateText !== incumbentText;
  if (repairMoved && translateMoved)
    return (repairText === translateText) ? 'both-agree' : 'both-differ';
  if (repairMoved)
    return 'repair-only';
  if (translateMoved)
    return 'translate-only';

  // NEITHER DOCUMENT MOVED, which means the archive's wording stands only where
  // the archive HAS wording. At an anchor it means the passage is still
  // missing, and reporting that as the archive standing tells a reader a
  // translation is being kept where none has ever existed.
  return (incumbentKind === 'absent') ? 'gap-remains' : 'archive-stands';
}

/**
 * Compares what the two lanes DECIDED, as version 2 records it.
 *
 * @param repair - what the repair lane did about this slice
 *
 * @param translate - what the translate lane did
 *
 * @returns Whether the two decisions were comparable, and how they came out
 *
 * @example
 * ```ts
 * const decisions = compareDecisionsV2({ repair, translate, },);
 * ```
 */
function compareDecisionsV2(
  {
    repair,
    translate,
  }: {
    readonly repair: ArtifactSliceOutcomeV2;
    readonly translate: ArtifactSliceOutcomeV2;
  },
): ArtifactDecisionComparisonV2 {
  /**
   * Lanes with no wording to compare, collected rather than returned at the
   * first one found: a slice neither lane decided is a fact about both.
   */
  const undecidedLanes = [
    ...(repair.kind === 'decided') ? [] : ['repair',] as const,
    ...(translate.kind === 'decided') ? [] : ['translate',] as const,
  ];
  if ((repair.kind !== 'decided') || (translate.kind !== 'decided')) {
    return {
      kind: 'not-comparable',
      undecidedLanes,
    };
  }
  return {
    kind: 'comparable',
    verdict: (repair.acceptedText === translate.acceptedText) ? 'same' : 'different',
  };
}

/**
 * Reports a pair of version 2 ledgers that cannot be compared row for row.
 *
 * @example
 * ```ts
 * throw new ArtifactComparisonV2Error({ message: 'ledgers cover 3 and 4 slices', },);
 * ```
 */
export class ArtifactComparisonV2Error extends Error {
  /**
   * Names this error for a caller matching on it.
   */
  public override readonly name = 'ArtifactComparisonV2Error';

  /**
   * @param message - what disagreed, naming the position
   *
   * @example
   * ```ts
   * new ArtifactComparisonV2Error({ message: 'position 2 names different slices', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
  }
}

/**
 * Derives the whole comparison from two version 2 delivery ledgers.
 *
 * OVER PROJECTED ROWS rather than live records, so what it reads is exactly
 * what the artifact carries: a reader holding only the file can run this and
 * get the same answer the writer did, which is what makes the persisted copy
 * checkable rather than merely present.
 *
 * @param repair - repair lane's rows, in document order
 *
 * @param translate - translate lane's rows, in the same order
 *
 * @returns One row per slice, in the order the repair ledger reports them
 *
 * @throws {@link ArtifactComparisonV2Error} when the two ledgers differ in
 * length or disagree at any position about which slice it is or what the
 * archive holds there
 *
 * @example
 * ```ts
 * const rows = compareLanesV2({ repair: lanes.repair.delivery, translate: lanes.translate.delivery, },);
 * ```
 */
export function compareLanesV2(
  {
    repair,
    translate,
  }: {
    readonly repair: readonly ArtifactDeliveryRowV2[];
    readonly translate: readonly ArtifactDeliveryRowV2[];
  },
): readonly ArtifactComparisonRowV2[] {
  if (repair.length !== translate.length) {
    throw new ArtifactComparisonV2Error({
      message: `ledgers cover ${String(repair.length,)} and ${
        String(translate.length,)
      } slices, so they describe different preparations`,
    },);
  }
  return repair.map(function toRow(
    mine,
    position,
  ): ArtifactComparisonRowV2 {
    /**
     * Row the other ledger holds at this POSITION, which is where a ledger
     * built over the same preparation holds the same slice.
     */
    const theirs = translate[position];
    if (theirs === undefined) {
      throw new ArtifactComparisonV2Error({
        message: `translate ledger has no row at position ${String(position,)}`,
      },);
    }
    if (theirs.chunkIndex !== mine.chunkIndex) {
      throw new ArtifactComparisonV2Error({
        message: `position ${String(position,)} names slice ${
          String(mine.chunkIndex,)
        } in the repair ledger and slice ${String(theirs.chunkIndex,)} in the translate ledger`,
      },);
    }
    if (theirs.incumbentText !== mine.incumbentText) {
      throw new ArtifactComparisonV2Error({
        message: `slice ${String(mine.chunkIndex,)} carries a different archive wording in each ledger`,
      },);
    }

    // TEXT IS NOT ENOUGH. A blank content slice and a place the archive never
    // translated both carry the empty string, so equal text leaves exactly the
    // pair this comparison must not confuse still equal.
    if (theirs.incumbentKind !== mine.incumbentKind) {
      throw new ArtifactComparisonV2Error({
        message: `slice ${String(mine.chunkIndex,)} is ${
          mine.incumbentKind
        } of archive wording to the repair lane and ${
          theirs.incumbentKind
        } to the translate lane`,
      },);
    }
    return {
      chunkIndex: mine.chunkIndex,
      incumbentKind: mine.incumbentKind,
      incumbentText: mine.incumbentText,
      repairText: mine.shippedText,
      translateText: theirs.shippedText,
      verdict: judgeSliceV2({
        repairText: mine.shippedText,
        translateText: theirs.shippedText,
        incumbentKind: mine.incumbentKind,
        incumbentText: mine.incumbentText,
      },),
      repairOutcome: mine.outcome,
      translateOutcome: theirs.outcome,
      decisionComparison: compareDecisionsV2({
        repair: mine.outcome,
        translate: theirs.outcome,
      },),
      repairDelivery: mine.delivery,
      translateDelivery: theirs.delivery,
    };
  },);
}

/**
 * Refuses a run whose frozen and live comparisons disagree.
 *
 * The one place the duplication is worth its cost. Version 2's rules are frozen
 * here and the pipeline's live rules keep evolving; while they agree, either
 * derivation answers for the other, and the moment they stop, an artifact
 * written under the live rules would mean something the version number does not
 * say. A stopped pass is the cheap outcome: whoever changed the rules decides
 * whether version 2 changed with them, which is a version 3, or whether the
 * change was a defect.
 *
 * COMPARED AS SERIALIZED, because that is what a reader will see: two rows that
 * differ only in key order are the same artifact, and two that differ in a
 * value are not.
 *
 * @param frozen - rows version 2's own rules produced
 *
 * @param live - rows the pipeline's comparator produced, projected into version
 * 2's vocabulary
 *
 * @throws {@link ArtifactComparisonV2Error} at the first row they disagree on
 *
 * @example
 * ```ts
 * assertDerivationsAgree({ frozen, live, },);
 * ```
 */
export function assertDerivationsAgree(
  {
    frozen,
    live,
  }: {
    readonly frozen: readonly ArtifactComparisonRowV2[];
    readonly live: readonly ArtifactComparisonRowV2[];
  },
): void {
  if (frozen.length !== live.length) {
    throw new ArtifactComparisonV2Error({
      message: `version 2 derives ${String(frozen.length,)} comparison rows where the pipeline derives ${
        String(live.length,)
      }, so the two no longer describe one comparison`,
    },);
  }
  for (const [
    position,
    row,
  ] of frozen.entries()) {
    /**
     * What the live comparator said about the same position.
     */
    const theirs = live[position];
    if (JSON.stringify(row,) !== JSON.stringify(theirs,)) {
      throw new ArtifactComparisonV2Error({
        message: `version 2 and the pipeline disagree about slice ${
          String(row.chunkIndex,)
        }: version 2 says ${JSON.stringify(row,)} and the pipeline says ${JSON.stringify(theirs,)}. `
          + 'One of them changed, and which artifacts mean what depends on which',
      },);
    }
  }
}

//endregion Artifact version 2 comparison
