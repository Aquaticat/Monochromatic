// PROTOTYPE ONLY: Candidate I local Hyper model mapping before product adoption.

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { CandidateBallotManifest, } from './prototype-candidate-ballot-model.ts';
import {
  createHyperExpansionClient,
  type HyperExpansionModel,
} from './prototype-hyper-expansion-client.ts';
import type { RosterModelId, } from './roster-id.ts';
import {
  fetchTransport,
  type ModelTransport,
} from './synthetic-transport.ts';

/**
 * Private proof that concrete client was bound to one route table.
 */
const CANDIDATE_BALLOT_ROUTE_CLIENT: unique symbol = Symbol('candidate ballot route client',);

/**
 * Candidate-local model route proven without product allowlist mutation.
 */
export type CandidateBallotHyperModel = HyperExpansionModel & {
  /**
   * Canonical identity used for model-family independence.
   */
  readonly requestId: RosterModelId;
  /**
   * Whether current Hyper row accepts page image.
   */
  readonly readsImages: true;
};

/**
 * Concrete client branded with route-table identity.
 */
export type CandidateBallotRouteClient = {
  /**
   * Provider-neutral client using exact wire routes.
   */
  readonly client: SyntheticClient;
  /**
   * Manifest route-table digest.
   */
  readonly providerRouteDigest: string;
  /**
   * Module-local route binding brand.
   */
  readonly [CANDIDATE_BALLOT_ROUTE_CLIENT]: true;
};

/**
 * Exact finite Candidate I Hyper roster.
 */
export const CANDIDATE_BALLOT_HYPER_MODELS: readonly CandidateBallotHyperModel[] = [
  {
    requestId: 'hf:Qwen/Qwen3.8-27B',
    id: 'qwen3.8-27b',
    requestOutputTokens: 32_000,
    readsImages: true,
  },
  {
    requestId: 'hf:zai-org/GLM-5.3-Flash',
    id: 'glm-5.3-flash',
    requestOutputTokens: 32_000,
    readsImages: true,
  },
  {
    requestId: 'minimax-m3',
    id: 'minimax-m3',
    requestOutputTokens: 32_000,
    readsImages: true,
  },
];

/**
 * Digests exact route ids and output caps.
 *
 * @returns Route-table identity bound into Candidate I manifest
 *
 * @example
 * ```ts
 * const digest = candidateBallotHyperRouteDigest({ routes, });
 * ```
 */
export function candidateBallotHyperRouteDigest({
  routes,
}: {
  readonly routes: readonly CandidateBallotHyperModel[];
}): string {
  return hashContent({ content: JSON.stringify(routes,), });
}

/**
 * Returns exact candidate-local Hyper route for canonical identity.
 *
 * @returns Vetted route row
 *
 * @example
 * ```ts
 * const model = candidateBallotHyperModel({ modelId: 'hf:zai-org/GLM-5.3-Flash', });
 * ```
 */
export function candidateBallotHyperModel({
  modelId,
}: {
  readonly modelId: RosterModelId;
}): CandidateBallotHyperModel {
  /**
   * Candidate-local row matching canonical identity.
   */
  const model = CANDIDATE_BALLOT_HYPER_MODELS.find(function same(row,) {
    return row.requestId === modelId;
  },);
  if (model === undefined)
    throw new Error(`candidate ballot Hyper model is unavailable: ${modelId}`);
  return model;
}

/**
 * Brands controlled client with exact route identity.
 *
 * Test support uses this only for scripted clients that make no provider request.
 * Production callers use {@link createCandidateBallotHyperClient}.
 *
 * @returns Frozen route-bound client
 *
 * @example
 * ```ts
 * const routeClient = bindCandidateBallotRouteClient({ client, providerRouteDigest, });
 * ```
 */
export function bindCandidateBallotRouteClient({
  client,
  providerRouteDigest,
}: {
  readonly client: SyntheticClient;
  readonly providerRouteDigest: string;
}): CandidateBallotRouteClient {
  return Object.freeze({
    client,
    providerRouteDigest,
    [CANDIDATE_BALLOT_ROUTE_CLIENT]: true as const,
  });
}

/**
 * Refuses forged or stale route-client binding.
 *
 * @example
 * ```ts
 * assertCandidateBallotRouteClient({ routeClient, manifest, });
 * ```
 */
export function assertCandidateBallotRouteClient({
  routeClient,
  manifest,
}: {
  readonly routeClient: CandidateBallotRouteClient;
  readonly manifest: CandidateBallotManifest;
}): void {
  if ((!routeClient[CANDIDATE_BALLOT_ROUTE_CLIENT])
    || (routeClient.providerRouteDigest !== manifest.providerRouteDigest))
    throw new Error('candidate ballot concrete route binding differs');
}

/**
 * Creates zero-retry Candidate I Hyper client from manifest routes.
 *
 * @returns Route-bound provider-neutral client preserving canonical identities
 *
 * @example
 * ```ts
 * const routeClient = createCandidateBallotHyperClient({ apiKey: 'test', manifest, });
 * ```
 */
export function createCandidateBallotHyperClient({
  apiKey,
  manifest,
  transport = fetchTransport,
}: {
  readonly apiKey: string;
  readonly manifest: CandidateBallotManifest;
  readonly transport?: ModelTransport;
}): CandidateBallotRouteClient {
  /**
   * Route digest recomputed before constructing concrete client.
   */
  const routeDigest = candidateBallotHyperRouteDigest({ routes: manifest.providerRoutes, });
  if (routeDigest !== manifest.providerRouteDigest)
    throw new Error('candidate ballot manifest route digest differs');
  return bindCandidateBallotRouteClient({
    client: createHyperExpansionClient({
      apiKey,
      models: manifest.providerRoutes,
      transport,
    },),
    providerRouteDigest: routeDigest,
  });
}
