import type {
  LaneSliceOutcome,
  LaneSliceText,
} from './lane-slice-text.ts';
import { assertWordingCoherent, } from './wording-coherence.ts';

//region Lane comparison
// What the two lanes did to the SAME slice, which is the question running both
// of them over one preparation exists to answer.
//
// Computed here rather than in the combined driver on purpose. The driver
// returns both documents and arbitrates nothing, and that property is what its
// tests pin; a comparison is not arbitration, but a driver that computed one
// would be the obvious place to later put a winner. Anyone who wants the
// comparison asks for it.
//
// SHIPPED IS READ OFF THE INDEX SETS, never off a per-slice record. A lane's
// record says what that slice decided; the assembly guard decides what the
// document carries, and the two disagree exactly where this comparison is most
// worth reading.

/**
 * What the two lanes did to one slice.
 *
 * @example
 * ```ts
 * const verdict: SliceLaneVerdict = 'both-differ';
 * ```
 */
export type SliceLaneVerdict =
  /**
   * Neither document carries a change: the archive's own English stands in
   * both, whether because both lanes left it alone or because the assembly
   * guard took both replacements back.
   */
  | 'archive-stands'
  /**
   * Repair's document changed this slice and translate's did not.
   */
  | 'repair-only'
  /**
   * Translate's document changed this slice and repair's did not.
   */
  | 'translate-only'
  /**
   * Both documents changed this slice to the SAME wording, character for
   * character.
   */
  | 'both-agree'
  /**
   * Both documents changed this slice and the two wordings differ, which is the
   * case a human has to read.
   */
  | 'both-differ'
  /**
   * Neither document carries anything here, and the archive never did either:
   * the passage is still MISSING.
   *
   * Split from `archive-stands` because that word asserts a translation is
   * being kept, and at a slice the archive never translated there is none to
   * keep. Every anchor neither lane filled read as the archive standing until
   * 2026-08-16.
   */
  | 'gap-remains';

/**
 * Whether the two lanes' own decisions can be compared on a slice, and how they
 * came out.
 *
 * NOT DERIVABLE FROM THE VERDICT, which describes the two documents. A slice
 * neither lane could decide is not a slice where they agreed.
 *
 * @example
 * ```ts
 * const comparison: DecisionComparison = { kind: 'comparable', verdict: 'same', };
 * ```
 */
export type DecisionComparison = {
  /**
   * Both lanes decided a wording, so the two are comparable.
   */
  readonly kind: 'comparable';

  /**
   * Whether those wordings are the same, character for character.
   */
  readonly verdict: 'same' | 'different';
} | {
  /**
   * At least one lane decided nothing here.
   */
  readonly kind: 'not-comparable';

  /**
   * Lanes that decided nothing, in lane order, and BOTH of them when neither
   * did.
   *
   * A single free-text reason named only the first lane checked, so a slice
   * neither lane decided read as the repair lane's fault alone. What each lane
   * did instead is stated on the row itself.
   */
  readonly undecidedLanes: readonly ('repair' | 'translate')[];
};

/**
 * One slice as both lanes left it.
 *
 * @example
 * ```ts
 * const row: SliceLaneComparison = { chunkIndex: 3, verdict: 'both-differ', ... };
 * ```
 */
export type SliceLaneComparison = {
  /**
   * Global slice index both lanes name it by.
   */
  readonly chunkIndex: number;

  /**
   * Whether the archive holds any wording at this slice at all.
   */
  readonly incumbentKind: 'present' | 'absent';

  /**
   * Archive's own English for this slice.
   */
  readonly incumbentText: string;

  /**
   * Wording the repair document CARRIES, which is the incumbent wherever that
   * lane changed nothing or had its change withdrawn.
   */
  readonly repairText: string;

  /**
   * Wording the translate document CARRIES, on the same rule.
   */
  readonly translateText: string;

  /**
   * How the two documents relate on this slice.
   */
  readonly verdict: SliceLaneVerdict;

  /**
   * What the repair lane did about this slice.
   *
   * THE OUTCOME RATHER THAN A REACHED FLAG. Both documents carrying the archive
   * wording says nothing about whether anyone looked, and a boolean says only
   * that somebody did: it cannot separate a lane that examined the slice and
   * kept it from one that reached it and could not fill it, or from one that
   * heard no voice at all. A pair of booleans recorded the second of those as
   * nobody having looked.
   */
  readonly repairOutcome: LaneSliceOutcome;

  /**
   * What the translate lane did about this slice.
   */
  readonly translateOutcome: LaneSliceOutcome;

  /**
   * Whether the two lanes' own decisions were comparable here, and how they
   * came out, which the delivery verdict cannot say.
   */
  readonly decisionComparison: DecisionComparison;
};

/**
 * Raised when two lane results cannot be compared because they do not describe
 * the same preparation.
 *
 * @example
 * ```ts
 * throw new LaneComparisonError({ message: 'slice 4 differs', },);
 * ```
 */
export class LaneComparisonError extends Error {
  /**
   * Builds the error with a message naming what disagreed.
   *
   * @param message - which slice disagreed and how
   *
   * @example
   * ```ts
   * throw new LaneComparisonError({ message: 'slice 4 differs', },);
   * ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'LaneComparisonError';
  }
}

/**
 * Wording one lane's document carries for a slice.
 *
 * @param wording - what that lane decided for it
 *
 * @param shipped - whether the returned document carries that decision
 *
 * @returns Decided wording when it shipped, archive wording otherwise
 *
 * @example
 * ```ts
 * const carried = carriedText({ wording, shipped, },);
 * ```
 */
function carriedText(
  {
    wording,
    shipped,
  }: {
    readonly wording: LaneSliceText;
    readonly shipped: boolean;
  },
): string {
  if (!shipped)
    return wording.incumbentText;

  // A slice the lane never reached cannot be one the document carries a change
  // for. Falling back to the archive wording here would answer the question
  // with a row reading "the archive stands", which is the one thing a result
  // this contradictory is not evidence of.
  if (wording.outcome
    .kind
    !== 'decided') {
    throw new LaneComparisonError({
      message: `slice ${
        String(wording.chunkIndex,)
      } is named as shipped by a lane whose outcome for it was ${
        wording.outcome
          .kind
      }`,
    },);
  }

  return wording.outcome
    .acceptedText;
}

/**
 * Shipped indices as a set, refusing any that the lane's own rows contradict.
 *
 * The comparison used to build these sets and look slices up in them, so an
 * index naming a slice the lane never reported was accepted and then quietly
 * matched nothing. That is the shape a result built from two different
 * preparations has, and it is exactly what every row below would then be wrong
 * about, one row at a time and without a symptom.
 *
 * @param lane - which side these indices came from, for the message
 *
 * @param shipped - slices that lane says its document carries a change for
 *
 * @param wordings - that lane's per-slice rows, which the indices must name
 *
 * @returns Same indices, as a set
 *
 * @throws LaneComparisonError when an index repeats, names no row, or names a
 * row whose accepted wording is the archive's own
 *
 * @example
 * ```ts
 * const shippedSlices = shippedSet({ lane: 'repair', shipped, wordings, },);
 * ```
 */
function shippedSet(
  {
    lane,
    shipped,
    wordings,
  }: {
    readonly lane: string;
    readonly shipped: readonly number[];
    readonly wordings: readonly LaneSliceText[];
  },
): ReadonlySet<number> {
  if (new Set(shipped,).size !== shipped.length)
    throw new LaneComparisonError({
      message: `${lane} lane names a slice as shipped more than once; the `
        + 'repeat is dropped by the set this becomes, so a count taken from the '
        + 'list and a count taken from the set would disagree',
    },);

  /**
   * Rows this lane reported, by slice index.
   */
  const rows = new Map(wordings.map(function toEntry(wording,): [
    number,
    LaneSliceText,
  ] {
    return [
      wording.chunkIndex,
      wording,
    ];
  },),);
  for (const chunkIndex of shipped) {
    /**
     * Row this index claims to name.
     */
    const row = rows.get(chunkIndex,);
    if (row === undefined)
      throw new LaneComparisonError({
        message: `${lane} lane names slice ${
          String(chunkIndex,)
        } as shipped and reports no wording for it`,
      },);
    if (row.outcome
      .kind
      !== 'decided') {
      throw new LaneComparisonError({
        message: `${lane} lane names slice ${
          String(chunkIndex,)
        } as shipped and reports its outcome there as ${
          row.outcome
            .kind
        }`,
      },);
    }
    if (row.outcome
      .acceptedText
      === row.incumbentText) {
      throw new LaneComparisonError({
        message: `${lane} lane names slice ${
          String(chunkIndex,)
        } as shipped and reports the archive's own wording for it`,
      },);
    }
  }
  return new Set(shipped,);
}

/**
 * Names how the two lanes' DECISIONS relate, where both made one.
 *
 * SEPARATE FROM THE DELIVERY VERDICT because they answer different questions
 * and this file used to answer only the second while claiming the first. Two
 * lanes accepting different replacements that are both withdrawn deliver the
 * same document and disagree completely; two lanes accepting the same wording
 * where only one ships deliver differently and agree exactly.
 *
 * @param repair - what the repair lane did with this slice
 *
 * @param translate - what the translate lane did
 *
 * @returns Whether the two decisions can be compared, and how they came out
 *
 * @example
 * ```ts
 * const comparison = compareDecisions({ repair, translate, },);
 * ```
 */
function compareDecisions(
  {
    repair,
    translate,
  }: {
    readonly repair: LaneSliceOutcome;
    readonly translate: LaneSliceOutcome;
  },
): DecisionComparison {
  /**
   * Lanes with no wording to compare, collected rather than returned at the
   * first one found: a slice neither lane decided is a fact about both.
   */
  const undecidedLanes = [
    ...(repair.kind === 'decided') ? [] : ['repair',] as const,
    ...(translate.kind === 'decided') ? [] : ['translate',] as const,
  ];
  if ((repair.kind !== 'decided') || (translate.kind !== 'decided'))
    return {
      kind: 'not-comparable',
      undecidedLanes,
    };
  return {
    kind: 'comparable',
    verdict: (repair.acceptedText === translate.acceptedText) ? 'same' : 'different',
  };
}

/**
 * Names how one slice's two carried wordings relate.
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
 * const verdict = judgeSlice({ repairText, translateText, incumbentKind, incumbentText, },);
 * ```
 */
function judgeSlice(
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
): SliceLaneVerdict {
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
  // missing, and reporting that as the archive standing told a grader a
  // translation was being kept where none has ever existed.
  return (incumbentKind === 'absent') ? 'gap-remains' : 'archive-stands';
}

/**
 * Compares what two lanes' documents carry, slice by slice.
 *
 * @param repair - repair lane's per-slice wordings and shipped indices
 *
 * @param translate - translate lane's, over the SAME preparation
 *
 * @returns One row per slice, in the order the REPAIR lane reported its rows,
 * which is document order wherever that lane built them from a preparation and
 * is not re-sorted here
 *
 * @throws LaneComparisonError when either lane repeats a slice, when a shipped
 * index repeats or contradicts its own row, when one lane reports a slice the
 * other does not, or when the two disagree about a slice's archive wording. The
 * last of those is the only one that PROVES different preparations; the rest
 * are shapes a single preparation cannot produce
 *
 * @example
 * ```ts
 * const rows = compareDocumentLanes({ repair, translate, },);
 * ```
 */
export function compareDocumentLanes(
  {
    repair,
    translate,
  }: {
    readonly repair: {
      readonly sliceTexts: readonly LaneSliceText[];
      readonly shippedChunkIndices: readonly number[];
    };
    readonly translate: {
      readonly sliceTexts: readonly LaneSliceText[];
      readonly shippedChunkIndices: readonly number[];
    };
  },
): readonly SliceLaneComparison[] {
  /**
   * Rows each lane reports, which must agree before anything is joined.
   */
  const counted = {
    repair: repair.sliceTexts
      .length,
    translate: translate.sliceTexts
      .length,
  };
  if (counted.repair !== counted.translate)
    throw new LaneComparisonError({
      message: `lanes report ${String(counted.repair,)} and `
        + `${String(counted.translate,)} slices, so they ran over different preparations`,
    },);

  /**
   * Translate wording for each slice index.
   */
  const translateByIndex = new Map(
    translate.sliceTexts
      .map(function toEntry(wording,): [
        number,
        LaneSliceText,
      ] {
        return [
          wording.chunkIndex,
          wording,
        ];
      },),
  );

  // Equal lengths are not equal COVERAGE: repair rows for slices 1 and 1 and
  // translate rows for 1 and 2 both count two, and the join would then emit two
  // rows for slice 1 and silently drop slice 2. BOTH lanes are checked, because
  // the join walks the repair rows and looks the translate ones up, so a repeat
  // on either side produces that same wrong answer from the other end.
  if (translateByIndex.size !== counted.translate)
    throw new LaneComparisonError({
      message: `translate lane reports ${
        String(counted.translate,)
      } rows over ${String(translateByIndex.size,)} distinct slices`,
    },);

  /**
   * Distinct slices the repair rows name.
   */
  const repairDistinct = new Set(repair.sliceTexts
    .map(function toIndex(wording,): number {
      return wording.chunkIndex;
    },),).size;
  if (repairDistinct !== counted.repair)
    throw new LaneComparisonError({
      message: `repair lane reports ${
        String(counted.repair,)
      } rows over ${String(repairDistinct,)} distinct slices`,
    },);

  /**
   * Slices the repair document carries a change for.
   */
  const repairShipped = shippedSet({
    lane: 'repair',
    shipped: repair.shippedChunkIndices,
    wordings: repair.sliceTexts,
  },);

  /**
   * Slices the translate document carries a replacement for.
   */
  const translateShipped = shippedSet({
    lane: 'translate',
    shipped: translate.shippedChunkIndices,
    wordings: translate.sliceTexts,
  },);

  return repair.sliceTexts
    .map(function toRow(mine,): SliceLaneComparison {
      /**
       * Same slice as the other lane left it.
       */
      const theirs = translateByIndex.get(mine.chunkIndex,);
      if (theirs === undefined)
        throw new LaneComparisonError({
          message: `slice ${String(mine.chunkIndex,)} is missing from the translate lane`,
        },);
      if (theirs.incumbentText !== mine.incumbentText)
        throw new LaneComparisonError({
          message: `slice ${String(mine.chunkIndex,)} carries a different incumbent in each lane, `
            + 'so the two results describe different preparations',
        },);

      // TEXT IS NOT ENOUGH. A blank content slice and a place the archive never
      // translated both carry the empty string, so equal text leaves exactly
      // the pair this comparison must not confuse still equal. Every row's kind
      // was taken from the repair lane, which decided the gap verdict for both.
      if (theirs.incumbentKind !== mine.incumbentKind)
        throw new LaneComparisonError({
          message: `slice ${String(mine.chunkIndex,)} is ${
            mine.incumbentKind
          } of archive wording to the repair lane and ${
            theirs.incumbentKind
          } to the translate lane, so the two disagree about whether the archive translates it`,
        },);
      assertWordingCoherent({ wording: mine, },);
      assertWordingCoherent({ wording: theirs, },);

      /**
       * Wording the repair document carries here.
       */
      const repairText = carriedText({
        wording: mine,
        shipped: repairShipped.has(mine.chunkIndex,),
      },);

      /**
       * Wording the translate document carries here.
       */
      const translateText = carriedText({
        wording: theirs,
        shipped: translateShipped.has(theirs.chunkIndex,),
      },);

      return {
        chunkIndex: mine.chunkIndex,
        incumbentKind: mine.incumbentKind,
        incumbentText: mine.incumbentText,
        repairText,
        translateText,

        // THE OUTCOMES THEMSELVES, not two booleans derived from them. A
        // boolean pair answers "did anyone look" and erases the difference
        // between a lane that decided, one that reached the slice and could not
        // fill it, and one that heard no voice at all, which is the erasure
        // that put `translateReached: false` on slices the lane demonstrably
        // reached.
        repairOutcome: mine.outcome,
        translateOutcome: theirs.outcome,

        verdict: judgeSlice({
          repairText,
          translateText,
          incumbentKind: mine.incumbentKind,
          incumbentText: mine.incumbentText,
        },),
        decisionComparison: compareDecisions({
          repair: mine.outcome,
          translate: theirs.outcome,
        },),
      };
    },);
}

//endregion Lane comparison
