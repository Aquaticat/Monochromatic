// PROTOTYPE ONLY: Candidate H provider binding and finite-wave helpers.

import { join, } from 'node:path';

import type { SyntheticClient, } from './chat-contract.ts';
import type {
  BoundedVerifierBallot,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import type { BoundedVerifierState, } from './prototype-bounded-verdict-verifier-wave.ts';
import { realizationPromptUniqueClient, } from './prototype-realization-prompt-client.ts';

/**
 * Private proof that provider mask selected concrete client.
 */
const BOUNDED_CLIENT: unique symbol = Symbol('provider route was bound to manifest',);

/**
 * Deeply readonly settlement shape consumed by finite-wave callbacks.
 */
type BoundedSettled<ValueT,> =
  | {
    readonly status: 'fulfilled';
    readonly value: ValueT
  }
  | {
    readonly status: 'rejected';
    readonly reason: unknown
  };

/**
 * Clients available before manifest masks excluded routes.
 */
export type BoundedProviderClients = {
  readonly all: SyntheticClient;
  readonly synthetic: SyntheticClient;
  readonly hyper: SyntheticClient;
};

/**
 * Provider and output-root binding fixed by immutable manifest.
 */
export type BoundedClient = {
  readonly providerSelection: BoundedVerdictManifest['providerSelection'];
  readonly manifestDigest: string;
  readonly outputDir: string;
  readonly client: SyntheticClient;
  readonly [BOUNDED_CLIENT]: true;
};

/**
 * Selects only manifest-authorized provider route.
 *
 * @returns Frozen branded client bound to manifest and exact output root
 *
 * @example
 * ```ts
 * const boundClient = bindBoundedClient({ manifest, outputDir, clients, });
 * ```
 */
export function bindBoundedClient({
  manifest,
  outputDir,
  clients,
}: {
  readonly manifest: BoundedVerdictManifest;
  readonly outputDir: string;
  readonly clients: BoundedProviderClients;
}): BoundedClient {
  /**
   * Concrete route selected before excluded clients become unreachable.
   */
  const client = clients.hyper;
  return Object.freeze({
    providerSelection: manifest.providerSelection,
    manifestDigest: manifest.manifestDigest,
    outputDir,
    client: realizationPromptUniqueClient({
      inner: client,
      claimsDir: join(
        outputDir,
        'prompt-claims',
        manifest.manifestDigest,
      ),
    },),
    [BOUNDED_CLIENT]: true as const,
  });
}

/**
 * Refuses forged, stale, or wrong-root provider binding.
 *
 * @example
 * ```ts
 * assertBoundedClient({ boundClient, manifest, outputDir, });
 * ```
 */
export function assertBoundedClient({
  boundClient,
  manifest,
  outputDir,
}: {
  readonly boundClient: BoundedClient;
  readonly manifest: BoundedVerdictManifest;
  readonly outputDir: string;
}): void {
  if ((!boundClient[BOUNDED_CLIENT])
    || (boundClient.providerSelection !== manifest.providerSelection)
    || (boundClient.manifestDigest !== manifest.manifestDigest)
    || (boundClient.outputDir !== outputDir))
    throw new Error('bounded runtime provider or output binding differs');
}

/**
 * Awaits every independent sibling before exact abort propagation.
 *
 * @returns Fulfilled sibling values after complete wave settlement
 *
 * @example
 * ```ts
 * const values = await awaitBoundedWave({ nodes, signal, });
 * ```
 */
export async function awaitBoundedWave<ValueT,>({
  nodes,
  signal,
}: {
  readonly nodes: readonly Promise<ValueT>[];
  readonly signal: AbortSignal;
}): Promise<readonly ValueT[]> {
  /**
   * Complete deeply readonly settlement for every independent node.
   */
  const settled: readonly BoundedSettled<ValueT>[] = await Promise.allSettled(nodes,);
  if (signal.aborted)
    throw signal.reason;
  /**
   * First unexpected rejection after every sibling reached terminal state.
   */
  const rejected = settled.find(function failure(
    result: BoundedSettled<ValueT>,
  ) {
    return result.status === 'rejected';
  },);
  if ((rejected !== undefined) && (rejected.status === 'rejected'))
    throw rejected.reason;
  return settled.flatMap(function fulfilled(
    result: BoundedSettled<ValueT>,
  ): readonly ValueT[] {
    return result.status === 'fulfilled' ? [result.value,] : [];
  },);
}

/**
 * Retains only complete admitted ballots; other verifiers abstain.
 *
 * @returns Admitted ballots in verifier-state order
 *
 * @example
 * ```ts
 * const ballots = boundedBallots({ states, });
 * ```
 */
export function boundedBallots({ states, }: {
  readonly states: readonly BoundedVerifierState[];
}): readonly BoundedVerifierBallot[] {
  return states.flatMap(function admitted(state,) {
    return state.ballot === undefined ? [] : [state.ballot,];
  },);
}
