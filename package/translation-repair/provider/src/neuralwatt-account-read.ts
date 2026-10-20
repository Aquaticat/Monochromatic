import { isSuccessStatus, } from '@monochromatic-dev/translation-repair-markup/ts';
import {
  type ModelTransport,
  ProviderHttpError,
} from '@monochromatic-dev/translation-repair-provider-stream/ts';
import { neuralWattUsageByModelUrlFor, } from './neuralwatt-catalog.ts';
import { coveredWhOf, } from './neuralwatt-usage.ts';
import {
  exchangeWithRetry,
  type RetryPolicy,
} from './transient-retry.ts';

//region NeuralWatt account read
// ONE READ OF THE ACCOUNT'S COVERED ENERGY for a window, over the transport seam. It throws on any failure, so the
// day session (`neuralwatt-day-session.ts`) decides what an outage means: the last figure for the same day stands,
// else the ledger counts alone, with one warning.

/**
 Reads the covered energy the whole account used in a window.

 @param headers - request headers, auth included

 @param baseUrl - API base address

 @param transport - HTTP the read goes over

 @param retryPolicy - transient-retry pacing

 @param asked - the window: the day's start to now

 @param signal - abort signal for the read

 @returns Watt-hours the covered models' rows add up to

 @throws {@link ProviderHttpError} on a non-success status

 @throws {@link import('./neuralwatt-usage.ts').NeuralWattUsageShapeError} on a body that is not the documented
 shape or answers for another window than the one asked

 @example
 ```ts
 const wh = await readAccountCoveredWh({ headers, baseUrl, transport, retryPolicy, asked, signal, },);
 ```
 */
export async function readAccountCoveredWh(
  {
    headers,
    baseUrl,
    transport,
    retryPolicy,
    asked,
    signal,
  }: {
    readonly headers: Readonly<Record<string, string>>;
    readonly baseUrl: string;
    readonly transport: ModelTransport;
    readonly retryPolicy: RetryPolicy;
    readonly asked: {
      readonly start: Date;
      readonly end: Date;
    };
    readonly signal: AbortSignal;
  },
): Promise<number> {
  /**
   Reply from the by-model route.
   */
  const reply = await exchangeWithRetry({
    provider: 'neuralwatt',
    transport,
    exchange: {
      url: neuralWattUsageByModelUrlFor({
        baseUrl,
        ...asked,
      },),
      label: 'usage-by-model',
      method: 'GET',
      headers,
      signal,
    },
    policy: retryPolicy,
  },);
  if (!isSuccessStatus({ status: reply.status, },))
    throw new ProviderHttpError({
      provider: 'neuralwatt',
      status: reply.status,
      bodyText: reply.bodyText,
      summary: `NeuralWatt /usage/by-model returned HTTP ${String(reply.status,)}:`,
    },);
  return coveredWhOf({
    bodyText: reply.bodyText,
    asked,
  },);
}

//endregion NeuralWatt account read
