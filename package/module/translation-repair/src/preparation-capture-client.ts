import { createBedrockClient, } from './bedrock-client.ts';
import type { BedrockLedger, } from './bedrock-ledger.ts';
import type { ModelCaller, } from './chat-contract.ts';
import { createHyperClient, } from './hyper-client.ts';
import { createOpenRouterClient, } from './openrouter-client.ts';
import { PreparationRequestCaptureError, } from './preparation-request-capture-error.ts';
import type { ProviderName, } from './provider-name.ts';
import { createSyntheticClient, } from './synthetic-client.ts';
import type { ModelTransport, } from './synthetic-transport.ts';

//region Non-serving native client construction

/**
 * Refuses every accounting operation during request-only materialization.
 *
 * @throws PreparationRequestCaptureError always
 *
 * @example
 * ```ts
 * forbidCaptureAccounting();
 * ```
 */
function forbidCaptureAccounting(): never {
  throw new PreparationRequestCaptureError({ kind: 'ledger', },);
}

/**
 * No ledger path or account operation exists at this capture-only adapter.
 */
const CAPTURE_LEDGER: BedrockLedger = {
  /**
   * Access is refused rather than returning a fictional filesystem path.
   */
  get path(): never {
    return forbidCaptureAccounting();
  },
  /**
   * Capturing a request cannot record a paid response.
   */
  note: forbidCaptureAccounting,
  /**
   * Capturing a request cannot inspect real or fabricated account credit.
   */
  read: forbidCaptureAccounting,
};

/**
 * Builds a native provider client whose only transport is the caller's non-serving capture adapter.
 *
 * @param provider - compiled text-serving route
 *
 * @param transport - mandatory adapter that records and stops before transmission
 *
 * @returns Native request construction without environment credentials, network transport or usable accounting
 *
 * @throws PreparationRequestCaptureError when runtime provider identity is unsupported
 *
 * @example
 * ```ts
 * const client = preparationCaptureClient({ provider: 'synthetic', transport, });
 * ```
 */
export function preparationCaptureClient({
  provider,
  transport,
}: {
  readonly provider: ProviderName;
  readonly transport: ModelTransport;
},): ModelCaller {
  /**
   * Capture changes delivery retries only; native model payload defaults stay intact.
   */
  const options = {
    apiKey: 'preparation-request-capture-only',
    transport,
    retryPolicy: {
      limit: 0,
      baseMs: 1,
    },
  };
  if (provider === 'synthetic')
    return createSyntheticClient(options,);
  if (provider === 'hyper')
    return createHyperClient(options,);
  if (provider === 'openrouter')
    return createOpenRouterClient(options,);
  if (provider === 'bedrock')
    return createBedrockClient({
      ...options,
      ledger: CAPTURE_LEDGER,
    },);
  throw new PreparationRequestCaptureError({ kind: 'no-route', },);
}

//endregion Non-serving native client construction
