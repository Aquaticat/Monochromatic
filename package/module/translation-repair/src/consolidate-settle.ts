import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  type ConsolidateGateOutcome,
  gateConsolidatedSlice,
} from './consolidate-gate-stage.ts';
import {
  floorConsolidateSlate,
  type ProposalValidity,
  type SlateFloor,
} from './consolidate-validity-floor.ts';
import type { SliceValidation, } from './translate-validate.ts';
import { wrapConsolidation, } from './consolidate-wrap.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import { buildTranslateCandidates, } from './translate-candidates.ts';
import { judgeTranslateSlate, } from './translate-judge.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';
import type { HeardVoice, } from './stage-quorum.ts';
import type { TranslateReportWire, } from './translate-wire.ts';

//region Consolidate settle
// RUNS THE CONSOLIDATION'S DECIDING HALF, in the order `#138` specifies: floor
// the slate, judge it against the standing text, gate what wins, wrap what
// ships.
//
// The producing half is deliberately NOT here. `#109` split producing from
// judging so one slate can be judged more than once, and every measurement of
// this stage rests on that split: an arm that rebought its slate would compare
// different candidates. This takes voices already gathered and repaired.
//
// EACH STEP EXISTS BECAUSE A RECORDED RUN NEEDED IT, not because the shape
// looked incomplete:
//
//    -   The floor, because `Zha_Ke#1` finished its repair round with five
//        candidates and zero valid ones, in both runs of the band pair, and
//        shipped a consolidation at both.
//    -   The gate, because the selector's question is a preference while the
//        contest's question measured better on the lane pair, so a preferred
//        consolidation still has to beat the standing text on what the original
//        supports.
//    -   The wrap, because both lanes wrap at their assembly step and this
//        stage had none.
//
// `doc/planning/the-third-rendering.md` records all three.

/**
 * How a slice left this stage, as one name rather than as a shape the reader
 * has to reconstruct from several optional fields.
 *
 * `incumbent-only` IS ITS OWN STATE ON PURPOSE. The calibration bed recorded
 * the floor's case as `judged`, which is exactly the misreading the floor
 * exists to prevent: nothing was judged, because there was nothing valid to
 * judge. A reader counting decisions must be able to tell that apart from a
 * panel that considered proposals and preferred the standing text.
 *
 * @example
 * ```ts
 * const terminal: ConsolidationTerminal = 'incumbent-only';
 * ```
 */
export type ConsolidationTerminal =
  | 'incumbent-only'
  | 'no-standing-text'
  | 'slate-kept-standing'
  | 'gate-kept-standing'
  | 'wrap-erased-difference'
  | 'consolidated';

/**
 * One voice's structural verdict WITHOUT its text, which is what a record of
 * this stage may carry.
 *
 * The proposals themselves are corpus renderings and do not belong in a
 * settlement a run writes out. Who was refused and why does: run 8 carried 7
 * invalid candidates across slices that all shipped normally, and nothing
 * downstream could see them.
 *
 * @example
 * ```ts
 * const verdict: ProposalVerdict = { modelId: 'hf:cat/Cat-A', kind: 'valid', findings: [], };
 * ```
 */
export type ProposalVerdict = {
  /**
   * Voice that wrote the proposal.
   */
  readonly modelId: string;

  /**
   * What the structural guard made of it.
   */
  readonly kind: SliceValidation['kind'];

  /**
   * Why it was refused, empty when it was not.
   */
  readonly findings: readonly string[];
};

/**
 * The slice this stage is deciding about, in the archive's terms.
 *
 * @example
 * ```ts
 * const subject: ConsolidationSubject = { sourceText: '猫', incumbentText: 'A cat.', };
 * ```
 */
export type ConsolidationSubject = {
  /**
   * Chinese this passage renders, which is the standard both deciders judge
   * against.
   */
  readonly sourceText: string;

  /**
   * Wording the ARCHIVE carries, which is not the standing text once a lane
   * contest has replaced it. The gate is shown both, because a consolidation
   * that quietly restores an archive invention is a different fault from one
   * that departs from the text now in place.
   */
  readonly incumbentText: string;

  /**
   * Front matter identity, absent when the pair declares none.
   */
  readonly identityContext?: string;
};

/**
 * Everything this stage settled, with every round it did not run named absent.
 *
 * @example
 * ```ts
 * const settled: ConsolidationSettlement = { terminal: 'incumbent-only', text: 'A cat.', floor, rewrapped: false, demoted: false, };
 * ```
 */
export type ConsolidationSettlement = {
  /**
   * How the slice left, which is the field a census should count.
   */
  readonly terminal: ConsolidationTerminal;

  /**
   * Wording that ships.
   */
  readonly text: string;

  /**
   * What the validity floor made of the slate, kept even when it passed.
   *
   * NAMES REFUSALS ONLY WHEN NOTHING SURVIVED. A slate with one survivor and
   * five refusals reports the survivor and says nothing about the five, which
   * is right for the floor's own question and wrong for a record of the run.
   * `verdicts` is what carries the rest.
   */
  readonly floor: SlateFloor;

  /**
   * Every voice's verdict, survivors and refusals alike, without their text.
   */
  readonly verdicts: readonly ProposalVerdict[];

  /**
   * What the slate judges settled, absent when no slate reached them.
   */
  readonly decided?: TranslateStageResult;

  /**
   * What the gate settled, absent when no fresh consolidation won the slate.
   */
  readonly gate?: ConsolidateGateOutcome;

  /**
   * Whether the wrap altered what the producer emitted.
   */
  readonly rewrapped: boolean;

  /**
   * Whether wrapping left nothing between the consolidation and what stands.
   */
  readonly demoted: boolean;
};

/**
 * Settles one slice's consolidation, from a slate already produced.
 *
 * @param client - provider client the rounds borrow
 *
 * @param roster - voices seated for both rounds
 *
 * @param subject - slice in the archive's terms
 *
 * @param voices - consolidations gathered and repaired, in any order
 *
 * @param validity - each voice's structural verdict, keyed by the same model id
 *
 * @param producedFindings - what gathering and repairing recorded, which every
 * exit reports ahead of its own by `ProducedSlate`'s contract
 *
 * @param standingText - wording in place when this stage began, which is what a
 * consolidation has to beat and what ships whenever it does not
 *
 * @param signal - cancellation for the whole settlement
 *
 * @param perCallTimeoutMs - bound on any single exchange
 *
 * @param l - stage logger
 *
 * @returns What ships, and every round that decided it
 *
 * @throws BlankSelectionError - when the slate judges settle on nothing at all
 *
 * @example
 * ```ts
 * const settled = await settleConsolidation({ client, roster, subject, voices, validity, producedFindings, standingText, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function settleConsolidation(
  {
    client,
    roster,
    subject,
    voices,
    validity,
    producedFindings,
    standingText,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly roster: readonly SyntheticModelId[];
    readonly subject: ConsolidationSubject;
    readonly voices: readonly HeardVoice<TranslateReportWire>[];
    readonly validity: readonly ProposalValidity[];
    readonly producedFindings: readonly string[];
    readonly standingText: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ConsolidationSettlement> {
  /**
   * Logger tagged with this stage.
   */
  const sl = tagged({
    tag: settleConsolidation.name,
    l,
  },);

  /**
   * Identity as the two rounds take it, spread rather than passed as
   * `undefined` so an absent identity is absent rather than declared empty.
   */
  const identity = (subject.identityContext === undefined)
    ? {}
    : { identityContext: subject.identityContext, };

  /**
   * What the structural guard leaves of the slate.
   */
  const floor = floorConsolidateSlate({
    validity,
    l: sl,
  },);

  /**
   * Every voice's verdict without its text, which is what a run may record.
   */
  const verdicts: readonly ProposalVerdict[] = validity.map(
    function toVerdict(
      {
        modelId,
        validation,
      }: ProposalValidity,
    ): ProposalVerdict {
      return {
        modelId,
        kind: validation.kind,
        findings: (validation.kind === 'invalid') ? validation.findings : [],
      };
    },
  );

  // NO STANDING TEXT IS CHECKED FIRST, and the order is the whole point.
  // A slice with nothing to consolidate against and a slate of refusals is
  // both things at once, and a census counting terminal states has to be told
  // which one it is. The absent standing text is the older and larger fact:
  // the floor would have refused a slate this slice was never going to use.
  //
  // `buildTranslateCandidates` offers a blank incumbent as no candidate at all,
  // which is right for a passage nobody translated and wrong for a contest that
  // declined, so this records the consolidations and stops rather than putting
  // "ship nothing" on the ballot.
  if (standingText === '') {
    sl.warn('consolidation: no standing text to judge against, so the slice keeps what it had',);
    return {
      terminal: 'no-standing-text',
      text: standingText,
      floor,
      verdicts,
      rewrapped: false,
      demoted: false,
    };
  }

  // A SLATE WITH NOTHING VALID ON IT ENDS HERE, before either round is bought.
  // The gate's question is which rendering is more faithful, and that has no
  // meaning when the only proposals are structurally not the page.
  if (floor.kind === 'incumbent-only')
    return {
      terminal: 'incumbent-only',
      text: standingText,
      floor,
      verdicts,
      rewrapped: false,
      demoted: false,
    };

  /**
   * Model ids the floor passed, read off the floor so the filter below takes
   * one member step rather than two.
   */
  const { validModelIds, } = floor;

  /**
   * Voices the floor passed, which is what the slate may carry.
   */
  const survivingVoices = voices.filter(function survived(voice,): boolean {
    return validModelIds.includes(voice.modelId,);
  },);

  /**
   * Distinct proposals the judges will see, incumbent among them.
   */
  const built = buildTranslateCandidates({
    voices: survivingVoices,
    translatorModelIds: roster,
    incumbentText: standingText,
  },);

  /**
   * What the slate judges settled.
   */
  const decided = await judgeTranslateSlate({
    client,
    produced: {
      candidates: built.candidates,

      // SURVIVORS RATHER THAN VOICES HEARD, because this number exists to tell
      // the judges how thin the slate they are deciding over is, and a refused
      // proposal is not on it. A census reading this for transport health would
      // misread a refusal as a lost voice; `verdicts` is what separates them.
      heardTranslators: survivingVoices.length,

      findings: [
        ...producedFindings,
        ...built.findings,
      ],
    },
    judgeModelIds: roster,
    sourceText: subject.sourceText,
    incumbentText: standingText,
    incumbentKind: 'present',
    ...identity,
    signal,
    perCallTimeoutMs,
    l: sl,
  },);

  // THE JUDGES CHOOSING THE INCUMBENT ENDS IT. There is no consolidation to
  // gate, and asking the gate anyway would buy ballots about the text that is
  // already in place.
  if (decided.origin !== 'fresh')
    return {
      terminal: 'slate-kept-standing',
      text: standingText,
      floor,
      verdicts,
      decided,
      rewrapped: false,
      demoted: false,
    };

  /**
   * What the gate made of the consolidation that won the slate.
   */
  const gate = await gateConsolidatedSlice({
    client,
    modelIds: roster,
    subject: {
      sourceText: subject.sourceText,
      incumbentText: subject.incumbentText,
      consolidatedText: decided.text,
      standingText,
      ...identity,
    },
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    l: sl,
  },);

  /**
   * What ships once the semantic wrap has been applied and demotion re-derived.
   */
  const wrapped = wrapConsolidation({
    outcome: gate,
    consolidatedText: decided.text,
    standingText,
    l: sl,
  },);

  /**
   * Which of the three ways this slice could keep its standing text it took,
   * kept apart because they answer different questions about the roster.
   */
  const terminal: ConsolidationTerminal = (wrapped.ships === 'consolidated')
    ? 'consolidated'
    : (wrapped.demoted ? 'wrap-erased-difference' : 'gate-kept-standing');

  return {
    terminal,
    text: wrapped.text,
    floor,
    verdicts,
    decided,
    gate,
    rewrapped: wrapped.rewrapped,
    demoted: wrapped.demoted,
  };
}

//endregion Consolidate settle
