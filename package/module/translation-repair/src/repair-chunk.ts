import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import { aggregateClaims, } from './aggregate-claims.ts';
import { declaredNameRefusalReport, } from './declared-name-survival.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { runChunkCriticPhase, } from './chunk-critic-phase.ts';
import {
  candidateConfirmedIssueIds,
  selectCreditableIssues,
} from './chunk-measure.ts';
import { dedupeAcceptedIssues, } from './dedupe-issues.ts';
import { buildEditorAddendum, } from './line-structure-addendum.ts';
import { deriveEditableEnvelopes, } from './patch-model.ts';
import { parseDocument, } from './parse-document.ts';
import { collectRepairRegions, } from './repair-region.ts';
import {
  assertCheckerIndependence,
  type ChunkRepairOutcome,
  type RepairModels,
} from './repair-contract.ts';
import { runCheckerStage, } from './repair-edit-stages.ts';
import { runIntroducedDefectProbe, } from './introduced-defect-probe.ts';
import { runEditorStage, } from './repair-editor-stage.ts';
import { runPanelStage, } from './repair-stages.ts';
import {
  describeChunkSettlement,
  settleChunkFromChecks,
} from './repair-chunk-verdict.ts';

//region Chunk repair
// One chunk pair through the whole loop: critics, aggregation, panel,
// envelopes, editor, apply gate, checkers, the introduced-defect probe,
// measurement, selection. Every early exit returns the chunk unchanged with
// whatever issues were decided; the unchanged text always competes and wins by
// default.
// The roster and outcome types live in repair-contract.ts, and the critic stage
// with its vote screening in chunk-critic-phase.ts.

/**
 * Runs one chunk pair through the whole repair loop.
 *
 * @param client - injected model client
 *
 * @param chunkIndex - chunk position carried onto the outcome
 *
 * @param sourceText - original chunk text
 *
 * @param targetText - translation chunk text
 *
 * @param lineStructured - whether the ENCLOSING chunk's original is
 * line-structured, decided by the caller because a slice is too small a unit to
 * decide it on; see `buildEditorAddendum`
 *
 * @param models - role roster
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param identityContext - declared names from both sides' front matter,
 * passed down from the whole document because chunk text carries no front
 * matter of its own
 *
 * @param declaredNames - same declarations as strings to compare rather than
 * prose to read, which is a different job: one tells a model what is true, the
 * other decides whether a patch may ship
 *
 * @param neighbouringSourceText - original of the passages either side, shown to
 * the critic, panel and editor as CONTEXT they may neither quote against nor
 * edit. `#107` is why it exists: shown one slice alone, a critic reads a passage
 * the archive carried in from next door as an addition with no source, and the
 * editor then removes wording that the document does need, just not here
 *
 * @param neighbouringIncumbentText - archive English of those same two passages,
 * which is the half that shows the relocation rather than merely the subject:
 * the original says each thing once in its own place while the archive says it
 * next door
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Chunk outcome with the winning text
 *
 * @example
 * ```ts
 * const outcome = await repairChunk({ ... },);
 * ```
 */
export async function repairChunk(
  {
    client,
    chunkIndex,
    sourceText,
    targetText,
    lineStructured,
    models,
    adjudicationConfig,
    identityContext,
    declaredNames,
    neighbouringIncumbentText,
    neighbouringSourceText,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly chunkIndex: number;
    readonly sourceText: string;
    readonly targetText: string;
    readonly lineStructured: boolean;
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly identityContext?: string;
    readonly declaredNames: readonly string[];
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ChunkRepairOutcome> {
  assertCheckerIndependence({
    editorModelIds: models.editorModelIds,
    checkerModelIds: models.checkerModelIds,
  },);

  /**
   * Neighbouring evidence, spread into every stage that has to reason about it.
   *
   * BUILT ONCE RATHER THAN PASSED THREE TIMES. The critic, the panel and the
   * editor must see the SAME window or they contradict each other: a critic that
   * can see next door raises a relocation claim, and a panel that cannot see it
   * rejects that claim as unfounded. Three call sites spreading one value cannot
   * drift the way three separate arguments can.
   */
  const windowFragment = {
    ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
    ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
  };

  /**
   * Parsed chunk pair claims anchor against.
   */
  const documents = {
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: targetText, },),
  };

  /**
   * Critics plus the deterministic screen over their non-translation votes.
   */
  const critic = await runChunkCriticPhase({
    client,
    criticModelIds: models.criticModelIds,
    sourceText,
    targetText,
    documents,
    ...(identityContext === undefined ? {} : { identityContext, }),
    ...windowFragment,
    chunkIndex,
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Unchanged outcome shared by every early exit.
   */
  const unchangedOutcome = {
    chunkIndex,
    repairedText: targetText,
    changed: false,
    resolvedIssueIds: [],
    candidateResolvedIssueIds: [],
    repairRegions: [],
    accuracyPatchSelected: false,
    refined: false,
    rounds: [],
    droppedDeclaredNames: [],
    nonTranslationVotes: critic.nonTranslationVotes,
    nonTranslationContradicted: critic.contradicted,
    nonTranslationStanding: critic.votesStand,
    heardCritics: critic.heardCritics,
    heardCriticIds: critic.heardCriticIds,
    claimAttributions: critic.claimAttributions,
  };
  // STANDING NON-TRANSLATION VOTES NO LONGER END THE SLICE. They used to return
  // here with the input unchanged, which threw away whatever this chunk's repair
  // would have produced. Question 3 answer B keeps the critics as EVIDENCE for
  // the judges and removes every early return they owned:
  // `doc/decision/translation-repair-question-answers.md`.
  //
  // WHY IT MATTERED MOST ON THE SLICES THE LANE EXISTS FOR. On a sparse target,
  // a chunk whose critics call it untranslated is the common case rather than
  // the rare one, so the exit fired exactly where the work was most needed and
  // discarded it.
  //
  // NOTHING IS LOST BY PROCEEDING: `nonTranslationStanding` rides on the outcome
  // either way and `critic.findings` are folded into `stageFindings`, so a
  // reader still learns the votes stood. What changes is that the votes now
  // inform rather than decide.
  if (critic.votesStand) {
    l.warn(
      `chunk ${String(chunkIndex,)}: ${
        String(critic.nonTranslationVotes,)
      } non-translation votes stand; proceeding, votes carried as evidence`,
    );
  }
  if (critic.claims
    .length
    === 0) {
    l.info(`chunk ${String(chunkIndex,)}: no validated claims, unchanged`,);
    return {
      ...unchangedOutcome,
      issues: [],
      findings: critic.findings,
    };
  }

  /**
   * Merge-proposal clusters over the validated claims.
   */
  const { clusters, } = aggregateClaims({ claims: critic.claims, },);

  /**
   * Panel decision over the clusters.
   */
  const panel = await runPanelStage({
    client,
    panelModelIds: models.panelModelIds,
    sourceText,
    targetText,
    ...windowFragment,
    clusters,
    ...(adjudicationConfig === undefined ? {} : { adjudicationConfig, }),
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Panel issues with same-place accepted duplicates merged into one.
   *
   * Applied HERE, before envelopes are cut, because the cost a duplicate
   * imposes is the editor repairing one defect twice and cutting two
   * overlapping envelopes for it. Deduplicating after that work is done would
   * correct the arithmetic and keep the waste.
   */
  const deduped = dedupeAcceptedIssues({ issues: panel.issues, },);

  /**
   * Findings across the stages so far.
   */
  const stageFindings = [
    ...critic.findings,
    ...panel.findings,
    ...deduped.findings,
    // NAMED ON THE PROCEEDING PATH, since the exit that used to name it is gone.
    // The wording says what now happens: the votes stood AND the slice was
    // repaired anyway. The old finding said "slice unchanged", which would be a
    // false statement about this path.
    ...(critic.votesStand
      ? [`non-translation votes stand (${
        String(critic.nonTranslationVotes,)
      }/${String(critic.heardCritics,)} heard); repaired anyway, votes are evidence`,]
      : []),
  ];

  /**
   * Envelopes cut from accepted issues.
   */
  const {
    envelopes,
    unenveloped,
  } = deriveEditableEnvelopes({
    issues: deduped.issues,
    targetText,
  },);
  if (envelopes.length === 0) {
    l.info(`chunk ${String(chunkIndex,)}: nothing to edit, unchanged`,);
    return {
      ...unchangedOutcome,
      issues: deduped.issues,
      findings: stageFindings,
    };
  }

  /**
   * Accepted issues, the editor's and checkers' work list.
   */
  const acceptedIssues = deduped.issues
    .filter(function isAccepted(issue,) {
    return issue.status === 'accepted';
  },);

  /**
   * Editor rules for this slice, with the line-structure fact appended when the
   * enclosing chunk's ORIGINAL is line-structured.
   */
  const editorAddendum = buildEditorAddendum({
    baseAddendum: models.editorRuleAddendum ?? '',
    lineStructured,
  },);

  /**
   * Editor result through the apply gate.
   */
  const editor = await runEditorStage({
    client,
    editorModelIds: models.editorModelIds,
    judgeModelIds: models.judgeModelIds,
    ...((editorAddendum === '') ? {} : { editorRuleAddendum: editorAddendum, }),
    sourceText,
    targetText,
    ...windowFragment,
    envelopes,
    issues: deduped.issues,
    signal,
    perCallTimeoutMs,
    l,
  },);
  if (editor.patch
    .applied
    .length
    === 0) {
    l.info(`chunk ${String(chunkIndex,)}: no operation survived the gate, unchanged`,);
    return {
      ...unchangedOutcome,
      issues: deduped.issues,
      rounds: editor.rounds,
      findings: [
        ...stageFindings,
        ...editor.findings,
      ],
    };
  }

  /**
   * Accepted issues eligible to count toward the patched candidate; see
   * `selectCreditableIssues` for why the rest are excluded.
   */
  const creditableIssues = selectCreditableIssues({
    acceptedIssues,
    envelopes,
    applied: editor.patch
      .applied,
  },);

  /**
   * Checker proof over the patched candidate.
   */
  const checker = await runCheckerStage({
    client,
    checkerModelIds: models.checkerModelIds,
    sourceText,
    patchedText: editor.patch
      .patchedText,
    issues: acceptedIssues,
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Regions the accuracy stage replaced.
   */
  const repairRegions = collectRepairRegions({
    envelopes,
    applied: editor.patch
      .applied,
  },);

  /**
   * Shadow-mode audit of damage the edit itself caused.
   *
   * Nothing downstream reads this to decide what ships, on purpose: see
   * `introduced-defect-probe.ts` for why an unmeasured probe must not gate.
   */
  const introducedDefects = await runIntroducedDefectProbe({
    client,
    proberModelIds: models.checkerModelIds,
    sourceText,
    baselineText: targetText,
    regions: repairRegions,
    issues: acceptedIssues,
    // The auditor gets the same window as the stages it audits. Without it,
    // `#66` measured this probe reporting nothing about a duplication whose
    // other half sits in the slice next door, which no setting could have
    // fixed.
    ...windowFragment,
    // Withheld on purpose: rendering the accepted issues into the prompt was
    // measured to silence this stage, and `introduced-defect-screen.ts` now
    // dismisses a claim that merely restates one.
    disclosure: 'withheld',
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Which candidate won, whether the returned text moved at all, and which
   * issues the checkers confirmed.
   *
   * Several verdicts rather than one: a patch whose envelope operations cancel
   * can win selection and write no byte, and a patch that drops a declared name
   * is refused whatever it won. See `settleChunkFromChecks`.
   */
  const {
    repairedText,
    patchSelected,
    changed,
    droppedDeclaredNames,
    resolvedIssueIds,
  } = settleChunkFromChecks({
    chunkIndex,
    declaredNames,
    incumbentText: targetText,
    patchedText: editor.patch
      .patchedText,
    appliedOperations: editor.patch
      .applied,
    creditableIssues,
    tallies: checker.tallies,
    envelopes,
    targetDocument: documents.target,
  },);
  /**
   * What the declared-name refusal owes this slice's record and findings.
   */
  const refusal = declaredNameRefusalReport({
    chunkIndex,
    dropped: droppedDeclaredNames,
  },);
  for (const finding of refusal.findings)
    l.warn(finding,);
  l.info(describeChunkSettlement({
    chunkIndex,
    changed,
    resolvedCount: resolvedIssueIds.length,
    creditableCount: creditableIssues.length,
    acceptedCount: acceptedIssues.length,
    unenvelopedCount: unenveloped.length,
  },),);

  return {
    chunkIndex,
    repairedText,
    changed,
    issues: deduped.issues,
    resolvedIssueIds: changed ? resolvedIssueIds : [],
    candidateResolvedIssueIds: candidateConfirmedIssueIds({
      acceptedIssues,
      tallies: checker.tallies,
    },),
    repairRegions,
    introducedDefects,
    accuracyPatchSelected: patchSelected,
    refined: false,
    rounds: editor.rounds,
    ...refusal.record,
    nonTranslationVotes: critic.nonTranslationVotes,
    nonTranslationContradicted: critic.contradicted,
    nonTranslationStanding: critic.votesStand,
    heardCritics: critic.heardCritics,
    heardCriticIds: critic.heardCriticIds,
    claimAttributions: critic.claimAttributions,
    findings: [
      ...stageFindings,
      ...editor.findings,
      ...checker.findings,
      // The probe fans out to a roster like every other stage and loses voices
      // like every other stage, and its findings were dropped here. That is
      // the exact complaint of the prober calibration work: a quiet stage
      // reads identically to a clean run, so a prober that went silent looked
      // like a prober that found nothing.
      ...introducedDefects.findings,
      ...refusal.findings,
    ],
  };
}

//endregion Chunk repair
