// PROTOTYPE ONLY: Candidate M finite two-wave runtime.

import { join, } from 'node:path';

import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';
import { hashContent, } from './document-node.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import { runRiskAttestedAuthorWave, } from './prototype-risk-challenger-author-wave.ts';
import { assertCandidateMManifest, } from './prototype-risk-challenger-manifest.ts';
import type {
  CandidateMManifest,
  CandidateMSelection,
} from './prototype-risk-challenger-manifest-model.ts';
import type {
  CandidateMAuthorState,
  CandidateMChallengeState,
} from './prototype-risk-challenger-model.ts';
import { runRiskChallengerNode, } from './prototype-risk-challenger-node.ts';
import {
  assertCandidateMChallengerBinding,
  createCandidateMChallengerPlan,
  type CandidateMChallengerPlan,
  type CandidateMChallengerPlanNode,
} from './prototype-risk-challenger-plan.ts';
import { riskChallengerMessages, } from './prototype-risk-challenger-prompt.ts';
import { riskChallengeResponseFormat, } from './prototype-risk-challenger-schema.ts';
import { selectCandidateM, } from './prototype-risk-challenger-selection.ts';
import {
  candidateMCandidates,
  createCandidateMAuthorSettlement,
  type CandidateMAuthorSettlement,
} from './prototype-risk-challenger-settlement.ts';
import {
  assertReviewUnitClient,
  awaitReviewUnitWave,
  type ReviewUnitClient,
} from './prototype-review-unit-runtime-support.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { acquireRealizationRuntimeLease, } from './prototype-realization-runtime-lease.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Complete private Candidate M runtime result.
 */
export type CandidateMRuntimeResult = {
  readonly manifestDigest: string;
  readonly authorStates: readonly CandidateMAuthorState[];
  readonly authorSettlement: CandidateMAuthorSettlement;
  readonly challengerPlan: CandidateMChallengerPlan;
  readonly challengerStates: readonly CandidateMChallengeState[];
  readonly skippedChallengerNodes: readonly CandidateMChallengerPlanNode[];
  readonly completedNodeCount: number;
  readonly spentUnusableNodeCount: number;
  readonly skippedNodeCount: number;
  readonly selection?: CandidateMSelection;
};

/**
 * Executes fixed Candidate M graph in exactly two dependency waves.
 *
 * @returns Persisted private result after all fourteen static nodes terminate
 *
 * @example
 * ```ts
 * const result = await runCandidateMRuntime({ outputDir, boundClient, manifest, expectedManifestDigest, shell, ledger, reviewPlan, sourceText, archiveText, media, restart, signal, });
 * ```
 */
export async function runCandidateMRuntime({
  outputDir,
  boundClient,
  manifest,
  expectedManifestDigest,
  shell,
  ledger,
  reviewPlan,
  sourceText,
  archiveText,
  media,
  restart,
  signal,
}: {
  readonly outputDir: string;
  readonly boundClient: ReviewUnitClient;
  readonly manifest: CandidateMManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<CandidateMRuntimeResult> {
  assertCandidateMManifest({
    manifest,
    ledger,
    shell,
    sourceText,
    sourceBody: shell.body,
    archiveBody: archiveText,
    reviewPlan,
    expectedManifestDigest,
  },);
  assertReviewUnitClient({
    boundClient,
    manifest,
    outputDir,
  },);
  if (signal.aborted)
    throw signal.reason;
  /**
   * Exclusive process-incarnation lease for exact output root.
   */
  await using runtimeLease = await acquireRealizationRuntimeLease({ outputDir, });
  await Promise.all([
    persistRealizationImmutableJson({
      path: join(
        outputDir,
        'manifest-risk-challenger.json',
      ),
      value: manifest,
      label: 'Candidate M manifest',
    },),
    persistRealizationImmutableJson({
      path: join(
        outputDir,
        'review-unit-plan.json',
      ),
      value: reviewPlan,
      label: 'Candidate M review plan',
    },),
  ],);
  /**
   * Page-reference names consumed by deterministic checks.
   */
  const sourcePictures = media.map(function picture(item,) {
    return { assetName: item.assetName, };
  },);
  /**
   * Complete terminal author states after concurrent first wave.
   */
  const authorStates = await runRiskAttestedAuthorWave({
    outputDir,
    client: boundClient.client,
    manifest,
    expectedManifestDigest,
    shell,
    ledger,
    reviewPlan,
    sourceText,
    archiveText,
    media,
    sourcePictures,
    restart,
    signal,
  },);
  /**
   * Runtime-owned total author settlement.
   */
  const authorSettlement = createCandidateMAuthorSettlement({
    states: authorStates,
    manifest,
    shell,
    reviewPlan,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'risk-challenger-author-settlement.json',
    ),
    value: authorSettlement,
    label: 'Candidate M author settlement',
  },);
  if (signal.aborted)
    throw signal.reason;
  /**
   * Complete admitted candidate subset.
   */
  const candidates = candidateMCandidates({
    settlement: authorSettlement,
    manifest,
  },);
  /**
   * Static second-wave Cartesian role plan including skips.
   */
  const challengerPlan = createCandidateMChallengerPlan({
    manifest,
    authorSettlement,
    candidates,
    reviewPlan,
    pictureCount: media.length,
  },);
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'risk-challenger-plan.json',
    ),
    value: challengerPlan,
    label: 'Candidate M challenger plan',
  },);
  if (signal.aborted)
    throw signal.reason;
  /**
   * Candidate lookup by public ordinal.
   */
  const byOrdinal = new Map(candidates.map(function candidate(value,) {
    return [
      value.candidateOrdinal,
      value,
    ] as const;
  },),);
  /**
   * Challenger rows whose author dependency admitted.
   */
  const dispatchPlans = challengerPlan.nodes
    .filter(function dispatch(node,) {
    return node.state === 'dispatch';
  },);
  /**
   * Challenger rows skipped without provider effect.
   */
  const skippedChallengerNodes = challengerPlan.nodes
    .filter(function skipped(node,) {
    return node.state === 'skipped-author-unusable';
  },);
  /**
   * Complete terminal challenger states after concurrent second wave.
   */
  const challengerStates = await awaitReviewUnitWave({
    nodes: dispatchPlans.map(async function challenger(node,) {
      /**
       * Candidate satisfying current static node dependency.
       */
      const candidate = byOrdinal.get(node.candidateOrdinal,);
      if ((candidate === undefined)
        || (node.sourceReviewPlanDigest === undefined)
        || (node.schemaDigest === undefined))
        throw new Error('Candidate M dispatch plan dependency is absent');
      /**
       * Complete role-specific messages and source-only plan identity.
       */
      const prompt = riskChallengerMessages({
        role: node.role,
        manifest,
        shell,
        reviewPlan,
        candidate,
        authorSettlementDigest: authorSettlement.settlementDigest,
        challengerPlanDigest: challengerPlan.challengerPlanDigest,
        sourceText,
        archiveText,
        media,
      },);
      /**
       * Response schema digest independently rebuilt at dispatch boundary.
       */
      const schemaDigest = hashContent({ content: JSON.stringify(riskChallengeResponseFormat({
        candidate,
        reviewPlan,
        role: node.role,
        sourceReviewPlanDigest: prompt.sourceReviewPlanDigest,
        pictureCount: sourcePictures.length,
      },),), });
      assertCandidateMChallengerBinding({
        node,
        sourceReviewPlanDigest: prompt.sourceReviewPlanDigest,
        schemaDigest,
      },);
      return await runRiskChallengerNode({
        outputDir,
        client: boundClient.client,
        candidate,
        verifierOrdinal: node.verifierOrdinal,
        verifierModelId: node.verifierModelId,
        role: node.role,
        manifest,
        expectedManifestDigest,
        messages: prompt.messages,
        sourceReviewPlanDigest: prompt.sourceReviewPlanDigest,
        shell,
        ledger,
        reviewPlan,
        sourceText,
        archiveText,
        sourcePictures,
        restart,
        signal,
      },);
    },),
    signal,
  },);
  /**
   * Private selection absent only when every author was unusable.
   */
  const selection = candidates.length === 0
    ? undefined
    : selectCandidateM({
      candidates,
      states: challengerStates,
      manifest,
    },);
  /**
   * Every dispatched terminal node state.
   */
  const states = [
    ...authorStates,
    ...challengerStates,
  ];
  /**
   * Persisted result with total graph accounting.
   */
  const result: CandidateMRuntimeResult = {
    manifestDigest: manifest.manifestDigest,
    authorStates,
    authorSettlement,
    challengerPlan,
    challengerStates,
    skippedChallengerNodes,
    completedNodeCount: states.filter(function completed(state,) {
      return state.record
        .state
        === 'completed';
    },)
      .length,
    spentUnusableNodeCount: states.filter(function unusable(state,) {
      return state.record
        .state
        === 'spent-unusable';
    },)
      .length,
    skippedNodeCount: skippedChallengerNodes.length,
    ...(selection === undefined ? {} : { selection, }),
  };
  if ((result.completedNodeCount
    + result.spentUnusableNodeCount
    + result.skippedNodeCount) !== manifest.payloadCountCeiling)
    throw new Error('Candidate M terminal node accounting differs');
  await writePrototypeJson({
    path: join(
      outputDir,
      'result-risk-challenger.json',
    ),
    value: result,
  },);
  return result;
}
