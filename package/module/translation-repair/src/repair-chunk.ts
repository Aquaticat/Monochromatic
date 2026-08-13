import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import { aggregateClaims, } from './aggregate-claims.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { runChunkCriticPhase, } from './chunk-critic-phase.ts';
import {
  measurePatchedCandidate,
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
  selectRepairCandidate,
  UNCHANGED_CANDIDATE_ID,
  UNCHANGED_MEASUREMENTS,
} from './select-candidate.ts';

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
 * @param models - role roster
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param identityContext - declared names from both sides' front matter,
 * passed down from the whole document because chunk text carries no front
 * matter of its own
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
    models,
    adjudicationConfig,
    identityContext,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly chunkIndex: number;
    readonly sourceText: string;
    readonly targetText: string;
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly identityContext?: string;
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
    nonTranslationVotes: critic.nonTranslationVotes,
    nonTranslationContradicted: critic.contradicted,
    nonTranslationStanding: critic.votesStand,
    heardCritics: critic.heardCritics,
    heardCriticIds: critic.heardCriticIds,
    claimAttributions: critic.claimAttributions,
  };
  if (critic.votesStand) {
    l.warn(
      `chunk ${String(chunkIndex,)}: ${
        String(critic.nonTranslationVotes,)
      } non-translation votes stand; slice ships unchanged`,
    );
    return {
      ...unchangedOutcome,
      issues: [],
      findings: [
        ...critic.findings,
        `non-translation votes stand (${
          String(critic.nonTranslationVotes,)
        }/${String(critic.heardCritics,)} heard); slice unchanged`,
      ],
    };
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
   * SOURCE is line-structured.
   */
  const editorAddendum = buildEditorAddendum({
    baseAddendum: models.editorRuleAddendum ?? '',
    sourceText,
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
    // Withheld on purpose: rendering the accepted issues into the prompt was
    // measured to silence this stage, and `introduced-defect-screen.ts` now
    // dismisses a claim that merely restates one.
    disclosure: 'withheld',
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Issue ids the checker majority confirmed fixed.
   */
  const resolvedIssueIds = creditableIssues
    .filter(function isResolved(issue,) {
      return checker.tallies[issue.issueId]
        ?.resolved
        === true;
    },)
    .map(function toId(issue,) {
      return issue.issueId;
    },);

  /**
   * Selection between unchanged and the patched candidate.
   */
  const selection = selectRepairCandidate({
    candidates: [
      {
        candidateId: UNCHANGED_CANDIDATE_ID,
        text: targetText,
        measurements: UNCHANGED_MEASUREMENTS,
      },
      {
        candidateId: `candidate/chunk-${String(chunkIndex,)}`,
        text: editor.patch
          .patchedText,
        measurements: measurePatchedCandidate({
          acceptedIssues: creditableIssues,
          tallies: checker.tallies,
          resolvedTotal: resolvedIssueIds.length,
          envelopes,
          applied: editor.patch
            .applied,
          patchedDocument: parseDocument({ text: editor.patch
            .patchedText, },),
          targetDocument: documents.target,
        },),
      },
    ],
  },);

  /**
   * Whether the repaired candidate demonstrably won.
   */
  const changed = selection.winner
    .candidateId
    !== UNCHANGED_CANDIDATE_ID;
  l.info(
    `chunk ${String(chunkIndex,)}: ${changed ? 'repaired' : 'unchanged'}, ${
      String(resolvedIssueIds.length,)
    }/${String(creditableIssues.length,)} served accepted issues resolved (${
      String(acceptedIssues.length,)
    } accepted, ${String(unenveloped.length,)} unenveloped)`,
  );

  return {
    chunkIndex,
    repairedText: selection.winner
      .text,
    changed,
    issues: deduped.issues,
    resolvedIssueIds: changed ? resolvedIssueIds : [],
    candidateResolvedIssueIds: acceptedIssues
      .filter(function confirmedOnCandidate(issue,) {
        return checker.tallies[issue.issueId]
          ?.resolved
          === true;
      },)
      .map(function toId(issue,) {
        return issue.issueId;
      },),
    repairRegions,
    introducedDefects,
    accuracyPatchSelected: changed,
    refined: false,
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
    ],
  };
}

//endregion Chunk repair
