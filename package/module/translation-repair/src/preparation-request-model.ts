import type { PreparationReceiptQuestion, } from './preparation-receipt-model.ts';
import type { ProviderName, } from './provider-name.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Registered preparation request data

/**
 * Exact provider request captured before transmission, without headers or credentials.
 * @example
 * ```ts
 * const request: PreparationProviderRequest = { modelId, provider, method: 'POST', url, bodyJson };
 * ```
 */
export type PreparationProviderRequest = {
  /** One model identity, independent of the provider serving it. */
  readonly modelId: RosterModelId;
  /** Compiled text-serving route in existing provider order. */
  readonly provider: ProviderName;
  /** Model generation operation, not a budget read. */
  readonly method: 'POST';
  /** Exact compiled endpoint, excluding authorization headers. */
  readonly url: string;
  /** Exact native serialized body, including emitted completion cap and schema handling. */
  readonly bodyJson: string;
};

/**
 * Conservative POST envelope for one configured identity under existing block-pairing recovery.
 * @example
 * ```ts
 * const bounds: PreparationModelRequestBounds = { modelId, providers, maxStageCalls, maxHttpAttemptsPerProvider, maxModelPosts };
 * ```
 */
export type PreparationModelRequestBounds = {
  /** Identity whose alternate routes cannot become independent votes. */
  readonly modelId: RosterModelId;
  /** Every compiled permitted text route, not only currently wet providers. */
  readonly providers: readonly ProviderName[];
  /** Initial gather plus existing block-pairing retry rounds, with no additional nudge. */
  readonly maxStageCalls: number;
  /** Initial HTTP request plus existing per-provider transient retries. */
  readonly maxHttpAttemptsPerProvider: number;
  /** Conservative product of stage, provider and HTTP bounds, not predicted usage. */
  readonly maxModelPosts: number;
};

/**
 * Provider-free request materialization for one block question.
 * This does not certify attempt provenance, provider availability, runtime identity or final unit admission.
 * @example
 * ```ts
 * const plan = await captureBlockPairingRequests({ question, modelIds, exchangeTimeoutMs, signal, l });
 * ```
 */
export type PreparationRequestManifest = {
  /** Data generation independent of legacy pairing caches. */
  readonly version: 1;
  /** Explicit stage with no recovery-nudge prompt variant. */
  readonly stage: 'block-pairing';
  /** Current numbered texts and actual shared protocol. */
  readonly question: PreparationReceiptQuestion;
  /** Complete ordered electorate used to materialize potential requests. */
  readonly modelIds: readonly RosterModelId[];
  /** Registered native stage timeout, without an effort or thinking control. */
  readonly exchangeTimeoutMs: number;
  /** Captured bodies in electorate order and then compiled provider order. */
  readonly requests: readonly PreparationProviderRequest[];
  /** Separate bounds per identity; budget GETs and redirects are not model POSTs. */
  readonly bounds: readonly PreparationModelRequestBounds[];
  /** Digest of this request configuration, not model-prompt equivalence or full runtime identity. */
  readonly requestConfigurationDigest: string;
};

//endregion Registered preparation request data
