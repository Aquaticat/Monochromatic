import {
  type BedrockLedger,
  createBedrockClient,
  createHyperClient,
  createOpenRouterClient,
  createSyntheticClient,
  type ModelCaller,
  type ModelTransport,
  type ProviderRecord,
  type RetryPolicy,
} from '../dist/final/node/index.mjs';

//region Independent native provider constructors

/**
 * Prevents these request fixtures from reading or writing account state.
 * @throws Error always
 * @example
 * ```ts
 * unexpectedNativeAccounting();
 * ```
 */
function unexpectedNativeAccounting(): never {
  throw new Error('native request fixture must not access accounting',);
}

/** Independently supplied no-accounting adapter, not the production capture factory's ledger. */
const FIXTURE_LEDGER: BedrockLedger = {
  /** No path is fabricated when the fixture has no filesystem ledger. */
  get path(): never {
    return unexpectedNativeAccounting();
  },
  /** Scripted model replies must not record spend. */
  note: unexpectedNativeAccounting,
  /** The fixture supplies router budget state separately. */
  read: unexpectedNativeAccounting,
};

/**
 * Constructs each native client explicitly, independently of preparationCaptureClient's provider dispatch.
 * @param transports - owned mocked HTTP adapters, one per provider
 * @param retryPolicy - actual retry limit with fixture-only pacing
 * @returns Native clients whose independent mapping can detect a capture-factory dispatch error
 * @example
 * ```ts
 * const callers = nativePreparationClients({ transports, retryPolicy });
 * ```
 */
export function nativePreparationClients({ transports, retryPolicy, }: {
  readonly transports: ProviderRecord<ModelTransport>;
  readonly retryPolicy: RetryPolicy;
},): ProviderRecord<ModelCaller> {
  /** Dummy authentication and delivery controls never enter expected model payloads. */
  const options = { apiKey: 'independent-native-fixture-only', retryPolicy, };
  return {
    synthetic: createSyntheticClient({ ...options, transport: transports.synthetic, },),
    hyper: createHyperClient({ ...options, transport: transports.hyper, },),
    bedrock: createBedrockClient({ ...options, transport: transports.bedrock, ledger: FIXTURE_LEDGER, },),
    openrouter: createOpenRouterClient({ ...options, transport: transports.openrouter, },),
  };
}

//endregion Independent native provider constructors
