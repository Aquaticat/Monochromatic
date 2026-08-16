import type {
  LaneSliceOutcome,
  LaneSliceText,
} from './lane-slice-text.ts';
import type { PreparationIdentity, } from './preparation-identity.ts';
import type {
  SliceDelivery,
  SliceDeliveryRecord,
} from './slice-delivery.ts';
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
// BUILT FROM THE DELIVERY LEDGER, not from wordings and an index set. The two
// disagree exactly where this comparison is most worth reading, and reading an
// index set here meant a shipped index left out of it was indistinguishable
// from a lane that kept the archive: an omission compared as a deliberate keep,
// which is the defect class this whole area sits downstream of. The ledger has
// already refused a decided slice that is neither shipped, withdrawn, nor
// blocked, so what each document carries arrives as a stated fact.

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

  /**
   * How the repair document came to carry what it carries.
   */
  readonly repairDelivery: SliceDelivery;

  /**
   * How the translate document came to carry what it carries.
   */
  readonly translateDelivery: SliceDelivery;
};

/**
 * Every slice as both lanes left it, bound to the slicing it describes.
 *
 * THE BINDING IS PART OF THE VALUE rather than something a writer remembers to
 * record beside it. Rows joined on a slice index mean nothing without the
 * slicing that numbered them, and a comparison persisted without it can be read
 * against a later preparation of the same entry with every row still looking
 * well formed.
 *
 * @example
 * ```ts
 * const comparison: LaneComparison = compareDocumentLanes({ preparationIdentity, repair, translate, },);
 * ```
 */
export type LaneComparison = {
  /**
   * Slicing both lanes ran over, which every row is joined on.
   */
  readonly preparationIdentity: PreparationIdentity;

  /**
   * One row per slice, in the order the repair ledger reports them.
   */
  readonly slices: readonly SliceLaneComparison[];
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
 * @param preparationIdentity - slicing both lanes ran over, carried into the
 * result so no writer can persist rows without the thing that numbers them
 *
 * @param repair - repair lane's delivery ledger, already checked against that
 * lane's own document
 *
 * @param translate - translate lane's, over the SAME preparation
 *
 * @returns One row per slice, in the order the REPAIR ledger reports them,
 * which is document order wherever that lane built it from a preparation and is
 * not re-sorted here
 *
 * @throws {@link LaneComparisonError} when either ledger repeats a slice, when
 * one reports a slice the other does not, or when the two disagree about a
 * slice's archive wording or about whether the archive translates it at all.
 * The last of those is the only one that PROVES different preparations; the
 * rest are shapes a single preparation cannot produce
 *
 * @example
 * ```ts
 * const comparison = compareDocumentLanes({ preparationIdentity, repair, translate, },);
 * ```
 */
export function compareDocumentLanes(
  {
    preparationIdentity,
    repair,
    translate,
  }: {
    readonly preparationIdentity: PreparationIdentity;
    readonly repair: readonly SliceDeliveryRecord[];
    readonly translate: readonly SliceDeliveryRecord[];
  },
): LaneComparison {
  if (repair.length !== translate.length)
    throw new LaneComparisonError({
      message: `lanes report ${String(repair.length,)} and ${
        String(translate.length,)
      } slices, so they ran over different preparations`,
    },);

  /**
   * Translate row for each slice index.
   */
  const translateByIndex = new Map(translate.map(function toEntry(record,): [
    number,
    SliceDeliveryRecord,
  ] {
    return [
      record.chunkIndex,
      record,
    ];
  },),);

  // Equal lengths are not equal COVERAGE: repair rows for slices 1 and 1 and
  // translate rows for 1 and 2 both count two, and the join would then emit two
  // rows for slice 1 and silently drop slice 2. BOTH sides are checked, because
  // the join walks the repair rows and looks the translate ones up, so a repeat
  // on either side produces that same wrong answer from the other end.
  if (translateByIndex.size !== translate.length)
    throw new LaneComparisonError({
      message: `translate lane reports ${String(translate.length,)} rows over ${
        String(translateByIndex.size,)
      } distinct slices`,
    },);

  /**
   * Distinct slices the repair rows name.
   */
  const repairDistinct = new Set(repair.map(function toIndex(record,): number {
    return record.chunkIndex;
  },),).size;
  if (repairDistinct !== repair.length)
    throw new LaneComparisonError({
      message: `repair lane reports ${String(repair.length,)} rows over ${
        String(repairDistinct,)
      } distinct slices`,
    },);
  return {
    preparationIdentity,
    slices: repair.map(function toRow(mine,): SliceLaneComparison {
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
      return {
        chunkIndex: mine.chunkIndex,
        incumbentKind: mine.incumbentKind,
        incumbentText: mine.incumbentText,

        // WHAT EACH DOCUMENT CARRIES, stated by the ledger rather than inferred
        // from membership of an index set. An omitted shipped index used to
        // read here as the lane having kept the archive, which is an absence
        // read as a choice.
        repairText: mine.shippedText,
        translateText: theirs.shippedText,

        // THE OUTCOMES THEMSELVES, not two booleans derived from them. A
        // boolean pair answers whether anyone looked and erases the difference
        // between a lane that decided, one that reached the slice and could not
        // fill it, one that heard no voice at all, and one with no work to do.
        repairOutcome: mine.outcome,
        translateOutcome: theirs.outcome,
        verdict: judgeSlice({
          repairText: mine.shippedText,
          translateText: theirs.shippedText,
          incumbentKind: mine.incumbentKind,
          incumbentText: mine.incumbentText,
        },),
        decisionComparison: compareDecisions({
          repair: mine.outcome,
          translate: theirs.outcome,
        },),
        repairDelivery: mine.delivery,
        translateDelivery: theirs.delivery,
      };
    },),
  };
}

//endregion Lane comparison
