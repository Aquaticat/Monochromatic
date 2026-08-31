// PROTOTYPE ONLY: Candidate H finite two-wave private calibration runtime.

import { join, } from 'node:path';

import { hashContent, } from './document-node.ts';
import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import { runBoundedAuthorNode, } from './prototype-bounded-verdict-author-wave.ts';
import { assertBoundedVerdictManifest, } from './prototype-bounded-verdict-manifest.ts';
import type {
  BoundedAuthorSettlement,
  BoundedSelection,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import {
  boundedAuthorMessages,
  boundedVerifierMessages,
} from './prototype-bounded-verdict-prompt.ts';
import {
  assertBoundedClient,
  awaitBoundedWave,
  boundedBallots,
  type BoundedClient,
} from './prototype-bounded-verdict-runtime-support.ts';
import { selectBoundedCandidate, } from './prototype-bounded-verdict-selection.ts';
import {
  candidatesFromBoundedSettlement,
  createBoundedAuthorSettlement,
  type BoundedAuthorState,
} from './prototype-bounded-verdict-settlement.ts';
import {
  runBoundedVerifierNode,
  type BoundedVerifierState,
} from './prototype-bounded-verdict-verifier-wave.ts';
import { boundedVerifierResponseFormat, } from './prototype-bounded-verdict-verifier-schema.ts';
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
 * Persisted Candidate H result before any production boundary.
 */
export type BoundedRuntimeResult = {
  readonly manifestDigest: string;
  readonly providerSelection: BoundedVerdictManifest['providerSelection'];
  readonly authorStates: readonly BoundedAuthorState[];
  readonly authorSettlement: BoundedAuthorSettlement;
  readonly verifierStates: readonly BoundedVerifierState[];
  readonly skippedVerifierModelIds: BoundedVerdictManifest['verifierModelIds'];
  readonly completedNodeCount: number;
  readonly spentUnusableNodeCount: number;
  readonly selection?: BoundedSelection;
};

/**
 * Executes fixed Candidate H graph in exactly two dependency waves.
 *
 * @returns Persisted private result after every authorized node settles
 *
 * @example
 * ```ts
 * const result = await runBoundedRuntime({
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
export async function runBoundedRuntime({
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
  readonly boundClient: BoundedClient;
  readonly manifest: BoundedVerdictManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<BoundedRuntimeResult> {
  assertBoundedVerdictManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  assertBoundedClient({
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
      'manifest-bounded-verdict.json',
    ),
    value: manifest,
    label: 'bounded manifest',
  },);
  /**
   * Page-reference names consumed by deterministic candidate checks.
   */
  const sourcePictures = media.map(function picture(item,) {
    return { assetName: item.assetName, };
  },);
  /**
   * Complete terminal author states after concurrent first wave.
   */
  const authorStates = await awaitBoundedWave({
    nodes: manifest.candidatePlan
      .map(async function author(plan,) {
      return await runBoundedAuthorNode({
        outputDir,
        client: boundClient.client,
        plan,
        manifest,
        expectedManifestDigest,
        messages: boundedAuthorMessages({
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
   * Runtime-owned total settlement deriving downstream candidate set.
   */
  const authorSettlement = createBoundedAuthorSettlement({
    states: authorStates,
    manifest,
  },);
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'bounded-author-settlement.json',
    ),
    value: authorSettlement,
    label: 'bounded author settlement',
  },);
  /**
   * Complete admitted candidate subset from immutable settlement.
   */
  const candidates = candidatesFromBoundedSettlement({
    settlement: authorSettlement,
    manifest,
  },);
  /**
   * Dynamic verifier schema digest or explicit no-candidate sentinel.
   */
  const verifierSchemaDigest = candidates.length === 0
    ? 'skipped-no-candidate'
    : hashContent({
      content: JSON.stringify(boundedVerifierResponseFormat({
        ledger,
        candidates,
      },),),
    },);
  /**
   * Verifier-wave dependencies participating in plan digest.
   */
  const verifierPlanIdentity = {
    manifestDigest: manifest.manifestDigest,
    authorSettlementDigest: authorSettlement.settlementDigest,
    candidateBindings: candidates.map(function binding(candidate,) {
      return {
        candidateId: candidate.candidateId,
        candidateDigest: candidate.candidateDigest,
      };
    },),
    verifierModelIds: manifest.verifierModelIds,
    verifierProtocolDigest: manifest.verifierProtocolDigest,
    verifierSchemaDigest,
    findingCap: manifest.findingCap,
  };
  /**
   * Immutable verifier-wave plan with self digest attached.
   */
  const verifierPlan = {
    ...verifierPlanIdentity,
    verifierPlanDigest: hashContent({
      content: JSON.stringify(verifierPlanIdentity,),
    },),
  };
  await persistRealizationImmutableJson({
    path: join(
      outputDir,
      'bounded-verifier-plan.json',
    ),
    value: verifierPlan,
    label: 'bounded verifier plan',
  },);
  /**
   * Complete terminal verifier states after concurrent second wave.
   */
  const verifierStates = candidates.length === 0
    ? []
    : await awaitBoundedWave({
      nodes: manifest.verifierModelIds
        .map(async function verifier(
        verifierModelId,
        verifierOrdinal,
      ) {
        return await runBoundedVerifierNode({
          outputDir,
          client: boundClient.client,
          verifierOrdinal,
          verifierModelId,
          manifest,
          expectedManifestDigest,
          messages: boundedVerifierMessages({
            manifest,
            shell,
            ledger,
            candidates,
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
   * Private selected candidate or absence when no author was usable.
   */
  const selection = candidates.length === 0
    ? undefined
    : selectBoundedCandidate({
      authorSettlement,
      ballots: boundedBallots({ states: verifierStates, }),
      manifest,
      expectedManifestDigest,
      ledger,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  /**
   * Every terminal node state across fixed dependency graph.
   */
  const states = [
    ...authorStates,
    ...verifierStates,
  ];
  /**
   * Private persisted runtime result and node-state counts.
   */
  const result: BoundedRuntimeResult = {
    manifestDigest: manifest.manifestDigest,
    providerSelection: manifest.providerSelection,
    authorStates,
    authorSettlement,
    verifierStates,
    skippedVerifierModelIds: candidates.length === 0
      ? manifest.verifierModelIds
      : [],
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
    ...(selection === undefined ? {} : { selection, }),
  };
  await writePrototypeJson({
    path: join(
      outputDir,
      'result-bounded-verdict.json',
    ),
    value: result,
  },);
  return result;
}
