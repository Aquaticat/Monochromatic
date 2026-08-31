// PROTOTYPE ONLY: Candidate I provider binding and finite-wave helpers.

import { join, } from 'node:path';

import type { SyntheticClient, } from './chat-contract.ts';
import type {
  CandidateBallotManifest,
  CandidateScopedBallot,
} from './prototype-candidate-ballot-model.ts';
import type { CandidateBallotVerifierState, } from './prototype-candidate-ballot-verifier-state.ts';
import { realizationPromptUniqueClient, } from './prototype-realization-prompt-client.ts';

/**
 * Private proof that provider mask selected concrete client.
 */
const CANDIDATE_BALLOT_CLIENT: unique symbol = Symbol('candidate ballot provider bound',);

/**
 * Deeply readonly finite settlement shape.
 */
type CandidateBallotSettled<ValueT,> =
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
export type CandidateBallotProviderClients = {
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
  readonly hyper: SyntheticClient;
};

/**
 * Provider and output-root binding fixed by manifest.
 */
export type CandidateBallotClient = {
  /**
   * Selected provider mask.
   */
  readonly providerSelection: CandidateBallotManifest['providerSelection'];
  /**
   * Manifest binding.
   */
  readonly manifestDigest: string;
  /**
   * Exact output root binding.
   */
  readonly outputDir: string;
  /**
   * Prompt-unique concrete client.
   */
  readonly client: SyntheticClient;
  /**
   * Unforgeable module-local brand.
   */
  readonly [CANDIDATE_BALLOT_CLIENT]: true;
};

/**
 * Selects only manifest-authorized provider route.
 *
 * @returns Frozen branded client bound to manifest and output root
 *
 * @example
 * ```ts
 * const bound = bindCandidateBallotClient({ manifest, outputDir, clients, });
 * ```
 */
export function bindCandidateBallotClient({
  manifest,
  outputDir,
  clients,
}: {
  readonly manifest: CandidateBallotManifest;
  readonly outputDir: string;
  readonly clients: CandidateBallotProviderClients;
}): CandidateBallotClient {
  return Object.freeze({
    providerSelection: manifest.providerSelection,
    manifestDigest: manifest.manifestDigest,
    outputDir,
    client: realizationPromptUniqueClient({
      inner: clients.hyper,
      claimsDir: join(
        outputDir,
        'prompt-claims',
        manifest.manifestDigest,
      ),
    },),
    [CANDIDATE_BALLOT_CLIENT]: true as const,
  });
}

/**
 * Refuses forged, stale, or wrong-root provider binding.
 *
 * @example
 * ```ts
 * assertCandidateBallotClient({ boundClient, manifest, outputDir, });
 * ```
 */
export function assertCandidateBallotClient({
  boundClient,
  manifest,
  outputDir,
}: {
  readonly boundClient: CandidateBallotClient;
  readonly manifest: CandidateBallotManifest;
  readonly outputDir: string;
}): void {
  if ((!boundClient[CANDIDATE_BALLOT_CLIENT])
    || (boundClient.providerSelection !== manifest.providerSelection)
    || (boundClient.manifestDigest !== manifest.manifestDigest)
    || (boundClient.outputDir !== outputDir))
    throw new Error('candidate ballot provider or output binding differs');
}

/**
 * Awaits every independent sibling before exact abort propagation.
 *
 * @returns Fulfilled sibling values after complete settlement
 *
 * @example
 * ```ts
 * const values = await awaitCandidateBallotWave({ nodes, signal, });
 * ```
 */
export async function awaitCandidateBallotWave<ValueT,>({
  nodes,
  signal,
}: {
  readonly nodes: readonly Promise<ValueT>[];
  readonly signal: AbortSignal;
}): Promise<readonly ValueT[]> {
  /**
   * Complete settlement for every independent node.
   */
  const settled: readonly CandidateBallotSettled<ValueT>[] = await Promise.allSettled(nodes,);
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
  readonly states: readonly CandidateBallotVerifierState[];
}): readonly CandidateScopedBallot[] {
  return states.flatMap(function admitted(state,) {
    return state.ballot === undefined ? [] : [state.ballot,];
  },);
}
