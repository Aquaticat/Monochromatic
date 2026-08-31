// PROTOTYPE ONLY: Candidate I local Hyper model mapping before product adoption.

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
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
 * Candidate-local model route proven without mutating product allowlist.
 */
export type CandidateBallotHyperModel = HyperExpansionModel & {
  /**
   * Canonical identity used for author and verifier independence.
   */
  readonly requestId: RosterModelId;
  /**
   * Whether current Hyper row accepts page image.
   */
  readonly readsImages: true;
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
 * Digests exact local route ids and output caps.
 *
 * @returns Route-table identity bound into Candidate I manifest
 *
 * @example
 * ```ts
 * const digest = candidateBallotHyperRouteDigest();
 * ```
 */
export function candidateBallotHyperRouteDigest(): string {
  return hashContent({ content: JSON.stringify(CANDIDATE_BALLOT_HYPER_MODELS,), });
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
 * Creates zero-retry Candidate I Hyper client from local mapping.
 *
 * @returns Provider-neutral client preserving canonical identities
 *
 * @example
 * ```ts
 * const client = createCandidateBallotHyperClient({ apiKey: 'test', });
 * ```
 */
export function createCandidateBallotHyperClient({
  apiKey,
  transport = fetchTransport,
}: {
  readonly apiKey: string;
  readonly transport?: ModelTransport;
}): SyntheticClient {
  return createHyperExpansionClient({
    apiKey,
    models: CANDIDATE_BALLOT_HYPER_MODELS,
    transport,
  },);
}
