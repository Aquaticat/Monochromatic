// PROTOTYPE ONLY: Candidate K finite two-wave candidate-scoped runtime.

import { join, } from 'node:path';

import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import { runReviewUnitAuthorNode, } from './prototype-review-unit-author-node.ts';
import { assertReviewUnitManifest, } from './prototype-review-unit-manifest.ts';
import {
  MAX_REVIEW_UNIT_PAYLOAD_COUNT,
  type ReviewUnitAuthorSettlement,
  type ReviewUnitSelection,
  type ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import {
  reviewUnitAuthorMessages,
  reviewUnitVerifierMessages,
} from './prototype-review-unit-prompt.ts';
import {
  assertReviewUnitClient,
  awaitReviewUnitWave,
  candidateScopedBallots,
  type ReviewUnitClient,
} from './prototype-review-unit-runtime-support.ts';
import {
  createReviewUnitVerifierWavePlan,
  type ReviewUnitVerifierNodePlan,
  type ReviewUnitVerifierWavePlan,
} from './prototype-review-unit-runtime-plan.ts';
import { selectReviewUnit, } from './prototype-review-unit-selection.ts';
import {
  candidatesFromReviewUnitSettlement,
  createReviewUnitAuthorSettlement,
  type ReviewUnitAuthorState,
} from './prototype-review-unit-settlement.ts';
import { runReviewUnitVerifierNode, } from './prototype-review-unit-verifier-node.ts';
import type { ReviewUnitVerifierState, } from './prototype-review-unit-verifier-state.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import {
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationObligationLedger,
} from './prototype-realization-model.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { acquireRealizationRuntimeLease, } from './prototype-realization-runtime-lease.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';

/**
 * Persisted Candidate K result before production boundary.
 */
export type ReviewUnitRuntimeResult = {
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * Concrete provider selection.
   */
  readonly providerSelection: ReviewUnitManifest['providerSelection'];
  /**
   * Complete first-wave terminal states.
   */
  readonly authorStates: readonly ReviewUnitAuthorState[];
  /**
   * Runtime-owned total author settlement.
   */
  readonly authorSettlement: ReviewUnitAuthorSettlement;
  /**
   * Six-row static second-wave plan.
   */
  readonly verifierPlan: ReviewUnitVerifierWavePlan;
  /**
   * Terminal states for dispatched verifier nodes only.
   */
  readonly verifierStates: readonly ReviewUnitVerifierState[];
  /**
   * Deterministic no-dispatch verifier rows for unusable author dependencies.
   */
  readonly skippedVerifierNodes: readonly ReviewUnitVerifierNodePlan[];
  /**
   * Completed dispatched nodes.
   */
  readonly completedNodeCount: number;
  /**
   * Spent unusable dispatched nodes.
   */
  readonly spentUnusableNodeCount: number;
  /**
   * Deterministically skipped nodes.
   */
  readonly skippedNodeCount: number;
  /**
   * Private candidate selection when at least one author succeeds.
   */
  readonly selection?: ReviewUnitSelection;
};

/**
 * Executes fixed Candidate K graph in exactly two dependency waves.
 *
 * @returns Persisted private result after every authorized node settles
 *
 * @example
 * ```ts
 * const result = await runReviewUnitRuntime({
 *   outputDir,
 *   boundClient,
 *   manifest,
 *   expectedManifestDigest,
 *   shell,
 *   ledger,
 *   sourceText,
 *   archiveText,
 *   media,
 *   restart,
 *   signal,
 * });
 * ```
 */
export async function runReviewUnitRuntime({
  outputDir,
  boundClient,
  manifest,
  expectedManifestDigest,
  shell,
  ledger,
  sourceText,
  archiveText,
  media,
  restart,
  signal,
}: {
  readonly outputDir: string;
  readonly boundClient: ReviewUnitClient;
  readonly manifest: ReviewUnitManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<ReviewUnitRuntimeResult> {
  assertReviewUnitManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  assertReviewUnitClient({
    boundClient,
    manifest,
    outputDir,
  });
  if (signal.aborted)
    throw signal.reason;
  /**
   * Exclusive process-incarnation lease for exact output root.
   */
  await using runtimeLease = await acquireRealizationRuntimeLease({ outputDir, });
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'manifest-review-unit.json',
    ),
    value: manifest,
    label: 'review unit manifest',
  },);
  /**
   * Page-reference names consumed by deterministic checks.
   */
  const sourcePictures = media.map(function picture(item,) {
    return { assetName: item.assetName, };
  },);
  /**
   * Complete terminal author states after concurrent first wave.
   */
  const authorStates = await awaitReviewUnitWave({
    nodes: manifest.candidatePlan
      .map(async function author(plan,) {
      return await runReviewUnitAuthorNode({
        outputDir,
        client: boundClient.client,
        plan,
        manifest,
        expectedManifestDigest,
        messages: reviewUnitAuthorMessages({
          plan,
          manifest,
          shell,
          ledger,
          sourceText,
          archiveText,
          media,
        },),
        shell,
        ledger,
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
   * Runtime-owned total author settlement.
   */
  const authorSettlement = createReviewUnitAuthorSettlement({
    states: authorStates,
    manifest,
  },);
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'review-unit-author-settlement.json',
    ),
    value: authorSettlement,
    label: 'review unit author settlement',
  },);
  if (signal.aborted)
    throw signal.reason;
  /**
   * Complete admitted candidate subset.
   */
  const candidates = candidatesFromReviewUnitSettlement({
    settlement: authorSettlement,
    manifest,
  },);
  /**
   * Six-row static second-wave plan including deterministic skips.
   */
  const verifierPlan = createReviewUnitVerifierWavePlan({
    manifest,
    authorSettlement,
    candidates,
    ledger,
  },);
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'review-unit-verifier-plan.json',
    ),
    value: verifierPlan,
    label: 'review unit verifier plan',
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
   * Verifier rows whose author dependency admitted a candidate.
   */
  const dispatchPlans = verifierPlan.nodes
    .filter(function dispatch(node,) {
    return node.state === 'dispatch';
  },);
  /**
   * Verifier rows skipped without provider effect.
   */
  const skippedVerifierNodes = verifierPlan.nodes
    .filter(function skipped(node,) {
    return node.state === 'skipped-author-unusable';
  },);
  /**
   * Complete terminal verifier states after concurrent second wave.
   */
  const verifierStates = await awaitReviewUnitWave({
    nodes: dispatchPlans.map(async function verifier(node,) {
      /**
       * Candidate satisfying current static node dependency.
       */
      const candidate = byOrdinal.get(node.candidateOrdinal,);
      if (candidate === undefined)
        throw new Error('review unit verifier plan candidate is absent');
      return await runReviewUnitVerifierNode({
        outputDir,
        client: boundClient.client,
        candidate,
        verifierOrdinal: node.verifierOrdinal,
        verifierModelId: node.verifierModelId,
        manifest,
        expectedManifestDigest,
        messages: reviewUnitVerifierMessages({
          manifest,
          shell,
          ledger,
          candidate,
          authorSettlementDigest: authorSettlement.settlementDigest,
          verifierPlanDigest: verifierPlan.verifierPlanDigest,
          globalCriteria: REALIZATION_GLOBAL_CRITERIA,
          defectClasses: CONDITIONAL_DEFECT_CLASSES,
          sourceText,
          archiveText,
          media,
        },),
        authorSettlement,
        shell,
        ledger,
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
    : selectReviewUnit({
      authorSettlement,
      ballots: candidateScopedBallots({ states: verifierStates, }),
      manifest,
      expectedManifestDigest,
      ledger,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  /**
   * Every dispatched terminal node state.
   */
  const states = [
    ...authorStates,
    ...verifierStates,
  ];
  /**
   * Persisted result with total graph accounting.
   */
  const result: ReviewUnitRuntimeResult = {
    manifestDigest: manifest.manifestDigest,
    providerSelection: manifest.providerSelection,
    authorStates,
    authorSettlement,
    verifierPlan,
    verifierStates,
    skippedVerifierNodes,
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
    skippedNodeCount: skippedVerifierNodes.length,
    ...(selection === undefined ? {} : { selection, }),
  };
  if ((result.completedNodeCount + result.spentUnusableNodeCount
    + result.skippedNodeCount)
    !== MAX_REVIEW_UNIT_PAYLOAD_COUNT)
    throw new Error('review unit runtime node accounting differs');
  await writePrototypeJson({
    path: join(
      outputDir,
      'result-review-unit.json',
    ),
    value: result,
  },);
  return result;
}
