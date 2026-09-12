import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { blockPairingProtocol, } from './block-pairing-protocol.ts';
import type { BlockPairingQuestion, } from './block-pairing-question.ts';
import { capturePreparationProviderRequest, } from './capture-preparation-provider-request.ts';
import { hashContent, } from './document-node.ts';
import { mapOverlapped, } from './overlapped-map.ts';
import { assertPairingSeats, } from './pair-blocks-evidence-identity.ts';
import { PreparationRequestCaptureError, } from './preparation-request-capture-error.ts';
import type {
  PreparationModelRequestBounds,
  PreparationProviderRequest,
  PreparationRequestManifest,
} from './preparation-request-model.ts';
import { PROVIDER_ORDER, } from './provider-name.ts';
import { reachOf, } from './roster-reach.ts';
import { STAGE_RETRY_ROUNDS, } from './stage-quorum.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { DEFAULT_RETRY_POLICY, } from './transient-retry.ts';

//region Native block-preparation request registration

/**
 * Captures potential native provider bodies for one queried parent without any network or accounting operation.
 * Materializes bodies for prepareBlockPairing's windowed caller and promptUniqueClient's routed chatText path;
 * it invokes native provider clients individually, not the production routing or seating operation.
 * It does not add the separate recovery nudge used by other stages or infer current provider budgets.
 *
 * @param question - exact current numbered parent texts, not a historical aggregate
 *
 * @param modelIds - complete ordered configured preparation electorate
 *
 * @param exchangeTimeoutMs - caller-selected native per-call timeout to include; runtime agreement is checked by its owner
 *
 * @param signal - caller cancellation respected before client construction and between captures
 *
 * @param l - caller logger retaining the frozen question scope
 *
 * @returns Owned actual request bytes, conservative POST bounds and request-configuration digest
 *
 * @throws PreparationRequestCaptureError when structural dispatch, timeout, reach or native capture is unsupported
 *
 * @throws PairingEvidenceError when the configured electorate is empty or repeats identities
 *
 * @example
 * ```ts
 * const manifest = await captureBlockPairingRequests({ question, modelIds, exchangeTimeoutMs, signal, l });
 * ```
 */
export async function captureBlockPairingRequests({
  question,
  modelIds,
  exchangeTimeoutMs,
  signal,
  l,
}: {
  readonly question: Pick<BlockPairingQuestion, 'sourceBlocks' | 'targetBlocks'>;
  readonly modelIds: readonly RosterModelId[];
  readonly exchangeTimeoutMs: number;
  readonly signal: AbortSignal;
  readonly l: Logger;
},): Promise<PreparationRequestManifest> {
  /**
   * Parent-scoped planning telemetry contains no request text or headers.
   */
  const pl = tagged({
    tag: captureBlockPairingRequests.name,
    l,
  },);
  signal.throwIfAborted();
  /**
   * Owned inputs remain consistent across asynchronous native client construction.
   */
  const numbered = structuredClone({
    sourceBlocks: question.sourceBlocks,
    targetBlocks: question.targetBlocks,
  },);
  /**
   * Caller mutation cannot change the registered electorate during capture.
   */
  const registeredModels = [...modelIds,];
  assertPairingSeats({
    modelIds: registeredModels,
    l: pl,
  },);
  if ((!Number.isFinite(exchangeTimeoutMs,)) || (exchangeTimeoutMs <= 0))
    throw new PreparationRequestCaptureError({ kind: 'timeout', },);
  if ((numbered.sourceBlocks
    .length
    === 0) || (numbered.targetBlocks
      .length
      === 0)
    || ((numbered.sourceBlocks
      .length
      === 1) && (numbered.targetBlocks
        .length
        === 1)))
    throw new PreparationRequestCaptureError({ kind: 'question', },);
  /**
   * Owned canonical protocol is materialized before any client or provider-request capture.
   */
  const protocol = blockPairingProtocol(numbered,);
  /**
   * Initial block gather plus its existing retries; this caller has no extra nudge.
   */
  const maxStageCalls = 1 + STAGE_RETRY_ROUNDS;
  /**
   * Per-provider physical attempts retain production's retry policy, not the capture adapter's zero retries.
   */
  const maxHttpAttemptsPerProvider = 1 + DEFAULT_RETRY_POLICY.limit;
  /**
   * Bounded serial materialization preserves electorate and provider order.
   */
  const models = await mapOverlapped({
    items: registeredModels,
    overlap: 1,
    oneItem: async function captureModel({ item: modelId, }): Promise<{
    readonly requests: readonly PreparationProviderRequest[];
    readonly bounds: PreparationModelRequestBounds;
  }> {
    signal.throwIfAborted();
    /**
     * Existing router reach includes owner-withheld routes.
     */
    const reach = reachOf({ modelId, },);
    /**
     * Route enumeration does not turn providers into separate identities.
     */
    const providers = PROVIDER_ORDER.filter(function serves(provider,): boolean {
      return reach[provider];
    },);
    if (providers.length === 0)
      throw new PreparationRequestCaptureError({ kind: 'no-route', },);
    /**
     * Full native destination bodies, not handwritten gateway approximations.
     */
    const requests = await mapOverlapped({
      items: providers,
      overlap: 1,
      oneItem: async function captureProvider({ item: provider, }): Promise<PreparationProviderRequest> {
      return await capturePreparationProviderRequest({
        provider,
        request: {
          modelId,
          messages: protocol.messages,
          responseFormat: protocol.responseFormat,
          signal,
          exchangeTimeoutMs,
        },
        l: pl,
      },);
    },
    },);
    /**
     * Conservative route-fallback envelope records one model denominator.
     */
    const bounds: PreparationModelRequestBounds = {
      modelId,
      providers,
      maxStageCalls,
      maxHttpAttemptsPerProvider,
      maxModelPosts: maxStageCalls * providers.length
        * maxHttpAttemptsPerProvider,
    };
    return {
      requests,
      bounds,
    };
  },
  },);
  /**
   * Explicit data excludes mutable signal state, occurrence coordinates and headers.
   */
  const data = {
    version: 1 as const,
    stage: 'block-pairing' as const,
    question: {
      ...numbered,
      protocol,
    },
    modelIds: registeredModels,
    exchangeTimeoutMs,
    requests: models.flatMap(function requestsOf(model,): readonly PreparationProviderRequest[] { return model.requests; },),
    bounds: models.map(function boundsOf(model,): PreparationModelRequestBounds { return model.bounds; },),
  };
  pl.info(`captured ${String(data.requests
    .length,)} provider bodies for ${String(registeredModels.length,)} identities without transmission`,);
  return structuredClone({
    ...data,
    requestConfigurationDigest: hashContent({ content: JSON.stringify(data,), },),
  },);
}

//endregion Native block-preparation request registration
