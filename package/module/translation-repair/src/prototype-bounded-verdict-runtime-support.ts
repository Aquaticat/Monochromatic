// PROTOTYPE ONLY: Candidate H provider binding and finite-wave helpers.

import { join, } from 'node:path';

import type { SyntheticClient, } from './chat-contract.ts';
import type {
  BoundedVerifierBallot,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import type { BoundedVerifierState, } from './prototype-bounded-verdict-verifier-wave.ts';
import { realizationPromptUniqueClient, } from './prototype-realization-prompt-client.ts';

/** Private proof that provider mask selected concrete client. */
const BOUNDED_CLIENT: unique symbol = Symbol('bounded verdict client',);

/** Clients available before manifest masks excluded routes. */
export type BoundedProviderClients = {
  readonly all: SyntheticClient;
  readonly synthetic: SyntheticClient;
  readonly hyper: SyntheticClient;
};

/** Provider and output-root binding fixed by immutable manifest. */
export type BoundedClient = {
  readonly providerSelection: BoundedVerdictManifest['providerSelection'];
  readonly manifestDigest: string;
  readonly outputDir: string;
  readonly client: SyntheticClient;
  readonly [BOUNDED_CLIENT]: true;
};

/** Selects only manifest-authorized provider route. */
export function bindBoundedClient({
  manifest,
  outputDir,
  clients,
}: {
  readonly manifest: BoundedVerdictManifest;
  readonly outputDir: string;
  readonly clients: BoundedProviderClients;
}): BoundedClient {
  const client = manifest.providerSelection === 'synthetic-only'
    ? clients.synthetic
    : manifest.providerSelection === 'hyper-only'
      ? clients.hyper
      : clients.all;
  return Object.freeze({
    providerSelection: manifest.providerSelection,
    manifestDigest: manifest.manifestDigest,
    outputDir,
    client: realizationPromptUniqueClient({
      inner: client,
      claimsDir: join(outputDir, 'prompt-claims', manifest.manifestDigest,),
    },),
    [BOUNDED_CLIENT]: true as const,
  });
}

/** Refuses forged, stale, or wrong-root provider binding. */
export function assertBoundedClient({
  boundClient,
  manifest,
  outputDir,
}: {
  readonly boundClient: BoundedClient;
  readonly manifest: BoundedVerdictManifest;
  readonly outputDir: string;
}): void {
  if ((boundClient[BOUNDED_CLIENT] !== true)
    || (boundClient.providerSelection !== manifest.providerSelection)
    || (boundClient.manifestDigest !== manifest.manifestDigest)
    || (boundClient.outputDir !== outputDir))
    throw new Error('bounded runtime provider or output binding differs');
}

/** Awaits every independent sibling before exact abort propagation. */
export async function awaitBoundedWave<ValueT,>({
  nodes,
  signal,
}: {
  readonly nodes: readonly Promise<ValueT>[];
  readonly signal: AbortSignal;
}): Promise<readonly ValueT[]> {
  const settled = await Promise.allSettled(nodes,);
  if (signal.aborted)
    throw signal.reason;
  const rejected = settled.find(function failure(result,) {
    return result.status === 'rejected';
  },);
  if ((rejected !== undefined) && (rejected.status === 'rejected'))
    throw rejected.reason;
  return settled.flatMap(function fulfilled(result,): readonly ValueT[] {
    return result.status === 'fulfilled' ? [result.value,] : [];
  },);
}

/** Retains only complete admitted ballots; other verifiers abstain. */
export function boundedBallots({ states, }: {
  readonly states: readonly BoundedVerifierState[];
}): readonly BoundedVerifierBallot[] {
  return states.flatMap(function admitted(state,) {
    return state.ballot === undefined ? [] : [state.ballot,];
  },);
}
