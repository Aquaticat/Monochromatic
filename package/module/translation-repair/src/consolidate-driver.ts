import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  consolidateRunShape,
  consolidateSliceKey,
} from './consolidate-key.ts';
import { CONSOLIDATE_GATE_QUORUM, } from './consolidate-gate-stage.ts';
import { produceConsolidations, } from './consolidate-produce.ts';
import {
  type ConsolidationSettlement,
  type ConsolidationTerminal,
  settleConsolidation,
} from './consolidate-settle.ts';
import { standingTextFor, } from './consolidate-standing.ts';
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
import type { TranslateDecision, } from './translate-stage-result.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { ConsolidationLedgerGapError, } from './consolidation-ledger-gap.ts';

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

/**
 * Judge decisions a second panel might change, so a cache must not freeze them.
 *
 * INHERITED, NOT INVENTED. `translate-retry.ts` names exactly these two as the
 * declines worth buying another judging for, and names `no-candidate-backed`
 * as the settled one it records after that second round. The classification is
 * the same question here, so it gets the same answer.
 *
 * `no-candidate` is deliberately absent for the reason given there: it means
 * nothing usable was proposed, which a re-ask of the SAME slate cannot change.
 * The consolidation reaches the judge only past a floor that already refused
 * an empty slate, so it should not arise at all; if it does, keeping it stops
 * a later run re-buying a full panel to be told the same thing.
 *
 * SURVIVED THE TERMINAL SPLIT, and the reason is worth stating, because the
 * split otherwise routes this whole function. `slate-declined-standing` covers
 * BOTH the two declines a second panel might change and the settled
 * `no-candidate-backed` it records afterwards, so the terminal alone cannot
 * tell a re-askable decline from a settled one. The other four terminals are
 * decided by name.
 */
const UNSETTLED_DECISIONS: readonly TranslateDecision[] = [
  'declined-indecision',
  'declined-rejection',
];

/**
 * Terminals settled enough to keep without reading the judged round.
 *
 * FOUR OF THE FIVE NON-GATED WAYS OUT, and the split is what made them
 * readable by name. Two never reached a judge, one records judges endorsing
 * the archive, and one records a slate carrying a single candidate nobody was
 * asked about. None of those changes on a second asking of the same slate.
 *
 * The fifth, `slate-declined-standing`, is the only one that still needs the
 * decision read, because it covers both the declines a second panel might
 * change and the settled one recorded after that second panel has run.
 */
const SETTLED_WITHOUT_A_GATE: readonly ConsolidationTerminal[] = [
  'incumbent-only',
  'no-standing-text',
  'slate-endorsed-standing',
  'slate-unjudged-standing',
];

/**
 * Whether a settlement is worth keeping across runs.
 *
 * SETTLED VERDICTS ONLY, matching the contest's rule for the same reason: a
 * thin panel is a transient fact about a provider on one night, not a property
 * of the question, and freezing it into the cache would answer every later
 * resume of this entry with that night. The contest spells that as its own
 * quorum, so this spells it as the GATE'S quorum rather than as any ballot at
 * all: a gate that heard one voice of six did not settle, it was under-attended,
 * and `gateConsolidatedSlice` already refuses to act on fewer than
 * `CONSOLIDATE_GATE_QUORUM`.
 *
 * A settlement that never reached the gate IS still worth keeping when it was
 * the floor or an absent standing text that stopped it. Those are properties of
 * the slate and the contest, not of who answered. A slate the JUDGES kept the
 * standing text at is worth keeping only where they decided rather than
 * declined, which is the same distinction one stage earlier.
 *
 * EXPORTED FOR ITS OWN TEST, per `XPT`. Driving this predicate through
 * `consolidateDocument` would need a client that answers every round of every
 * branch, which buys a transport fixture to assert a decision the fixture is
 * not what settles.
 *
 * @param settlement - what the stage settled
 *
 * @returns Whether to persist it
 *
 * @example
 * ```ts
 * const keep = consolidationWorthResuming({ settlement, },);
 * ```
 */
export function consolidationWorthResuming(
  { settlement, }: { readonly settlement: ConsolidationSettlement; },
): boolean {
  /**
   * What the gate settled, absent where the slice never reached it.
   */
  const { gate, } = settlement;
  if (gate !== undefined)
    return gate.usable >= CONSOLIDATE_GATE_QUORUM;

  /**
   * How this slice left the stage, which decides four of the five cases on
   * its own now that the slate name is no longer one word for three states.
   */
  const { terminal, } = settlement;
  if (SETTLED_WITHOUT_A_GATE.some(function matches(settled,): boolean {
    return settled === terminal;
  },))
    return true;

  if (terminal !== 'slate-declined-standing')
    return false;

  /**
   * What the judges decided, which separates the settled decline this stage
   * records after a second round from the two a second round might change.
   */
  const { decided, } = settlement;
  if (decided === undefined)
    return false;

  return !UNSETTLED_DECISIONS.some(function matches(unsettled,): boolean {
    return unsettled === decided.decision;
  },);
}

/**
 * Reads which lane the contest backed out of the verdict it recorded.
 *
 * BOTH WAYS OF NOT SETTLING READ AS `neither`, deliberately. The record keeps
 * `settled-neither` apart from `quorum-not-met` because they are different
 * facts about the run, but this stage asks one question of them: is there a
 * standing text to improve on. There is not, either way, and `standingTextFor`
 * answers the empty string for both, which stops the settlement before it buys
 * anything.
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
 * @param modelIds - roster to ask
 *
 * @param identityContext - names and handles both documents declare
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
 * @param l - logger to tag
 *
 * @returns One record per consolidated slice, in comparison-row order
 *
 * @throws Error - when a contested slice has no row in the repair ledger, which
 * means the comparison and the ledger disagree about which slices exist
 *
 * @example
 * ```ts
 * const slices = await consolidateDocument({ client, projected, contests, modelIds, lineStructuredSlices, pictureContextBySlice, neighbourContextBySlice, cache, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function consolidateDocument(
  {
    client,
    projected,
    contests,
    modelIds,
    identityContext,
    lineStructuredSlices,
    pictureContextBySlice,
    neighbourContextBySlice,
    cache,
    signal,
    perCallTimeoutMs,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly projected: ProjectedLanes;
    readonly contests: readonly ArtifactContestSlice[];
    readonly modelIds: readonly RosterModelId[];
    readonly identityContext?: string;
    readonly lineStructuredSlices: ReadonlySet<number>;
    readonly pictureContextBySlice: ReadonlyMap<number, string>;
    readonly neighbourContextBySlice: ReadonlyMap<number, SliceNeighbourContext>;
    readonly cache: SliceCache<ConsolidationSettlement>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
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
  },);

  /**
   * One record per consolidated slice, in comparison-row order.
   */
  const slices: ArtifactConsolidateSlice[] = [];

  dl.info(`consolidation: ${String(contests.length,)} contested slices to settle`,);
  for (const row of projected.comparison) {
    /**
     * What the contest settled here, absent where it never ran.
     */
    const contest = contestBySlice.get(row.sliceIndex,);
    if (contest === undefined)
      continue;

    /**
     * Original of this slice, which every ledger row carries.
     */
    const sourceText = sourceTexts.get(row.sliceIndex,);
    if (sourceText === undefined)
      throw new ConsolidationLedgerGapError({ sliceIndex: row.sliceIndex, },);

    /**
     * Wording that would ship without this stage.
     */
    const standingText = standingTextFor({
      choice: laneChoiceOf({ verdict: contest.verdict, },),
      repairText: row.repairText,
      translateText: row.translateText,
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

    /* oxlint-disable no-await-in-loop -- sequential by design, matching `contestDocumentLanes` and `translateDocument`: the client`s limiter grants one stream per model, so consolidating two slices at once queues behind the same slot rather than doubling throughput, and settling one slice before starting the next is what makes an aborted run resumable to the slice it reached */

    /**
     * What the roster settled here, bought or resumed.
     */
    const settlement = resumed ?? await (async function settleFresh(): Promise<ConsolidationSettlement> {
      // NO STANDING TEXT BUYS NO SLATE. `settleConsolidation` refuses such a
      // slice before judging anything, so a producer round bought for it, one
      // roster of calls plus up to one roster of repairs, was discarded whole;
      // on a night the contest lost quorum every contested slice paid it. The
      // settlement is still taken from the settle half, handed an empty slate,
      // so the terminal, its floor and its findings come from one place.
      if (standingText === '') {
        dl.info(`slice ${String(row.sliceIndex,)}: no standing text to consolidate against, so no slate is bought`,);
        return settleConsolidation({
          client,
          roster: modelIds,
          subject,
          voices: [],
          validity: [],
          producedFindings: [],
          standingText,
          lineStructured,
          signal,
          perCallTimeoutMs,
          l: dl,
        },);
      }

      /**
       * Slate this run buys, produced once and judged once, per `#109`.
       */
      const produced = await produceConsolidations({
        client,
        roster: modelIds,
        subject,
        standingText,
        signal,
        perCallTimeoutMs,
        l: dl,
      },);

      return settleConsolidation({
        client,
        roster: modelIds,
        subject,
        voices: produced.voices,
        validity: produced.validity,
        producedFindings: produced.findings,
        standingText,
        lineStructured,
        signal,
        perCallTimeoutMs,
        l: dl,
      },);
    })();
    if ((resumed === undefined) && consolidationWorthResuming({ settlement, },)) {
      await cache.persist({
        key,
        serialized: JSON.stringify(settlement,),
      },);
    }
    /* oxlint-enable no-await-in-loop */
    slices.push(describeConsolidateSlice({
      sliceIndex: row.sliceIndex,
      settlement,
    },),);
  }
  return slices;
}

//endregion Consolidate driver
