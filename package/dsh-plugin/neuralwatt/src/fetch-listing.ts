/**
 NeuralWatt listing transport: the one bounded fetch that turns the public
 model endpoint into listing entries. @module
 */

import {
  NEURALWATT_LISTING_TIMEOUT_MS,
  NEURALWATT_LISTING_URL,
} from './constants.ts';
import { isRecord, type NeuralWattListingEntry, } from './listing.ts';

//region Types

/**
 Response shape the listing read needs from one HTTP call; `Response`
 satisfies it.
 */
export type NeuralWattListingResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
};

/**
 HTTP call shape the listing read makes: one GET carrying an abort signal.
 */
export type NeuralWattListingFetcher = (options: {
  readonly url: string;
  readonly signal: AbortSignal;
}) => Promise<NeuralWattListingResponse>;

/**
 Failure to read the NeuralWatt model listing: the endpoint answered with a
 non-success status, a body that is not a model listing, or not at all within
 the fetch bound. The message names the endpoint and the failing step, and the
 caught transport failure rides along as `cause`.
 */
export class NeuralWattListingError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown; }) {
    super(message, options);
    this.name = 'NeuralWattListingError';
  }
}

//endregion Types

//region Public API

/**
 Read the public NeuralWatt model listing once, within a fixed time bound.

 @param options - transport and bound overrides for tests and deployments

 @returns listing entries exactly as the endpoint sent them, minus members
 that are not records, which can never describe a model

 @throws {@link NeuralWattListingError} when the endpoint fails, answers with
 a body that is not a model listing, or the bound expires

 @example
 ```ts
 const listing = await fetchNeuralWattListing();
 ```
 */
export async function fetchNeuralWattListing(
  {
    fetcher = ({ url, signal, }) => globalThis.fetch(url, { signal, },),
    timeoutMs = NEURALWATT_LISTING_TIMEOUT_MS,
  }: {
    readonly fetcher?: NeuralWattListingFetcher;
    readonly timeoutMs?: number;
  } = {},
): Promise<readonly NeuralWattListingEntry[]> {
  /**
   Abort source the bound fires against.
   */
  const controller = new AbortController();
  /**
   Bound timer cleared when the fetch settles.
   */
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  /**
   Parsed response body.
   */
  let body: unknown;
  try {
    /**
     Listing response the endpoint returned.
     */
    const response = await fetcher({
      url: NEURALWATT_LISTING_URL,
      signal: controller.signal,
    },);
    if (!response.ok) {
      throw new NeuralWattListingError(
        `NeuralWatt listing GET ${NEURALWATT_LISTING_URL} failed: HTTP ${String(response.status,)}`,
      );
    }
    body = await response.json();
  } catch (error) {
    throw error instanceof NeuralWattListingError
      ? error
      : new NeuralWattListingError(
        `NeuralWatt listing GET ${NEURALWATT_LISTING_URL} failed at the transport step`,
        { cause: error, },
      );
  } finally {
    clearTimeout(timer);
  }
  if (!isRecord(body) || !Array.isArray(body.data)) {
    throw new NeuralWattListingError(
      `NeuralWatt listing GET ${NEURALWATT_LISTING_URL} failed: response carries no model list`,
    );
  }
  /**
   Listing entries collected in endpoint order.
   */
  const listing: NeuralWattListingEntry[] = [];
  for (const item of body.data) {
    if (isRecord(item))
      listing.push(item,);
  }
  return listing;
}

//endregion Public API
