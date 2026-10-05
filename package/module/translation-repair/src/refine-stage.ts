import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  applyPatchOperations,
  type PatchOperation,
} from './apply-patch.ts';
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
import { gateParagraphRewrite, } from './inspect-paragraph.ts';
import type { EditableEnvelope, } from './patch-model.ts';
import { buildRefineMessages, } from './refine-prompt.ts';
import {
  buildRefineSelectionContext,
  type RefineStageMode,
} from './refine-selection-context.ts';
import {
  isRefineReportWire,
  REFINE_RESPONSE_FORMAT,
  type RefineResolution,
  resolveRefineRewrites,
} from './refine-wire.ts';
import { assertJudgeableProducerRoster, } from './repair-contract.ts';
import {
  CHUNK_SCOPE_ENVELOPE,
  describeJudgedRound,
  type RepairJudgedRound,
} from './repair-round-record.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { restoreTypography, } from './restore-typography.ts';
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
 One heard rewriter's reply after the resolver bound it to the sheet and the
 atom gate read each operation.

 @example
 ```ts
 const reply: ResolvedReply = { modelId, resolution, passed: [], refusals: [], };
 ```
 */
type ResolvedReply = {
  /**
   Rewriter that sent the reply.
   */
  readonly modelId: RosterModelId;

  /**
   Operations the reply's rewrites bound to, and what the resolver dropped
   or folded on the way.
   */
  readonly resolution: RefineResolution;

  /**
   Operations whose replacement carried every protected atom through
   unchanged and in order, quote style restored, in wire order.
   */
  readonly passed: readonly PatchOperation[];

  /**
   One finding per operation the gate refused, credited to the rewriter and
   naming the paragraph and the kind of refusal, in wire order.
   */
  readonly refusals: readonly string[];
};

/**
 The kind of an atom-gate refusal: its detail up to the parenthetical, which
 is where the gate quotes the atoms it compared.

 CUT AS THE EDITOR LANE CUTS ITS REJECTIONS INTO KINDS
 (`repair-editor-stage.ts`), so a refusal's finding carries no atom value: a
 number, a link destination or a foreign run of the paragraph stays in the
 gate's log line and out of the artifact. A changed atom keeps its position
 (`protected atom 2 changed`), and an inspection refusal loses its reason
 (`candidate rejected`); the log line carries both whole.

 @param detail - the gate's account of the refusal

 @returns The detail's words before its first parenthetical, the whole detail
 where it has none

 @example
 ```ts
 gateRefusalKind({ detail: 'protected atom count changed (1 to 0)', },);
 // => 'protected atom count changed'
 ```
 */
function gateRefusalKind({ detail, }: { readonly detail: string; },): string {
  return nonNullishOrThrow(detail.split(' (',)[0],);
}

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
      /**
       Operations the reply's rewrites bound to, and what the resolver
       dropped or folded on the way.
       */
      const resolution = resolveRefineRewrites({
        wire: voice.value,
        envelopes: plan.envelopes,
      },);

      /**
       Each operation the gate passed, quote style restored, or the finding
       for its refusal.
       */
      const judged = resolution
        .operations
        .map(function judge(operation,): PatchOperation | string {
          /**
           Paragraph this operation replaces, present by the resolver's
           own contract: `resolveRefineRewrites` binds an operation only
           to an envelope it found.
           */
          const envelope = nonNullishOrThrow(plan.envelopes
            .find(function matches(candidate,) {
              return candidate.envelopeId === operation.envelopeId;
            },),);

          /**
           Replacement as it will ship, quote style restored, so the gate
           reads the shipped bytes rather than text a later pass alters.
           */
          const candidate = restoreTypography({
            replacement: operation.newText,
            replaced: envelope.baseText,
            convention: repairedText,
          },);

          /**
           Structural verdict over the proposed replacement.
           */
          const verdict = gateParagraphRewrite({
            base: envelope.baseText,
            candidate,
            definitions,
          },);
          if (verdict.kind === 'preserved') {
            return {
              ...operation,
              newText: candidate,
            };
          }
          // THE DETAIL GOES TO THE LOG ALONE, since it quotes the atoms it
          // compared; the finding names the paragraph by its number on the
          // sheet, as the resolver's findings do, and the refusal by kind.
          rl.info(`${voice.modelId}: ${verdict.detail}`,);
          return `${voice.modelId}: refine-atom-gate-refused (paragraph ${
            String(plan.envelopes
              .indexOf(envelope,)
              + 1,)
          }, ${gateRefusalKind({ detail: verdict.detail, },)})`;
        },);
      return {
        modelId: voice.modelId,
        resolution,
        passed: judged.filter(function wasPassed(outcome,): outcome is PatchOperation {
          return (typeof outcome) !== 'string';
        },),
        refusals: judged.filter(function wasRefused(outcome,): outcome is string {
          return (typeof outcome) === 'string';
        },),
      };
    },);

  /**
   The same replies in roster order, so what the stage records against them
   never depends on who answered first.
   */
  const inRosterOrder = resolved
    .toSorted(function byRoster(
      left,
      right,
    ) {
      return refinerModelIds.indexOf(left.modelId,)
        - refinerModelIds.indexOf(right.modelId,);
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
  const resolverFindings = inRosterOrder
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
  const gateFindings = inRosterOrder.flatMap(function toRefusals(reply,): readonly string[] {
    return reply.refusals;
  },);

  /**
   One gated candidate per rewriter that proposed anything surviving, before
   identical rewrites are merged.
   */
  const proposed = resolved
    .flatMap(function toCandidate(reply,) {
      /**
       Operations of this reply the atom gate passed.
       */
      const { passed, } = reply;
      if (passed.length === 0)
        return [];

      /**
       This rewriter's whole-slice proposal through the deterministic gate.
       */
      const patch = applyPatchOperations({
        targetText: repairedText,
        envelopes,
        operations: passed,
        // EXEMPT, stated rather than defaulted. This lane rewrites a whole
        // paragraph for naturalness and has no accepted-issue quotes to license
        // that, so enforcing preservation here would reject exactly the work
        // the lane exists to do.
        preservation: { mode: 'skip', },
      },);
      if (patch.applied
        .length
        === 0)
        return [];
      return [
        {
          producer: {
            kind: 'model',
            modelId: reply.modelId,
          },
          value: patch.patchedText,
          rendered: patch.patchedText,
        } satisfies Candidate<string>,
      ];
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
