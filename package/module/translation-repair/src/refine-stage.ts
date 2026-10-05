import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  type Candidate,
  producerModelIds,
} from './candidate-select-model.ts';
import { selectBestCandidate, } from './candidate-select-record.ts';
import { wordForCount, } from './count-word.ts';
import { mergeIdenticalCandidates, } from './candidate-merge.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import {
  declaredNameRefusalFinding,
  findDroppedDeclaredNames,
} from './declared-name-survival.ts';
import type { EditableEnvelope, } from './patch-model.ts';
import { buildRefineMessages, } from './refine-prompt.ts';
import {
  buildRefineSelectionContext,
  type RefineStageMode,
} from './refine-selection-context.ts';
import {
  type AppliedReply,
  applyReply,
  inRosterOrder,
  resolveReply,
  type ResolvedReply,
} from './refine-stage-replies.ts';
import {
  isRefineReportWire,
  REFINE_RESPONSE_FORMAT,
} from './refine-wire.ts';
import { assertJudgeableProducerRoster, } from './repair-contract.ts';
import {
  CHUNK_SCOPE_ENVELOPE,
  describeJudgedRound,
  type RepairJudgedRound,
} from './repair-round-record.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { writerRoundGraceMs, } from './writer-grace-override.ts';

//region Refinement stage
// One slice's naturalness pass over already-repaired text.
//
// Comparative exits without a clear win retain accepted input. Required
// correction exits distinguish that same byte result as no correction because
// independent review has already made fallback inadmissible. Candidate ties
// never manufacture approval in either mode.

/**
 Everything one slice's refinement decided.

 @example
 ```ts
 const { refinedText, changed, } = await runRefineStage({ ... },);
 ```
 */
export type RefineStageResult = {
  /**
   Text selected by refinement; equals input on non-selection.
   */
  readonly refinedText: string;

  /**
   Whether a refinement actually won.
   */
  readonly changed: boolean;

  /**
   Ballots of this slice's refinement round, empty when it never reached the
   judges.

   Recorded on EVERY exit after the round, decline included, because a
   refinement that lost still says what the panel thought of the repaired
   text, and this lane is the one that re-decides text an accuracy verdict
   already accepted.
   */
  readonly rounds: readonly RepairJudgedRound[];

  /**
   Models whose rewrites the shipped text carries, empty when unchanged.

   DISCOUNTED RATHER THAN BARRED, which this said the opposite of. The caller
   folds them into the text's `IssueAuthorship`, and `tally-resolution.ts`
   then weights a checker's verdict on text it helped write at
   `SELF_VOTE_WEIGHT` instead of dropping it. Nothing anywhere stops such a
   checker being asked, and a contract that claims a bar invites a reader to
   skip the guard that actually exists.
   */
  readonly contributors: readonly RosterModelId[];

  /**
   Refiners heard with a usable answer, whether or not it proposed a change.

   CARRIED OUT SO A STANDING CAN TELL ANSWERED FROM SILENT. A rewriter that
   leaves a paragraph as it stands never reaches a slate, and that was once
   reported as provider silence beside a SEAT line saying the seat had
   answered every ask. Empty on the exit that asks nobody.
   */
  readonly heard: readonly RosterModelId[];

  /**
   Stage telemetry in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 Runs the naturalness lane over one repaired slice.

 @param client - injected model client

 @param refinerModelIds - rewriters proposing refinements

 @param judgeModelIds - whole roster selection draws judges from

 @param sourceText - original chunk text, the faithfulness anchor

 @param repairedText - `T1`, the text refinement may improve

 @param envelopes - eligible paragraphs of `repairedText`, in document order

 @param definitions - link and footnote definitions from the whole document,
 so a paragraph's references resolve during gating

 @param identityContext - declared names and handles, when any

 @param referenceContext - what the pages the original cites say, with
 their rule, when the original cites any (class forty-one)

 @param declaredNames - same declarations as strings to compare, since a
 rewrite for naturalness is exactly the edit that drops one

 @param mode - comparative improvement or mandatory absolute-quality correction

 @param sliceIndex - slice being refined, which a refusal names

 @param signal - caller abort honored by every exchange

 @param perCallTimeoutMs - deadline per exchange

 @param l - pipeline logger

 @returns Shipped text plus what decided it

 @throws {@link import('./repair-contract.ts').ProducerRosterError} when the
 roster could not select anything: repeats on either side, no refiner, or
 judges too few to reach the minimum weight

 @example
 ```ts
 const refined = await runRefineStage({ ... },);
 ```
 */
export async function runRefineStage(
  {
    client,
    refinerModelIds,
    judgeModelIds,
    sourceText,
    repairedText,
    envelopes,
    definitions,
    identityContext,
    referenceContext,
    declaredNames,
    mode,
    sliceIndex,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly refinerModelIds: readonly RosterModelId[];
    readonly judgeModelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly repairedText: string;
    readonly envelopes: readonly EditableEnvelope[];
    readonly definitions: string;
    readonly identityContext?: string;
    readonly referenceContext?: string;
    readonly declaredNames: readonly string[];
    readonly mode: RefineStageMode;
    readonly sliceIndex: number;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RefineStageResult> {
  /**
   Logger tagged with this stage.
   */
  const rl = tagged({
    tag: runRefineStage.name,
    l,
  },);

  /**
   Outcome shared by every exit that ships the input untouched.
   */
  const unchanged: RefineStageResult = {
    refinedText: repairedText,
    changed: false,
    contributors: [],
    heard: [],
    rounds: [],
    findings: [`refine-skipped (${String(envelopes.length,)} eligible paragraphs)`,],
  };
  if (envelopes.length === 0)
    return unchanged;
  assertJudgeableProducerRoster({
    producerModelIds: refinerModelIds,
    judgeModelIds,
    role: 'refiner',
  },);

  /**
   Rewriter sheet, one call per slice so a rewriter sees the paragraphs
   together rather than one at a time.
   */
  const plan = buildRefineMessages({
    sourceText,
    envelopes,
    ...(identityContext === undefined ? {} : { identityContext, }),
    ...(referenceContext === undefined ? {} : { referenceContext, }),
    ...((mode.kind === 'objection-correction') ? { objectionGroups: mode.groups, } : {}),
  },);

  /**
   Rewriter replies after retry-to-quorum.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: refinerModelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: REFINE_RESPONSE_FORMAT,
    validate: isRefineReportWire,
    stage: 'refiner',
    // Retries stop at QUORUM, which on this three-refiner roster is two voices.
    // See the same note in `repair-editor-stage.ts`: waiting for every voice
    // let one degraded model stall every gather that seated it, and the user
    // removed the option on 2026-08-15.
    //
    // A WRITER ROUND, so the third voice is a whole candidate and waits under
    // the writer window, built in since 2026-09-06 (`writer-grace-override.ts`).
    graceMs: writerRoundGraceMs(),
    l,
  },);

  /**
   Each heard rewriter's reply bound to real paragraphs and read by the atom
   gate, beside what the resolver dropped from it and what the gate refused,
   in the order the rewriters were heard, which is the order their
   candidates reach the judges.
   */
  const resolved = gather.voices
    .map(function toResolved(voice,): ResolvedReply {
      return resolveReply({
        voice,
        envelopes: plan.envelopes,
        repairedText,
        definitions,
        l: rl,
      },);
    },);

  /**
   The same replies in roster order, so what the stage records against them
   never depends on who answered first.
   */
  const repliesInRosterOrder = inRosterOrder({
    replies: resolved,
    roster: refinerModelIds,
  },);

  /**
   What the resolver recorded against each reply, credited to its rewriter.

   CARRIED INTO THE STAGE'S FINDINGS, as the editor lane carries its
   resolver's (`editor-candidates.ts`). The stage read the operations alone,
   so a rewrite naming a paragraph the sheet never showed, or a paragraph
   already rewritten, was dropped with no finding and no log line: the stage
   reported the refiner as heard and not proposing, which is what it reports
   for a refiner that proposed nothing.
   */
  const resolverFindings = repliesInRosterOrder
    .flatMap(function toFindings(reply,): readonly string[] {
      return reply.resolution
        .findings
        .map(function attribute(finding,): string {
          return `${reply.modelId}: ${finding}`;
        },);
    },);
  for (const finding of resolverFindings)
    rl.info(finding,);

  /**
   What the atom gate refused of each reply, each refusal already credited
   to its rewriter.

   CARRIED INTO THE STAGE'S FINDINGS, as the editor lane counts its own
   rejections there (`repair-editor-stage.ts`). The refusal reached a log
   line alone, so a rewriter whose every rewrite the gate refused read in the
   artifact as one that proposed nothing.
   */
  const gateFindings = repliesInRosterOrder.flatMap(function toRefusals(reply,): readonly string[] {
    return reply.refusals;
  },);

  /**
   What the patch made of each reply, in the order the rewriters were heard,
   which is the order their candidates reach the judges.
   */
  const applied = resolved
    .map(function toApplied(reply,): AppliedReply {
      return applyReply({
        reply,
        repairedText,
        envelopes,
      },);
    },);

  /**
   One gated candidate per rewriter that proposed anything surviving, before
   identical rewrites are merged.
   */
  const proposed = applied.flatMap(function toCandidates(reply,): readonly Candidate<string>[] {
    return reply.candidates;
  },);

  /**
   What the patch refused of each reply, each refusal already credited to its
   rewriter.

   CARRIED INTO THE STAGE'S FINDINGS, as the gate's are. A rewrite that comes
   out as the paragraph it replaces applies nothing, and dropped without a
   word it read as a rewriter that proposed nothing. The patch can refuse an
   operation of this lane for no other reason, and any other reason throws
   (`refine-stage-replies.ts`).
   */
  const patchFindings = inRosterOrder({
    replies: applied,
    roster: refinerModelIds,
  },)
    .flatMap(function toRejections(reply,): readonly string[] {
      return reply.rejections;
    },);

  /**
   Distinct rewrites, each credited to every rewriter that produced it.

   Merging matters for the same reason it does in the editor lane: selection
   discounts a judge's ballot for text that judge produced, and it reads that
   off the candidate's producer. Leaving three identical rewrites as three
   candidates also split the ballot three ways, so text every rewriter agreed
   on could lose to a lone dissenter.
   */
  const candidates = mergeIdenticalCandidates({ candidates: proposed, },);

  /**
   Refiners whose answer was usable, proposal or not.
   */
  const heard = resolved.map(function answered({ modelId, },): RosterModelId {
    return modelId;
  },);

  /**
   Telemetry every exit after the fan-out carries.
   */
  const stageFindings = [
    ...gather.findings,
    ...resolverFindings,
    ...gateFindings,
    ...patchFindings,
    `refine-candidates (${String(gather.voices
      .length,)}/${String(refinerModelIds.length,)} heard, ${
      String(candidates.length,)
    } proposing)`,
  ];
  if (candidates.length === 0) {
    return {
      ...unchanged,
      heard,
      findings: stageFindings,
    };
  }

  /**
   Selector question matching whether current text may survive, which the
   judges answer over the whole-slice proposals with the declared names the
   refiner read (ledger B28).
   */
  const selectionContext = buildRefineSelectionContext({
    mode,
    sourceText,
    repairedText,
    ...(referenceContext === undefined ? {} : { referenceContext, }),
    ...(identityContext === undefined ? {} : { identityContext, }),
  },);
  /**
   Candidate decision over structurally admissible rewrites.
   */
  const outcome = await selectBestCandidate({
    client,
    candidates,
    judgeModelIds,
    sourceText,
    ...selectionContext,
    signal,
    perCallTimeoutMs,
    l,
  },);
  /**
   This round's ballots, recorded before any branch so a decline and a
   refusal keep the reasoning that produced them exactly as a win does.
   */
  const rounds = [
    describeJudgedRound({
      stage: 'refine',
      envelopeId: CHUNK_SCOPE_ENVELOPE,
      candidates,
      outcome,
    },),
  ];
  if (outcome.kind === 'declined') {
    rl.info(`${outcome.reason}; keeping the repaired text`,);
    return {
      ...unchanged,
      heard,
      rounds,
      findings: [
        ...stageFindings,
        ...outcome.findings,
        `refine-declined (${outcome.reason})`,
      ],
    };
  }

  /**
   Models whose work the winning text carries.

   Read through `producerModelIds` rather than by branching on the kind here,
   so a producer variant this lane never emits, the incumbent one the translate
   lane needs, cannot break a stage that has no opinion about it.
   */
  const contributors = [...producerModelIds(outcome.producer,),];

  /**
   Declared names this refinement would take out of the slice.

   CHECKED HERE AS WELL AS AT THE ACCURACY VERDICT, because refinement
   REPLACES the text that verdict accepted. A guard standing only there would
   pass a slice and then let this lane take the name out of it, and
   naturalness is the exact pressure that makes a judge prefer the shorter
   wording: the probe behind `declared-name-survival.ts` measured judges
   choosing it six times out of six.
   */
  const droppedDeclaredNames = findDroppedDeclaredNames({
    forms: declaredNames,
    baseText: repairedText,
    candidateText: outcome.value,
  },);
  if (droppedDeclaredNames.length > 0) {
    /**
     Refusal in the wording every lane reports this under.
     */
    const refusal = declaredNameRefusalFinding({
      sliceIndex,
      dropped: droppedDeclaredNames,
    },);
    rl.warn(`${refusal}; keeping the repaired text`,);
    return {
      ...unchanged,
      heard,
      rounds,
      findings: [
        ...stageFindings,
        ...outcome.findings,
        refusal,
      ],
    };
  }
  rl.info(`refinement from ${contributors.join(' + ',)} won weight ${String(outcome.voteWeight,)}`,);
  return {
    refinedText: outcome.value,
    changed: true,
    contributors,
    heard,
    rounds,
    findings: [
      ...stageFindings,
      ...outcome.findings,
      `refine-selected (weight ${String(outcome.voteWeight,)} of ${String(outcome.tally
        .ballots,)} ${
        wordForCount({
          count: outcome.tally
            .ballots,
          one: 'ballot',
          many: 'ballots',
        },)
      })`,
    ],
  };
}

//endregion Refinement stage
