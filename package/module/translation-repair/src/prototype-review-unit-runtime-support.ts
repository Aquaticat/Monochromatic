// PROTOTYPE ONLY: Candidate K provider binding and finite-wave helpers.

import { join, } from 'node:path';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  assertReviewUnitRouteClient,
  type ReviewUnitRouteClient,
} from './prototype-review-unit-hyper.ts';
import type {
  ReviewUnitManifest,
  ReviewUnitBallot,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitVerifierState, } from './prototype-review-unit-verifier-state.ts';
import { realizationPromptUniqueClient, } from './prototype-realization-prompt-client.ts';

/**
 * Private proof that provider mask selected concrete client.
 */
const REVIEW_UNIT_CLIENT: unique symbol = Symbol('review unit provider bound',);

/**
 * Deeply readonly finite settlement shape.
 */
type ReviewUnitSettled<ValueT,> =
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
export type ReviewUnitProviderClients = {
  /**
   * Unrestricted aggregate route, intentionally excluded.
   */
  readonly all: SyntheticClient;
  /**
   * Synthetic route, intentionally excluded.
   */
  readonly synthetic: SyntheticClient;
  /**
   * Manifest-selected Hyper route.
   */
  readonly hyper: ReviewUnitRouteClient;
};

/**
 * Provider and output-root binding fixed by manifest.
 */
export type ReviewUnitClient = {
  /**
   * Selected provider mask.
   */
  readonly providerSelection: ReviewUnitManifest['providerSelection'];
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * Exact output root binding.
   */
  readonly outputDir: string;
  /**
   * Concrete route-table binding.
   */
  readonly providerRouteDigest: string;
  /**
   * Prompt-unique concrete client.
   */
  readonly client: SyntheticClient;
  /**
   * Unforgeable module-local brand.
   */
  readonly [REVIEW_UNIT_CLIENT]: true;
};

/**
 * Selects only manifest-authorized provider route.
 *
 * @returns Frozen branded client bound to manifest and output root
 *
 * @example
 * ```ts
 * const bound = bindReviewUnitClient({ manifest, outputDir, clients, });
 * ```
 */
export function bindReviewUnitClient({
  manifest,
  outputDir,
  clients,
}: {
  readonly manifest: ReviewUnitManifest;
  readonly outputDir: string;
  readonly clients: ReviewUnitProviderClients;
}): ReviewUnitClient {
  assertReviewUnitRouteClient({
    routeClient: clients.hyper,
    manifest,
  });
  return Object.freeze({
    providerSelection: manifest.providerSelection,
    manifestDigest: manifest.manifestDigest,
    outputDir,
    providerRouteDigest: clients.hyper
      .providerRouteDigest,
    client: realizationPromptUniqueClient({
      inner: clients.hyper
        .client,
      claimsDir: join(
        outputDir,
        'prompt-claims',
        manifest.manifestDigest,
      ),
    },),
    [REVIEW_UNIT_CLIENT]: true as const,
  });
}

/**
 * Refuses forged, stale, or wrong-root provider binding.
 *
 * @example
 * ```ts
 * assertReviewUnitClient({ boundClient, manifest, outputDir, });
 * ```
 */
export function assertReviewUnitClient({
  boundClient,
  manifest,
  outputDir,
}: {
  readonly boundClient: ReviewUnitClient;
  readonly manifest: ReviewUnitManifest;
  readonly outputDir: string;
}): void {
  if ((!boundClient[REVIEW_UNIT_CLIENT])
    || (boundClient.providerSelection !== manifest.providerSelection)
    || (boundClient.manifestDigest !== manifest.manifestDigest)
    || (boundClient.outputDir !== outputDir)
    || (boundClient.providerRouteDigest !== manifest.providerRouteDigest))
    throw new Error('review unit provider or output binding differs');
}

/**
 * Awaits every independent sibling before exact abort propagation.
 *
 * @returns Fulfilled sibling values after complete settlement
 *
 * @example
 * ```ts
 * const values = await awaitReviewUnitWave({ nodes, signal, });
 * ```
 */
export async function awaitReviewUnitWave<ValueT,>({
  nodes,
  signal,
}: {
  readonly nodes: readonly Promise<ValueT>[];
  readonly signal: AbortSignal;
}): Promise<readonly ValueT[]> {
  /**
   * Complete settlement for every independent node.
   */
  const settled: readonly ReviewUnitSettled<ValueT>[] = await Promise.allSettled(nodes,);
  if (signal.aborted)
    throw signal.reason;
  /**
   * First unexpected rejection after all siblings settle.
   */
  const rejected = settled.find(function failure(result,) {
    return result.status === 'rejected';
  },);
  if ((rejected !== undefined) && (rejected.status === 'rejected'))
    throw rejected.reason;
  return settled.flatMap(function fulfilled(result,): readonly ValueT[] {
    return result.status === 'fulfilled' ? [result.value,] : [];
  },);
}

/**
 * Retains only admitted candidate-scoped ballots.
 *
 * @returns Admitted ballots in verifier-state order
 *
 * @example
 * ```ts
 * const ballots = candidateScopedBallots({ states, });
 * ```
 */
export function candidateScopedBallots({
  states,
}: {
  readonly states: readonly ReviewUnitVerifierState[];
}): readonly ReviewUnitBallot[] {
  return states.flatMap(function admitted(state,) {
    return state.ballot === undefined ? [] : [state.ballot,];
  },);
}
