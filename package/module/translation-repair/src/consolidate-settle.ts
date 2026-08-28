import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { SliceSyntax, } from './chunk-document.ts';
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
import {
  wrapConsolidation,
  wrapConsolidationProposals,
} from './consolidate-wrap.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { buildTranslateCandidates, } from './translate-candidates.ts';
import { judgeTranslateSlate, } from './translate-judge.ts';
import type {
  TranslateDecision,
  TranslateStageResult,
} from './translate-stage-result.ts';
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
  | 'slate-endorsed-standing'
  | 'slate-unjudged-standing'
  | 'slate-declined-standing'
  | 'gate-kept-standing'
  | 'wrap-erased-difference'
  | 'consolidated';

/**
 * Which slate terminal a judged round ends in, per decision.
 *
 * THE THREE ANSWER DIFFERENT QUESTIONS ABOUT THE ROSTER, which is why one
 * name for them could not be counted. A roster that endorses the archive is
 * working. A roster that cannot agree is not. A slate carrying one candidate
 * says nothing about the roster at all, because no judge was asked.
 *
 * `no-candidate` JOINS THE UNJUDGED rather than the declined, because nothing
 * reached a judge on that path either, and `no-voice-heard` joins it for the
 * same reason one step earlier: no judge was asked because there was nothing
 * to ask about. They are separate decisions and the same terminal, because
 * what they tell a reader differs while what they tell the consolidation does
 * not. `no-candidate-backed` joins the declined, because candidates existed
 * and the judges backed none of them.
 *
 * A RECORD RATHER THAN A CHAIN, so a decision added to the union fails to
 * typecheck here instead of falling quietly into whichever branch is last.
 */
const SLATE_TERMINALS: Record<TranslateDecision, ConsolidationTerminal> = {
  'judged': 'slate-endorsed-standing',
  'sole-candidate': 'slate-unjudged-standing',
  'no-candidate': 'slate-unjudged-standing',
  'no-voice-heard': 'slate-unjudged-standing',
  'declined-indecision': 'slate-declined-standing',
  'declined-rejection': 'slate-declined-standing',
  'no-candidate-backed': 'slate-declined-standing',
};

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
   * Syntax role requiring dedicated validation and judging.
   */
  readonly syntax?: SliceSyntax;

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

  /**
   * What the pictures near this slice were read to say.
   *
   * DECLARED HERE FROM 2026-08-22, having been PASSED here since `#176`. The
   * driver builds one subject and hands it to both halves, so the field was
   * already arriving; only this type and the judging call were unaware of it,
   * which is precisely how the judges came to weigh proposals written against
   * evidence they could not see.
   */
  readonly pictureContext?: string;

  /**
   * Original of the passages either side, absent for a lone slice.
   */
  readonly neighbouringSourceText?: string;

  /**
   * Archive English of those same passages, which is the half that shows a
   * relocation.
   */
  readonly neighbouringIncumbentText?: string;
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

  /**
   * Everything this slice's rounds recorded, as ONE authoritative list.
   *
   * READ THIS RATHER THAN DIGGING INTO `decided` OR `gate`. Before it existed,
   * the produce half's findings reached a reader only where a judged round or
   * a gate round happened to run, so the two terminals that end before either
   * one, `no-standing-text` and `incumbent-only`, dropped them on every run.
   * Those are exactly the terminals whose findings explain themselves: voice
   * loss and transport failure are why a slate had nothing valid on it.
   *
   * EACH FINDING APPEARS ONCE. The produce half's findings are threaded into
   * the judged round, so a path carrying `decided` already carries them and
   * must not add them again.
   *
   * PER-PROPOSAL VERDICTS STAY OUT, because `verdicts` already records them
   * structurally, and repeating them here would count one refusal twice.
   */
  readonly findings: readonly string[];
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
 * const settled = await settleConsolidation({ client, roster, subject, voices, validity, producedFindings, standingText, lineStructured, signal, perCallTimeoutMs, l, },);
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
    lineStructured,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly roster: readonly RosterModelId[];
    readonly subject: ConsolidationSubject;
    readonly voices: readonly HeardVoice<TranslateReportWire>[];
    readonly validity: readonly ProposalValidity[];
    readonly producedFindings: readonly string[];
    readonly standingText: string;
    readonly lineStructured: boolean;
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
   * Words about this passage that are not the passage: what its pictures were
   * read to say and what stands either side of it.
   *
   * SPREAD PER FIELD RATHER THAN PASSED WHOLE, on the same terms as the
   * identity above it. An absent picture and an empty picture are the same
   * state and must render as no heading at all, since a heading promising
   * readings and carrying none reads as a picture nobody could make sense of.
   *
   * ONE VALUE FEEDS THE SHEET AND THE KEY, which is `#107`'s lesson stated in
   * `translate-document.ts` as well: a key that did not name the evidence would
   * let a narrow run's answer be resumed for a wide one, and nothing anywhere
   * would report the two as different questions.
   */
  const evidence = {
    ...(((subject.pictureContext === undefined) || (subject.pictureContext === ''))
      ? {}
      : { pictureContext: subject.pictureContext, }),
    ...(((subject.neighbouringSourceText === undefined) || (subject.neighbouringSourceText === ''))
      ? {}
      : { neighbouringSourceText: subject.neighbouringSourceText, }),
    ...(((subject.neighbouringIncumbentText === undefined)
        || (subject.neighbouringIncumbentText === ''))
      ? {}
      : { neighbouringIncumbentText: subject.neighbouringIncumbentText, }),
  };

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
      findings: producedFindings,
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
      findings: producedFindings,
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
   * Those same proposals as they would actually ship.
   *
   * WRAPPED BEFORE THE SLATE IS BUILT rather than after the gate has spoken,
   * which is the whole of `#162`. Wrapping only the winner leaves both
   * deciders judging bytes the run then changes, and it did: over the two most
   * recent runs of the band pair 15 of the 16 shipped consolidations came back
   * from `wrapConsolidation` altered.
   *
   * IT ALSO COLLAPSES THE WHITESPACE CASE FOR FREE. A proposal differing from
   * an already-wrapped standing text only in where its lines break becomes that
   * text exactly, the candidate dedup folds it into the incumbent, and a slate
   * left holding the incumbent alone settles unjudged without buying a slate
   * round or a gate round.
   */
  const shippableVoices = wrapConsolidationProposals({
    voices: survivingVoices,
    lineStructured,
  },);

  /**
   * Distinct proposals the judges will see, incumbent among them.
   */
  const built = buildTranslateCandidates({
    voices: shippableVoices,
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

    // TRUE BY THE GUARD ABOVE RATHER THAN BY ASSUMPTION, and spelled as a
    // literal because there is nothing here to read it from. What the judges
    // fall back on at this stage is `standingText`, not the archive's own
    // wording, and the `standingText === ''` exit about ninety lines up returns
    // `no-standing-text` before any judge is bought. So a slate reaching this
    // call always has a text to keep. Threading the slice`s own
    // `incumbentKind` here would say something different and wrong: an anchor
    // whose lanes both produced wording has a standing text to fall back on
    // even though the archive holds none.
    incumbentKind: 'present',
    ...((subject.syntax === undefined) ? {} : { syntax: subject.syntax, }),
    ...identity,
    // WHAT THE PRODUCERS WERE SHOWN, forwarded rather than recomputed. `#176`
    // put the pictures in front of the producers and left the judges blind,
    // which is worse than both being blind: a producer that used a picture
    // correctly then looked to its judge like one inventing detail.
    ...evidence,
    // THE SAME FLAG THE PRODUCERS WERE GIVEN, which this function has held
    // since it was written and passed to nobody. `#176` gave it to the
    // consolidation producers; leaving the judges out of it would have the
    // judges mark down exactly the unmerging the producers were told to do.
    lineStructured,
    signal,
    perCallTimeoutMs,
    l: sl,
  },);

  // THE JUDGES CHOOSING THE INCUMBENT ENDS IT. There is no consolidation to
  // gate, and asking the gate anyway would buy ballots about the text that is
  // already in place.
  if (decided.origin !== 'fresh')
    return {
      terminal: SLATE_TERMINALS[decided.decision],
      text: standingText,
      floor,
      verdicts,
      decided,
      rewrapped: false,
      demoted: false,
      findings: decided.findings,
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
    lineStructured,
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

    // The judged round already carries the produce half's findings, so
    // adding them again here would report one voice loss twice.
    findings: [
      ...decided.findings,
      ...gate.findings,
    ],
  };
}

//endregion Consolidate settle
