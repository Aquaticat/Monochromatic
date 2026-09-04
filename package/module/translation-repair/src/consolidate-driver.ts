import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { ConsolidationPolishConfig, } from './consolidation-polish.ts';
import {
  consolidateRunShape,
  consolidateSliceKey,
} from './consolidate-key.ts';
import { persistConsolidationSettlement, } from './consolidate-persistence.ts';
import type { ConsolidationSettlement, } from './consolidate-settle.ts';
import { buyConsolidationSlice, } from './consolidate-slice-buy.ts';
import {
  contestStandingMayShip,
  standingTextFor,
} from './consolidate-standing.ts';
import {
  type ArtifactConsolidateSlice,
  describeConsolidateSlice,
} from './corpus-run/artifact-two-lane-consolidate.ts';
import type {
  ArtifactContestSlice,
  ArtifactContestVerdict,
} from './corpus-run/artifact-two-lane-contest.ts';
import type { ProjectedLanes, } from './corpus-run/artifact-two-lane-derive.ts';
import type { SliceNeighbourContext, } from './fidelity-window.ts';
import type { LaneChoice, } from './lane-contest-wire.ts';
import type { SliceCache, } from './slice-cache.ts';
import { armSliceCost, } from './slice-cost-log.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';
import {
  reuseTwinOrBuy,
  type TwinMemo,
  type TwinStored,
} from './twin-memo.ts';
import { mapOverlapped, } from './overlapped-map.ts';
import { ConsolidationLedgerGapError, } from './consolidation-ledger-gap.ts';
import { NaturalnessCompletenessError, } from './naturalness-completeness-error.ts';

//region Consolidate driver
// THE CONSOLIDATION OVER ONE DOCUMENT: which slices get a third rendering
// asked for, and what the roster settled at each.
//
// RUNS ONLY WHERE THE CONTEST RAN. A slice the two lanes worded identically has
// nothing to consolidate: the lanes agree, so a third rendering would be
// competing against their agreement rather than resolving a difference. The
// contest's own eligibility already selected those slices, so this drives off
// its records rather than re-deriving them.
//
// WHY A THIRD RENDERING AT ALL is argued in `consolidate-wire.ts` and measured
// in `doc/planning/the-third-rendering.md`: the lanes fail in opposite
// directions, and at least one slice was found where each lane was better than
// the other in a DIFFERENT PLACE of the same passage. No selection can produce
// that slice's best text, because that text is neither candidate.
//
// IDENTICAL QUESTIONS SHARE ONE CACHE-ELIGIBLE PURCHASE. The position-free key
// names everything the stages see, while `ConsolidationSettlement` carries no
// slice index needing restamp. An unsettled panel is neither persisted nor
// memoized, so its twin asks again exactly as a warm run would.

/**
 * Fresh consolidation beside whether it became warm-run evidence.
 *
 * @example
 * ```ts
 * const bought: BoughtConsolidation = { settlement, persisted: true, };
 * ```
 */
type BoughtConsolidation = {
  readonly settlement: ConsolidationSettlement;
  readonly persisted: boolean;
};

/**
 * Reads cache-eligible record from fresh consolidation.
 *
 * @param bought - fresh result beside persistence status
 *
 * @returns Record a twin may reuse, or deliberate nothing
 *
 * @example
 * ```ts
 * const stored = storedConsolidationOf({ settlement, persisted: true, },);
 * ```
 */
function storedConsolidationOf(
  bought: BoughtConsolidation,
): TwinStored<ConsolidationSettlement> {
  return bought.persisted
    ? {
      kind: 'stored',
      record: bought.settlement,
    }
    : { kind: 'nothing', };
}

/**
 * Reads which lane the contest backed out of the verdict it recorded.
 *
 * BOTH WAYS OF NOT SETTLING READ AS `neither`, deliberately. The record keeps
 * `settled-neither` apart from `quorum-not-met` because they are different
 * facts about the run, but this function asks which LANE stood. Neither did.
 * `standingTextFor` then uses archive as comparison baseline so consolidation
 * can recover, while final-selection guard prevents that unendorsed baseline
 * from becoming publication fallback.
 *
 * @param verdict - what the contest recorded for this slice
 *
 * @returns Lane the contest backed, or the refusal
 *
 * @example
 * ```ts
 * const choice = laneChoiceOf({ verdict, },);
 * ```
 */
function laneChoiceOf(
  { verdict, }: { readonly verdict: ArtifactContestVerdict; },
): LaneChoice {
  if (verdict.kind === 'lane-won')
    return verdict.lane;
  return 'neither';
}

/**
 * Asks the roster for a third rendering at every slice the contest was asked
 * about, settled or not; a slice the contest left with no standing text is
 * settled as `no-standing-text` without a producer being asked.
 *
 * @param client - synthetic chat client
 *
 * @param projected - both ledgers as version 2 rows, beside their comparison
 *
 * @param contests - one record per contested slice, as the contest wrote them
 * for the artifact
 *
 * @param modelIds - roster to ask for consolidations
 *
 * @param judgeModelIds - roster that judges each slate and gates its winner;
 * `modelIds` when not given
 *
 * @param identityContext - names and handles both documents declare
 *
 * @param polishConfig - final body naturalness roles and document guard facts
 *
 * @param frontMatterSlices - syntax-bearing metadata slice indexes
 *
 * @param lineStructuredSlices - chunk indices whose original is verse or
 * otherwise line-structured, which decides whether a producer is shown the rule
 * against merging lines
 *
 * @param pictureContextBySlice - what the pictures near each slice were read to
 * say, keyed by chunk index and already windowed by the caller, since the window
 * is positional in the prepared slices and this driver holds none of them
 *
 * @param neighbourContextBySlice - passages either side of each slice, keyed the
 * same way and computed by the same caller for the same reason
 *
 * @param cache - per-entry store of settlements already bought
 *
 * @param signal - abort shared with the rest of the entry
 *
 * @param perCallTimeoutMs - per-call ceiling
 *
 * @param overlap - most contested slices in flight; one reproduces former loop
 *
 * @param l - logger to tag
 *
 * @returns One record per consolidated slice, in comparison-row order
 *
 * @throws Error - when a contested slice has no row in the repair ledger, which
 * means the comparison and the ledger disagree about which slices exist
 *
 * @example
 * ```ts
 * const slices = await consolidateDocument({ client, projected, contests, modelIds, frontMatterSlices, lineStructuredSlices, pictureContextBySlice, neighbourContextBySlice, cache, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function consolidateDocument(
  {
    client,
    projected,
    contests,
    modelIds,
    judgeModelIds = modelIds,
    identityContext,
    polishConfig,
    frontMatterSlices,
    lineStructuredSlices,
    pictureContextBySlice,
    neighbourContextBySlice,
    cache,
    signal,
    perCallTimeoutMs,
    overlap = 1,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly projected: ProjectedLanes;
    readonly contests: readonly ArtifactContestSlice[];
    readonly modelIds: readonly RosterModelId[];
    readonly judgeModelIds?: readonly RosterModelId[];
    readonly identityContext?: string;
    readonly polishConfig?: ConsolidationPolishConfig;
    readonly frontMatterSlices: ReadonlySet<number>;
    readonly lineStructuredSlices: ReadonlySet<number>;
    readonly pictureContextBySlice: ReadonlyMap<number, string>;
    readonly neighbourContextBySlice: ReadonlyMap<number, SliceNeighbourContext>;
    readonly cache: SliceCache<ConsolidationSettlement>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly overlap?: number;
    readonly l: Logger;
  },
): Promise<readonly ArtifactConsolidateSlice[]> {
  /**
   * Logger naming this driver.
   */
  const dl = tagged({
    l,
    tag: consolidateDocument.name,
  },);

  /**
   * Original of each slice, which only the repair ledger carries.
   */
  const sourceTexts = new Map(projected.delivery
    .repair
    .map(function nameSource(row,): readonly [
      number,
      string,
    ] {
      return [
        row.sliceIndex,
        row.sourceText,
      ];
    },),);

  /**
   * Contest record for each slice it answered.
   */
  const contestBySlice = new Map(contests.map(function nameSlice(slice,): readonly [
    number,
    ArtifactContestSlice,
  ] {
    return [
      slice.sliceIndex,
      slice,
    ];
  },),);

  /**
   * What this run asks, folded into every key.
   */
  const runShape = consolidateRunShape({
    modelIds,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    ...((polishConfig === undefined) ? {} : { polishConfig, }),
  },);

  /**
   * Comparison rows beside contests that selected them, in document order.
   */
  const eligibleRows = projected.comparison
    .flatMap(function withContest(row,) {
      /**
       * What the contest settled here, absent where it never ran.
       */
      const contest = contestBySlice.get(row.sliceIndex,);
      return (contest === undefined)
        ? []
        : [{
          row,
          contest,
        },];
    },);

  /**
   * Cache-eligible purchases in this document, shared by identical questions.
   */
  const twins: TwinMemo<ConsolidationSettlement> = new Map();

  dl.info(`consolidation: ${String(contests.length,)} contested slices to settle`,);
  return await mapOverlapped({
    items: eligibleRows,
    overlap,
    oneItem: async function consolidateOne({
      item: {
        row,
        contest,
      },
    },): Promise<ArtifactConsolidateSlice> {
    /**
     * Original of this slice, which every ledger row carries.
     */
    const sourceText = sourceTexts.get(row.sliceIndex,);
    if (sourceText === undefined)
      throw new ConsolidationLedgerGapError({ sliceIndex: row.sliceIndex, },);

    /**
     * Wall-time bracket making this slice visible before and after settlement.
     */
    using cost = armSliceCost({
      l: dl,
      lane: 'consolidation',
      sliceIndex: row.sliceIndex,
      sourceChars: sourceText.length,
      signal,
    },);
    cost.left({ exit: 'failed', },);

    /**
     * Lane contest selected, or refusal of both.
     */
    const choice = laneChoiceOf({ verdict: contest.verdict, },);
    /**
     * Wording that would ship without this stage.
     */
    const standingText = standingTextFor({
      choice,
      repairText: row.repairText,
      translateText: row.translateText,
      incumbentText: row.incumbentText,
    },);
    /**
     * Whether the line-structure rule governs this slice.
     *
     * READ ONCE, because four places below need this same answer: the sheet
     * the producers are shown, the guard that reads their proposals, the key
     * the settlement resumes under, and the wrap. Asking the set four times
     * is how four answers drift into three.
     */
    const lineStructured = lineStructuredSlices.has(row.sliceIndex,);
    /**
     * Syntax role shared by every consolidation phase and cache key.
     */
    const syntax = frontMatterSlices.has(row.sliceIndex,)
      ? 'front-matter' as const
      : undefined;

    /**
     * Syntax verdict for standing text, or ordinary prose admission.
     */
    const standingValidation = validateTranslatedSlice({
      sourceText,
      candidateText: standingText,
      pageText: row.incumbentText,
      ...((syntax === undefined) ? {} : { syntax, }),
      lineStructured,
    },);
    /**
     * Whether standing text itself passes syntax-bearing publication rules.
     */
    const standingValid = standingValidation.kind === 'valid';
    /**
     * Whether this baseline has prior approval and may ship unchanged.
     */
    const standingMayShip = contestStandingMayShip({
      choice,
      verdict: contest.verdict,
      standingValid,
    },);
    if (!standingMayShip) {
      dl.warn(
        `slice ${String(row.sliceIndex,)}: consolidation standing text fails publication eligibility and remains retryable`,
      );
    }

    /**
     * What the pictures near this slice were read to say, empty where none
     * were.
     *
     * MISSING AND EMPTY ARE ONE STATE, folded here on purpose. A slice near no
     * readable picture gets an empty block from the windowing, and a slice the
     * map never mentions is a slice in exactly that position, so distinguishing
     * them would only let the sheet and the key disagree about which spelling
     * the caller happened to use.
     */
    const pictureContext = pictureContextBySlice.get(row.sliceIndex,) ?? '';

    /**
     * Passages either side of this slice, folded the same way and for the same
     * reason: a lone slice has an empty window and a slice the map never
     * mentions is a slice in exactly that position.
     */
    const neighbours = neighbourContextBySlice.get(row.sliceIndex,)
      ?? {
        sourceText: '',
        incumbentText: '',
      };

    /**
     * Slice as both halves take it.
     */
    const subject = {
      sourceText,
      incumbentText: row.incumbentText,
      repairText: row.repairText,
      translateText: row.translateText,
      ballots: contest.ballots,
      ...((syntax === undefined) ? {} : { syntax, }),
      lineStructured,
      ...((identityContext === undefined) ? {} : { identityContext, }),
      // Omitted rather than empty, matching the context above it, so a producer
      // shown no readings is shown no heading promising any.
      ...((pictureContext === '') ? {} : { pictureContext, }),
      // THE WINDOW REACHES THE JUDGING HALF ONLY, for now. The producer sheet
      // has no block for it, so putting it here promises nothing to a producer
      // and gives `settleConsolidation` what its judges need. Whether the
      // producers should have it too is a real question and `#178` records it
      // as an explicit exclusion rather than answering it in passing.
      ...((neighbours.sourceText === '') ? {} : { neighbouringSourceText: neighbours.sourceText, }),
      ...((neighbours.incumbentText === '')
        ? {}
        : { neighbouringIncumbentText: neighbours.incumbentText, }),
    };

    /**
     * Key this settlement resumes under.
     */
    const key = consolidateSliceKey({
      runShape,
      sourceText,
      incumbentText: row.incumbentText,
      ...((syntax === undefined) ? {} : { syntax, }),
      repairText: row.repairText,
      translateText: row.translateText,
      standingText,
      ballots: contest.ballots,
      lineStructured,
      pictureContext,
      neighbouringSourceText: neighbours.sourceText,
      neighbouringIncumbentText: neighbours.incumbentText,
    },);

    /**
     * A settlement an earlier run already bought for this slice, if any.
     */
    const resumed = cache
      .resumed
      .get(key,);

    /**
     * What the roster settled here, bought, resumed, or reused from a twin.
     */
    const acquired = await (async function resumeOrBuy(): Promise<{
      readonly settlement: ConsolidationSettlement;
      readonly exit: 'computed' | 'resumed' | 'reused';
    }> {
      if (resumed !== undefined) {
        return {
          settlement: resumed,
          exit: 'resumed',
        };
      }

      /**
       * Twin's persisted settlement or this row's fresh purchase.
       */
      const asked = await reuseTwinOrBuy({
        key,
        memo: twins,
        buy: async function buyThisRow(): Promise<BoughtConsolidation> {
          /**
           * Settlement bought for this question.
           */
          const bought = await buyConsolidationSlice({
            client,
            roster: modelIds,
            judgeModelIds,
            subject,
            standingText,
            lineStructured,
            sliceIndex: row.sliceIndex,
            ...((polishConfig === undefined) ? {} : { polishConfig, }),
            standingMayShip,
            standingEligible: standingValid,
            signal,
            perCallTimeoutMs,
            l: dl,
          },);

          /**
           * Whether purchase became reusable evidence.
           */
          const persisted = await persistConsolidationSettlement({
            key,
            settlement: bought,
            cache,
            standingMayShip,
            signal,
          },);
          return {
            settlement: bought,
            persisted,
          };
        },
        persistedOf: storedConsolidationOf,
        l: dl,
      },);
      if (asked.kind === 'reused') {
        return {
          settlement: asked.twin,
          exit: 'reused',
        };
      }
      /**
       * Fresh settlement unwrapped after memo accounting.
       */
      const { settlement, } = asked.bought;
      return {
        settlement,
        exit: 'computed',
      };
    })();
    /**
     * Final polish decision before artifact projection.
     */
    const { settlement, } = acquired;
    /**
     * Final polish state deciding whether any exact text may leave stage.
     */
    const { polish, } = settlement;
    if (polish?.kind === 'unsettled') {
      cost.left({ exit: 'unsettled', },);
      throw new NaturalnessCompletenessError({ sliceIndex: row.sliceIndex, },);
    }
    cost.left({ exit: acquired.exit, },);
    return describeConsolidateSlice({
      sliceIndex: row.sliceIndex,
      settlement,
    },);
    },
  },);
}

//endregion Consolidate driver
