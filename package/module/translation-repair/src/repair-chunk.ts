import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import { aggregateClaims, } from './aggregate-claims.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import {
  nonTranslationVotesStand,
  screenNonTranslationVotes,
} from './non-translation-evidence.ts';
import { measurePatchedCandidate, } from './chunk-measure.ts';
import { deriveEditableEnvelopes, } from './patch-model.ts';
import { parseDocument, } from './parse-document.ts';
import { collectRepairRegions, } from './repair-region.ts';
import {
  assertCheckerIndependence,
  type ChunkRepairOutcome,
  type RepairModels,
} from './repair-contract.ts';
import { runCheckerStage, } from './repair-edit-stages.ts';
import { runEditorStage, } from './repair-editor-stage.ts';
import {
  runCriticStage,
  runPanelStage,
} from './repair-stages.ts';
import {
  selectRepairCandidate,
  UNCHANGED_CANDIDATE_ID,
  UNCHANGED_MEASUREMENTS,
} from './select-candidate.ts';

//region Chunk repair
// One chunk pair through the whole loop: critics, aggregation, panel,
// envelopes, editor, apply gate, checkers, measurement, selection. Every
// early exit returns the chunk unchanged with whatever issues were decided;
// the unchanged text always competes and wins by default.
// The roster and outcome types live in repair-contract.ts.

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
   * Critic fan-out result.
   */
  const critic = await runCriticStage({
    client,
    criticModelIds: models.criticModelIds,
    sourceText,
    targetText,
    documents,
    ...(identityContext === undefined ? {} : { identityContext, }),
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Vote screening against deterministic evidence; contradicted votes
   * fall together with their claims.
   */
  const screening = screenNonTranslationVotes({
    votes: critic.nonTranslationVotes,
    claims: critic.claims,
  },);
  if (screening.contradicted) {
    l.warn(
      `chunk ${String(chunkIndex,)}: ${
        String(critic.nonTranslationVotes,)
      } non-translation votes dismissed: ${screening.findings
        .join('; ',)}`,
    );
  }

  /**
   * Critic findings plus the contradiction record when votes fell.
   */
  const criticFindings = [
    ...critic.findings,
    ...screening.findings,
  ];

  /**
   * Whether votes met the block threshold uncontradicted.
   */
  const votesStand = nonTranslationVotesStand({
    votes: critic.nonTranslationVotes,
    contradicted: screening.contradicted,
  },);

  /**
   * Unchanged outcome shared by every early exit.
   */
  const unchangedOutcome = {
    chunkIndex,
    repairedText: targetText,
    changed: false,
    resolvedIssueIds: [],
    repairRegions: [],
    accuracyPatchSelected: false,
    refined: false,
    nonTranslationVotes: critic.nonTranslationVotes,
    nonTranslationContradicted: screening.contradicted,
    nonTranslationStanding: votesStand,
    heardCritics: critic.heardCritics,
  };
  if (votesStand) {
    l.warn(
      `chunk ${String(chunkIndex,)}: ${
        String(critic.nonTranslationVotes,)
      } non-translation votes stand; slice ships unchanged`,
    );
    return {
      ...unchangedOutcome,
      issues: [],
      findings: [
        ...criticFindings,
        `non-translation votes stand (${
          String(critic.nonTranslationVotes,)
        }/${String(critic.heardCritics,)} heard); slice unchanged`,
      ],
    };
  }
  if (screening.claims
    .length
    === 0) {
    l.info(`chunk ${String(chunkIndex,)}: no validated claims, unchanged`,);
    return {
      ...unchangedOutcome,
      issues: [],
      findings: criticFindings,
    };
  }

  /**
   * Merge-proposal clusters over the validated claims.
   */
  const { clusters, } = aggregateClaims({ claims: screening.claims, },);

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
   * Findings across the stages so far.
   */
  const stageFindings = [
    ...criticFindings,
    ...panel.findings,
  ];

  /**
   * Envelopes cut from accepted issues.
   */
  const {
    envelopes,
    unenveloped,
  } = deriveEditableEnvelopes({
    issues: panel.issues,
    targetText,
  },);
  if (envelopes.length === 0) {
    l.info(`chunk ${String(chunkIndex,)}: nothing to edit, unchanged`,);
    return {
      ...unchangedOutcome,
      issues: panel.issues,
      findings: stageFindings,
    };
  }

  /**
   * Accepted issues, the editor's and checkers' work list.
   */
  const acceptedIssues = panel.issues
    .filter(function isAccepted(issue,) {
    return issue.status === 'accepted';
  },);

  /**
   * Editor result through the apply gate.
   */
  const editor = await runEditorStage({
    client,
    editorModelIds: models.editorModelIds,
    judgeModelIds: models.judgeModelIds,
    ...(models.editorRuleAddendum === undefined
      ? {}
      : { editorRuleAddendum: models.editorRuleAddendum, }),
    sourceText,
    targetText,
    envelopes,
    issues: panel.issues,
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
      issues: panel.issues,
      findings: [
        ...stageFindings,
        ...editor.findings,
      ],
    };
  }

  /**
   * Accepted issues an applied operation actually served.
   *
   * Selection credit is limited to these. Checkers are asked about every
   * accepted issue, including ones no envelope could be cut for and ones whose
   * envelope received no surviving operation, and a checker reading the patched
   * text can call such an issue fixed. Counting that toward the patched
   * candidate let a patch touching issue A beat unchanged on credit for issue B
   * that nothing touched, which is not evidence the patch improved anything.
   * The verdicts on unserved issues stay in the tallies as telemetry; they just
   * no longer decide the selection.
   */
  const servedIssueIds = new Set(
    editor.patch
      .applied
      .flatMap(function servedBy(operation,) {
        return envelopes.find(function matches(candidate,) {
          return candidate.envelopeId === operation.envelopeId;
        },)
          ?.issueIds
          ?? [];
      },),
  );

  /**
   * Accepted issues eligible to count toward the patched candidate.
   */
  const creditableIssues = acceptedIssues.filter(function wasServed(issue,) {
    return servedIssueIds.has(issue.issueId,);
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
    issues: panel.issues,
    resolvedIssueIds: changed ? resolvedIssueIds : [],
    repairRegions: collectRepairRegions({
      envelopes,
      applied: editor.patch
        .applied,
    },),
    accuracyPatchSelected: changed,
    refined: false,
    nonTranslationVotes: critic.nonTranslationVotes,
    nonTranslationContradicted: screening.contradicted,
    nonTranslationStanding: votesStand,
    heardCritics: critic.heardCritics,
    findings: [
      ...stageFindings,
      ...editor.findings,
      ...checker.findings,
    ],
  };
}

//endregion Chunk repair
