// PROTOTYPE ONLY: Candidate I finite two-wave candidate-scoped runtime.

import { join, } from 'node:path';

import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import { runCandidateBallotAuthorNode, } from './prototype-candidate-ballot-author-node.ts';
import { assertCandidateBallotManifest, } from './prototype-candidate-ballot-manifest.ts';
import {
  MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT,
  type CandidateBallotAuthorSettlement,
  type CandidateBallotSelection,
  type CandidateBallotManifest,
} from './prototype-candidate-ballot-model.ts';
import {
  candidateBallotAuthorMessages,
  candidateBallotVerifierMessages,
} from './prototype-candidate-ballot-prompt.ts';
import {
  assertCandidateBallotClient,
  awaitCandidateBallotWave,
  candidateScopedBallots,
  type CandidateBallotClient,
} from './prototype-candidate-ballot-runtime-support.ts';
import {
  createCandidateBallotVerifierWavePlan,
  type CandidateBallotVerifierNodePlan,
  type CandidateBallotVerifierWavePlan,
} from './prototype-candidate-ballot-runtime-plan.ts';
import { selectCandidateBallot, } from './prototype-candidate-ballot-selection.ts';
import {
  candidatesFromCandidateBallotSettlement,
  createCandidateBallotAuthorSettlement,
  type CandidateBallotAuthorState,
} from './prototype-candidate-ballot-settlement.ts';
import { runCandidateBallotVerifierNode, } from './prototype-candidate-ballot-verifier-node.ts';
import type { CandidateBallotVerifierState, } from './prototype-candidate-ballot-verifier-state.ts';
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
 * Persisted Candidate I result before production boundary.
 */
export type CandidateBallotRuntimeResult = {
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * Concrete provider selection.
   */
  readonly providerSelection: CandidateBallotManifest['providerSelection'];
  /**
   * Complete first-wave terminal states.
   */
  readonly authorStates: readonly CandidateBallotAuthorState[];
  /**
   * Runtime-owned total author settlement.
   */
  readonly authorSettlement: CandidateBallotAuthorSettlement;
  /**
   * Six-row static second-wave plan.
   */
  readonly verifierPlan: CandidateBallotVerifierWavePlan;
  /**
   * Terminal states for dispatched verifier nodes only.
   */
  readonly verifierStates: readonly CandidateBallotVerifierState[];
  /**
   * Deterministic no-dispatch verifier rows for unusable author dependencies.
   */
  readonly skippedVerifierNodes: readonly CandidateBallotVerifierNodePlan[];
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
  readonly selection?: CandidateBallotSelection;
};

/**
 * Executes fixed Candidate I graph in exactly two dependency waves.
 *
 * @returns Persisted private result after every authorized node settles
 *
 * @example
 * ```ts
 * const result = await runCandidateBallotRuntime({
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
export async function runCandidateBallotRuntime({
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
  readonly boundClient: CandidateBallotClient;
  readonly manifest: CandidateBallotManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<CandidateBallotRuntimeResult> {
  assertCandidateBallotManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  assertCandidateBallotClient({
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
      'manifest-candidate-ballot.json',
    ),
    value: manifest,
    label: 'candidate ballot manifest',
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
  const authorStates = await awaitCandidateBallotWave({
    nodes: manifest.candidatePlan
      .map(async function author(plan,) {
      return await runCandidateBallotAuthorNode({
        outputDir,
        client: boundClient.client,
        plan,
        manifest,
        expectedManifestDigest,
        messages: candidateBallotAuthorMessages({
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
  const authorSettlement = createCandidateBallotAuthorSettlement({
    states: authorStates,
    manifest,
  },);
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'candidate-ballot-author-settlement.json',
    ),
    value: authorSettlement,
    label: 'candidate ballot author settlement',
  },);
  if (signal.aborted)
    throw signal.reason;
  /**
   * Complete admitted candidate subset.
   */
  const candidates = candidatesFromCandidateBallotSettlement({
    settlement: authorSettlement,
    manifest,
  },);
  /**
   * Six-row static second-wave plan including deterministic skips.
   */
  const verifierPlan = createCandidateBallotVerifierWavePlan({
    manifest,
    authorSettlement,
    candidates,
    ledger,
  },);
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'candidate-ballot-verifier-plan.json',
    ),
    value: verifierPlan,
    label: 'candidate ballot verifier plan',
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
  const verifierStates = await awaitCandidateBallotWave({
    nodes: dispatchPlans.map(async function verifier(node,) {
      /**
       * Candidate satisfying current static node dependency.
       */
      const candidate = byOrdinal.get(node.candidateOrdinal,);
      if (candidate === undefined)
        throw new Error('candidate ballot verifier plan candidate is absent');
      return await runCandidateBallotVerifierNode({
        outputDir,
        client: boundClient.client,
        candidate,
        verifierOrdinal: node.verifierOrdinal,
        verifierModelId: node.verifierModelId,
        manifest,
        expectedManifestDigest,
        messages: candidateBallotVerifierMessages({
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
    : selectCandidateBallot({
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
  const result: CandidateBallotRuntimeResult = {
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
    !== MAX_CANDIDATE_BALLOT_PAYLOAD_COUNT)
    throw new Error('candidate ballot runtime node accounting differs');
  await writePrototypeJson({
    path: join(
      outputDir,
      'result-candidate-ballot.json',
    ),
    value: result,
  },);
  return result;
}
