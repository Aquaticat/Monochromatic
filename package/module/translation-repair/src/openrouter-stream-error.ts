import { isJsonRecord, } from './json-guard.ts';
import { openRouterChunksOf, } from './openrouter-chunk-scan.ts';
import { openRouterEndpointOf, } from './openrouter-endpoint.ts';

//region OpenRouter in-stream error
// A PROVIDER FAILURE THAT ARRIVES AS A SUCCESS. OpenRouter answers a chat
// completion with HTTP 200 and starts the event stream before the upstream
// has answered; when the upstream then fails, the gateway cannot change the
// status it already sent, so it writes one chunk carrying an `error` object
// (`{"code":504,"message":"error code: 504","metadata":{"error_type":
// "timeout"}}`, captured 2026-09-04) and closes the stream without `[DONE]`.
//
// WHAT THAT LOOKED LIKE BEFORE THIS READER. `requireStreamTerminator` saw
// no terminator and threw "stream ended without its [DONE] terminator; the
// reply was cut off": a true statement about the framing and a wrong
// diagnosis of the cause. On 2026-09-04, 114 of the day's 115 such failures
// were MiniMax M3 served by ModelRun, each a body of 846 characters that
// "completed" after about 10.5 seconds with no content, and a direct probe
// of that endpoint reproduced the frame on the fourth of six calls. The
// retry ladder handled every one as a truncated reply, which is the right
// action for the wrong reason, and the run log named no endpoint and no
// code, so the endpoint's failure rate (119 of 300 streams that day) had to
// be reconstructed from the raw-character count.
//
// NAMES, NEVER THE BODY. The gateway's error message is free text from the
// upstream; this reader carries the numeric code, the gateway's error type
// and the endpoint's display name, which is what an operator needs to act
// and nothing a run log must not hold.

/**
 * Field OpenRouter puts the upstream's failure in, on the chunk that ends
 * a failed stream.
 */
const ERROR_KEY = 'error';

/**
 * Field inside the error object naming the failure class.
 */
const CODE_KEY = 'code';

/**
 * Field inside the error object carrying the gateway's own metadata.
 */
const METADATA_KEY = 'metadata';

/**
 * Field inside the metadata naming the failure kind.
 */
const ERROR_TYPE_KEY = 'error_type';

/**
 * Value written where the wire carried no usable field.
 */
const UNNAMED = 'unnamed';

/**
 * What one stream's error chunk said, reduced to names.
 *
 * @example
 * ```ts
 * const found: StreamErrorReading = { found: true, code: 504, errorType: 'timeout', endpoint: 'ModelRun', };
 * ```
 */
export type StreamErrorReading =
  | {
    readonly found: true;

    /**
     * Numeric failure class the gateway reported, or that it reported none.
     */
    readonly code: number | typeof UNNAMED;

    /**
     * Gateway's failure kind, or that it named none.
     */
    readonly errorType: string;

    /**
     * Upstream the gateway named as serving the call, or that it named none.
     */
    readonly endpoint: string;
  }
  | { readonly found: false; };

/**
 * Reading given when no chunk carried an error object.
 */
export const STREAM_ERROR_ABSENT: StreamErrorReading = { found: false, };

/**
 * Raised when a success-status stream carried a provider failure instead of
 * a completion.
 *
 * DISTINCT FROM `MalformedCompletionError`, which names a body this client
 * cannot read; this body was read fine and says the upstream failed. Both
 * ride the retry ladder as thrown transport failures, because the ladder
 * retries whatever `verify` throws.
 */
export class InStreamProviderError extends Error {
  /**
   * Declares this message safe to forward: it carries a code, a failure kind
   * and an endpoint's display name, never the upstream's text.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Numeric failure class the gateway reported, or that it reported none.
   */
  readonly code: number | typeof UNNAMED;

  /**
   * Upstream the gateway named as serving the call, or that it named none.
   */
  readonly endpoint: string;

  /**
   * Names the failure the stream carried.
   *
   * @param code - numeric failure class, or that none was reported
   *
   * @param errorType - gateway's failure kind, or that none was named
   *
   * @param endpoint - upstream display name, or that none was named
   *
   * @example
   * ```ts
   * throw new InStreamProviderError({ code: 504, errorType: 'timeout', endpoint: 'ModelRun', },);
   * ```
   */
  constructor(
    {
      code,
      errorType,
      endpoint,
    }: {
      readonly code: number | typeof UNNAMED;
      readonly errorType: string;
      readonly endpoint: string;
    },
  ) {
    super(
      `stream carried a provider failure instead of a completion: code ${String(code,)}, `
        + `type ${errorType}, served by ${endpoint}; the gateway had already sent a success status`,
    );
    this.name = 'InStreamProviderError';
    this.code = code;
    this.endpoint = endpoint;
  }
}

/**
 * Reads the failure a stream's error chunk carried, if any chunk carried one.
 *
 * THE FIRST ERROR CHUNK WINS, as the endpoint reader's first name does: the
 * gateway writes one and closes.
 *
 * @param bodyText - whole drained `text/event-stream` body
 *
 * @returns Code, kind and endpoint of the failure, or that none was carried
 *
 * @example
 * ```ts
 * const reading = openRouterStreamErrorOf({ bodyText: reply.bodyText, },);
 * ```
 */
export function openRouterStreamErrorOf(
  { bodyText, }: { readonly bodyText: string; },
): StreamErrorReading {
  /**
   * Error objects the chunks carried, in arrival order.
   */
  const errors = openRouterChunksOf({ bodyText, },)
    .flatMap(function errorOf(chunk,): readonly Readonly<Record<string, unknown>>[] {
      /**
       * Whatever sits at the field, of unknown type until checked.
       */
      const error = chunk[ERROR_KEY];
      return isJsonRecord(error,) ? [error,] : [];
    },);

  /**
   * First error object, or none.
   */
  const [first,] = errors;
  if (first === undefined)
    return STREAM_ERROR_ABSENT;

  /**
   * Numeric code, or that none was reported.
   */
  const code = first[CODE_KEY];

  /**
   * Gateway metadata, of unknown shape until checked.
   */
  const metadata = first[METADATA_KEY];

  /**
   * Failure kind, or that none was named.
   */
  const errorType = isJsonRecord(metadata,) ? metadata[ERROR_TYPE_KEY] : undefined;

  /**
   * Upstream named on the chunks, or that none was.
   */
  const endpoint = openRouterEndpointOf({ bodyText, },);

  return {
    found: true,
    code: ((typeof code) === 'number') ? code : UNNAMED,
    errorType: ((typeof errorType) === 'string') ? errorType : UNNAMED,
    endpoint: endpoint.reported ? endpoint.name : UNNAMED,
  };
}

/**
 * Refuses a success body whose stream carried a provider failure.
 *
 * ASKED BEFORE THE TERMINATOR CHECK, because such a stream also lacks its
 * terminator and the terminator check would otherwise name the framing
 * rather than the failure.
 *
 * @param bodyText - whole drained `text/event-stream` body
 *
 * @throws {@link InStreamProviderError} when a chunk carried an error object
 *
 * @example
 * ```ts
 * requireNoStreamError({ bodyText, },);
 * ```
 */
export function requireNoStreamError(
  { bodyText, }: { readonly bodyText: string; },
): void {
  /**
   * What the stream said about failing.
   */
  const reading = openRouterStreamErrorOf({ bodyText, },);
  if (reading.found) {
    throw new InStreamProviderError({
      code: reading.code,
      errorType: reading.errorType,
      endpoint: reading.endpoint,
    },);
  }
}

//endregion OpenRouter in-stream error
