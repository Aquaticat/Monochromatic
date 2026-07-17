import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Transport abstraction
// The one seam between the client and the network: tests inject a fake transport
// with recorded replies, drivers use the fetch-backed default. Keeping the seam at
// raw status-plus-body level means recorded fixtures stay copy-pasteable from real
// traffic and every parsing branch above the seam is exercised by unit tests.

/**
 * Raw reply from one HTTP exchange, before any parsing.
 *
 * @example
 * ```ts
 * const reply: TransportReply = { status: 200, bodyText: '{"choices":[]}', };
 * ```
 */
export type TransportReply = {
  /**
   * HTTP status code.
   */
  readonly status: number;

  /**
   * Response body as text; JSON parsing happens above the transport seam.
   */
  readonly bodyText: string;
};

/**
 * One HTTP exchange the client asks a transport to perform.
 * `signal` is mandatory so no call can be constructed that user steering
 * cannot abort.
 *
 * @example
 * ```ts
 * const exchange: TransportExchange = {
 *   url: SYNTHETIC_QUOTAS_URL,
 *   method: 'GET',
 *   headers: { Authorization: 'Bearer test-key', },
 *   signal: AbortSignal.timeout(30_000,),
 * };
 * ```
 */
export type TransportExchange = {
  /**
   * Absolute request URL.
   */
  readonly url: string;

  /**
   * HTTP method; the Synthetic surface needs only these two.
   */
  readonly method: 'GET' | 'POST';

  /**
   * Request headers, auth included.
   */
  readonly headers: Readonly<Record<string, string>>;

  /**
   * Serialized JSON request body; absent on GET exchanges.
   */
  readonly bodyJson?: string;

  /**
   * Abort signal honored for the whole exchange.
   */
  readonly signal: AbortSignal;
};

/**
 * Transport function the client is parameterized over.
 *
 * @example
 * ```ts
 * const recorded: ModelTransport = async () => ({ status: 200, bodyText: '{}', });
 * ```
 */
export type ModelTransport = (
  exchange: ForeignBorrowed<TransportExchange>,
) => Promise<TransportReply>;

/**
 * Default fetch-backed transport.
 * `fetch` receives only locally owned values:
 * primitive strings, a fresh headers copy, and a dependent signal,
 * so caller-owned objects are never retained by the platform request.
 *
 * @param exchange - request to perform
 *
 * @mutates exchange - DOM commit 5796f716 AbortSignal.any dependent-signal relations can retain the exchange signal, and undiciFetch retains the derived signal and may invoke abort listeners through it for the request lifetime.
 *
 * @returns Status and body text, whatever the status was
 *
 * @example
 * ```ts
 * const reply = await fetchTransport({
 *   url: SYNTHETIC_QUOTAS_URL,
 *   method: 'GET',
 *   headers: { Authorization: `Bearer ${apiKey}`, },
 *   signal,
 * },);
 * ```
 */
export async function fetchTransport(
  exchange: ForeignBorrowed<TransportExchange>,
): Promise<TransportReply> {
  /**
   * Fields extracted after naming the effect boundary;
   * url, method, and body are primitives.
   */
  const {
    url,
    method,
    headers,
    bodyJson,
    signal,
  } = exchange;

  /**
   * Dependent signal derived locally so the platform request never holds the
   * caller's own signal handle.
   */
  const dependentSignal = AbortSignal.any([signal,],);

  /**
   * Raw fetch response; body is read as text so callers decide how to parse.
   * Chat exchanges stream (the provider is finicky without streaming, and
   * headers on a stream arrive before fetch's default headers timeout);
   * reading to text drains the whole event stream.
   */
  const response = await fetch(
    url,
    {
      method,
      // Fresh copy: header values are primitive strings, so the platform
      // request holds no caller-owned object.
      headers: { ...headers, },
      // Conditional spread keeps body absent (not explicitly undefined) on GET.
      ...(bodyJson === undefined
        ? {}
        : { body: bodyJson, }),
      signal: dependentSignal,
    },
  );

  return {
    status: response.status,
    bodyText: await response.text(),
  };
}

//endregion Transport abstraction
