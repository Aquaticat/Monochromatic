// PROTOTYPE ONLY: Candidate G finite two-wave calibration runtime.

import { join, } from 'node:path';

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import {
  candidatesFromRealizationAuthorSettlement,
  createRealizationAuthorSettlement,
  type RealizationAuthorSettlement,
} from './prototype-realization-author-settlement.ts';
import {
  runRealizationAuthorNode,
  type RealizationAuthorState,
} from './prototype-realization-author-wave.ts';
import { assertRealizationManifest, } from './prototype-realization-manifest.ts';
import type {
  RealizationManifest,
  RealizationObligationLedger,
  RealizationSelection,
  RealizationVerifierBallot,
} from './prototype-realization-model.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import { persistRealizationImmutableJson, } from './prototype-realization-persistence.ts';
import { realizationPromptUniqueClient, } from './prototype-realization-prompt-client.ts';
import { acquireRealizationRuntimeLease, } from './prototype-realization-runtime-lease.ts';
import {
  realizationAuthorMessages,
  realizationVerifierMessages,
} from './prototype-realization-prompt.ts';
import { selectRealizationCandidate, } from './prototype-realization-selection.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import {
  runRealizationVerifierNode,
  type RealizationVerifierState,
} from './prototype-realization-verifier-wave.ts';
import { realizationVerifierResponseFormat, } from './prototype-realization-verifier-schema.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';

/** Private runtime proof that provider mask chose one concrete client. */
const REALIZATION_BOUND_CLIENT: unique symbol = Symbol('realization bound client',);

/** Provider clients available before manifest selection masks excluded routes. */
export type RealizationProviderClients = {
  readonly all: SyntheticClient;
  readonly synthetic: SyntheticClient;
  readonly hyper: SyntheticClient;
};

/** One provider-routing boundary fixed by immutable manifest. */
export type RealizationBoundClient = {
  readonly providerSelection: RealizationManifest['providerSelection'];
  readonly manifestDigest: string;
  readonly outputDir: string;
  readonly client: SyntheticClient;
  readonly [REALIZATION_BOUND_CLIENT]: true;
};

/** Masks excluded provider clients and derives claim namespace from immutable run. */
export function bindRealizationClient({ manifest, outputDir, clients, }: {
  readonly manifest: RealizationManifest;
  readonly outputDir: string;
  readonly clients: RealizationProviderClients;
}): RealizationBoundClient {
  const { providerSelection, } = manifest;
  const client = providerSelection === 'synthetic-only'
    ? clients.synthetic
    : providerSelection === 'hyper-only'
      ? clients.hyper
      : clients.all;
  return {
    providerSelection,
    manifestDigest: manifest.manifestDigest,
    outputDir,
    client: realizationPromptUniqueClient({
      inner: client,
      claimsDir: join(outputDir, 'prompt-claims', manifest.manifestDigest,),
    },),
    [REALIZATION_BOUND_CLIENT]: true,
  };
}

/** Persisted finite graph result before any public publication boundary. */
export type RealizationRuntimeResult = {
  readonly manifestDigest: string;
  readonly providerSelection: RealizationManifest['providerSelection'];
  readonly authorStates: readonly RealizationAuthorState[];
  readonly authorSettlement: RealizationAuthorSettlement;
  readonly verifierStates: readonly RealizationVerifierState[];
  readonly skippedVerifierModelIds: RealizationManifest['verifierModelIds'];
  readonly completedNodeCount: number;
  readonly spentUnusableNodeCount: number;
  readonly selection?: RealizationSelection;
};

/** Retains only complete admitted ballots; every other verifier abstains. */
function admittedBallots({ states, }: {
  readonly states: readonly RealizationVerifierState[];
}): readonly RealizationVerifierBallot[] {
  return states.flatMap(function admitted(state,): readonly RealizationVerifierBallot[] {
    return state.ballot === undefined ? [] : [state.ballot,];
  },);
}

/** Awaits every sibling before forwarding exact caller abort or unexpected rejection. */
async function awaitRealizationWave<ValueT,>({ nodes, signal, }: {
  readonly nodes: readonly Promise<ValueT>[];
  readonly signal: AbortSignal;
}): Promise<readonly ValueT[]> {
  const settled = await Promise.allSettled(nodes,);
  if (signal.aborted)
    throw signal.reason;
  const rejected = settled.find(function failure(result,) { return result.status === 'rejected'; });
  if ((rejected !== undefined) && (rejected.status === 'rejected'))
    throw rejected.reason;
  return settled.flatMap(function fulfilled(result,): readonly ValueT[] {
    return result.status === 'fulfilled' ? [result.value,] : [];
  },);
}

/** Executes immutable Candidate G graph in exactly two dependency waves. */
export async function runRealizationRuntime({
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
  readonly boundClient: RealizationBoundClient;
  readonly manifest: RealizationManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<RealizationRuntimeResult> {
  assertRealizationManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  if ((boundClient.providerSelection !== manifest.providerSelection)
    || (boundClient.manifestDigest !== manifest.manifestDigest)
    || (boundClient.outputDir !== outputDir))
    throw new Error('realization runtime provider or output binding differs from manifest');
  if (signal.aborted)
    throw signal.reason;
  await using runtimeLease = await acquireRealizationRuntimeLease({ outputDir, });
  await persistRealizationImmutableJson({
    path: join(outputDir, 'manifest-realization.json',),
    value: manifest,
    label: 'manifest',
  },);
  const sourcePictures = media.map(function picture(item,) { return { assetName: item.assetName, }; });
  const authorStates = await awaitRealizationWave({
    nodes: manifest.candidatePlan.map(async function author(plan,) {
    return await runRealizationAuthorNode({
      outputDir,
      client: boundClient.client,
      plan,
      manifest,
      expectedManifestDigest,
      messages: realizationAuthorMessages({
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
  const authorSettlement = createRealizationAuthorSettlement({ states: authorStates, manifest, });
  await persistRealizationImmutableJson({
    path: join(outputDir, 'author-wave-settlement.json',),
    value: authorSettlement,
    label: 'author wave settlement',
  },);
  const candidates = candidatesFromRealizationAuthorSettlement({ settlement: authorSettlement, manifest, });
  const verifierSchemaDigest = candidates.length === 0
    ? 'skipped-no-candidate'
    : hashContent({
      content: JSON.stringify(realizationVerifierResponseFormat({ ledger, candidates, }),),
    },);
  const verifierPlanIdentity = {
    manifestDigest: manifest.manifestDigest,
    authorSettlementDigest: authorSettlement.settlementDigest,
    candidateBindings: candidates.map(function binding(candidate,) {
      return { candidateId: candidate.candidateId, candidateDigest: candidate.candidateDigest, };
    },),
    verifierModelIds: manifest.verifierModelIds,
    verifierProtocolDigest: manifest.verifierProtocolDigest,
    verifierSchemaDigest,
  };
  const verifierPlan = {
    ...verifierPlanIdentity,
    verifierPlanDigest: hashContent({ content: JSON.stringify(verifierPlanIdentity,), }),
  };
  await persistRealizationImmutableJson({
    path: join(outputDir, 'verifier-wave-plan.json',),
    value: verifierPlan,
    label: 'verifier wave plan',
  },);
  const verifierStates = candidates.length === 0
    ? []
    : await awaitRealizationWave({
      nodes: manifest.verifierModelIds.map(async function verifier(verifierModelId, verifierOrdinal,) {
      return await runRealizationVerifierNode({
        outputDir,
        client: boundClient.client,
        verifierOrdinal,
        verifierModelId,
        manifest,
        expectedManifestDigest,
        authorSettlement,
        messages: realizationVerifierMessages({
          manifest,
          shell,
          ledger,
          candidates,
          authorSettlementDigest: authorSettlement.settlementDigest,
          verifierPlanDigest: verifierPlan.verifierPlanDigest,
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
  const ballots = admittedBallots({ states: verifierStates, });
  const selection = candidates.length === 0
    ? undefined
    : selectRealizationCandidate({
      authorSettlement,
      ballots,
      manifest,
      expectedManifestDigest,
      ledger,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  const states = [...authorStates, ...verifierStates,];
  const skippedVerifierModelIds = candidates.length === 0 ? manifest.verifierModelIds : [];
  const result: RealizationRuntimeResult = {
    manifestDigest: manifest.manifestDigest,
    providerSelection: manifest.providerSelection,
    authorStates,
    authorSettlement,
    verifierStates,
    skippedVerifierModelIds,
    completedNodeCount: states.filter(function completed(state,) { return state.record.state === 'completed'; }).length,
    spentUnusableNodeCount: states.filter(function unusable(state,) { return state.record.state === 'spent-unusable'; }).length,
    ...(selection === undefined ? {} : { selection, }),
  };
  await writePrototypeJson({ path: join(outputDir, 'result-realization.json',), value: result, });
  return result;
}
