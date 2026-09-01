// PROTOTYPE ONLY: Candidate K local Hyper model mapping before product adoption.

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { ReviewUnitManifest, } from './prototype-review-unit-model.ts';
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
 * Candidate K provisional local request deadline.
 */
export const REVIEW_UNIT_REQUEST_TIMEOUT_MS = 900_000;

/**
 * Private proof that concrete client was bound to one route table.
 */
const REVIEW_UNIT_ROUTE_CLIENT: unique symbol = Symbol('review unit route client',);

/**
 * Candidate-local model route proven without product allowlist mutation.
 */
export type ReviewUnitHyperModel = HyperExpansionModel & {
  /**
   * Canonical identity used for model-family independence.
   */
  readonly requestId: RosterModelId;
  /**
   * Whether current Hyper row accepts page image.
   */
  readonly readsImages: true;
  /**
   * Candidate K provisional local call deadline.
   */
  readonly requestTimeoutMs: typeof REVIEW_UNIT_REQUEST_TIMEOUT_MS;
};

/**
 * Shared manifest route identity across finite architectures.
 */
export type ReviewUnitRouteManifest = Pick<
  ReviewUnitManifest,
  'providerRouteDigest' | 'providerRoutes'
>;

/**
 * Concrete client branded with route-table identity.
 */
export type ReviewUnitRouteClient = {
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
  readonly [REVIEW_UNIT_ROUTE_CLIENT]: true;
};

/**
 * Exact finite Candidate K Hyper roster.
 */
export const REVIEW_UNIT_HYPER_MODELS: readonly ReviewUnitHyperModel[] = [
  {
    requestId: 'hf:Qwen/Qwen3.8-27B',
    id: 'qwen3.8-27b',
    requestOutputTokens: 32_000,
    readsImages: true,
    requestTimeoutMs: REVIEW_UNIT_REQUEST_TIMEOUT_MS,
  },
  {
    requestId: 'hf:zai-org/GLM-5.3-Flash',
    id: 'glm-5.3-flash',
    requestOutputTokens: 32_000,
    readsImages: true,
    requestTimeoutMs: REVIEW_UNIT_REQUEST_TIMEOUT_MS,
  },
  {
    requestId: 'minimax-m3',
    id: 'minimax-m3',
    requestOutputTokens: 32_000,
    readsImages: true,
    requestTimeoutMs: REVIEW_UNIT_REQUEST_TIMEOUT_MS,
  },
];

/**
 * Digests exact route ids and output caps.
 *
 * @returns Route-table identity bound into Candidate K manifest
 *
 * @example
 * ```ts
 * const digest = reviewUnitHyperRouteDigest({ routes, });
 * ```
 */
export function reviewUnitHyperRouteDigest({
  routes,
}: {
  readonly routes: readonly ReviewUnitHyperModel[];
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
 * const model = reviewUnitHyperModel({ modelId: 'hf:zai-org/GLM-5.3-Flash', });
 * ```
 */
export function reviewUnitHyperModel({
  modelId,
}: {
  readonly modelId: RosterModelId;
}): ReviewUnitHyperModel {
  /**
   * Candidate-local row matching canonical identity.
   */
  const model = REVIEW_UNIT_HYPER_MODELS.find(function same(row,) {
    return row.requestId === modelId;
  },);
  if (model === undefined)
    throw new Error(`review unit Hyper model is unavailable: ${modelId}`);
  return model;
}

/**
 * Brands controlled client with exact route identity.
 *
 * Test support uses this only for scripted clients that make no provider request.
 * Production callers use {@link createReviewUnitHyperClient}.
 *
 * @returns Frozen route-bound client
 *
 * @example
 * ```ts
 * const routeClient = bindReviewUnitRouteClient({ client, providerRouteDigest, });
 * ```
 */
export function bindReviewUnitRouteClient({
  client,
  providerRouteDigest,
}: {
  readonly client: SyntheticClient;
  readonly providerRouteDigest: string;
}): ReviewUnitRouteClient {
  return Object.freeze({
    client,
    providerRouteDigest,
    [REVIEW_UNIT_ROUTE_CLIENT]: true as const,
  });
}

/**
 * Refuses forged or stale route-client binding.
 *
 * @example
 * ```ts
 * assertReviewUnitRouteClient({ routeClient, manifest, });
 * ```
 */
export function assertReviewUnitRouteClient({
  routeClient,
  manifest,
}: {
  readonly routeClient: ReviewUnitRouteClient;
  readonly manifest: ReviewUnitRouteManifest;
}): void {
  if ((!routeClient[REVIEW_UNIT_ROUTE_CLIENT])
    || (routeClient.providerRouteDigest !== manifest.providerRouteDigest))
    throw new Error('review unit concrete route binding differs');
}

/**
 * Creates zero-retry Candidate K Hyper client from manifest routes.
 *
 * @returns Route-bound provider-neutral client preserving canonical identities
 *
 * @example
 * ```ts
 * const routeClient = createReviewUnitHyperClient({ apiKey: 'test', manifest, });
 * ```
 */
export function createReviewUnitHyperClient({
  apiKey,
  manifest,
  transport = fetchTransport,
}: {
  readonly apiKey: string;
  readonly manifest: ReviewUnitRouteManifest;
  readonly transport?: ModelTransport;
}): ReviewUnitRouteClient {
  /**
   * Route digest recomputed before constructing concrete client.
   */
  const routeDigest = reviewUnitHyperRouteDigest({ routes: manifest.providerRoutes, });
  if (routeDigest !== manifest.providerRouteDigest)
    throw new Error('review unit manifest route digest differs');
  return bindReviewUnitRouteClient({
    client: createHyperExpansionClient({
      apiKey,
      models: manifest.providerRoutes,
      transport,
    },),
    providerRouteDigest: routeDigest,
  });
}
