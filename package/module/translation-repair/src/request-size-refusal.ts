import { SyntheticHttpError, } from './completion-shape.ts';

//region Request size refusal
// The gateway caps request bodies and reports a body over that cap as a JSON
// parse failure at a byte offset. That message describes the serialisation we
// sent, which is well-formed, so a caller reading it looks for a defect in our
// encoder and finds none. Re-raising the one case where the cap explains it is
// what makes the failure legible.
//
// `doc/troubleshooting/synthetic-request-body-size-cap.md` holds the
// measurement this rests on.

/**
 * Largest request body measured to reach the gateway intact.
 *
 * EXACT, UNLIKE ITS COUNTERPART. This size was sent and accepted. The failing
 * size opposite it is reported as approximate and the boundary between them has
 * never been bisected, so this is the only number here that may be compared
 * against.
 */
const PASSING_BODY_BYTES = 10_485_760;

/**
 * Opening of the message the gateway returns for a body over its cap.
 *
 * MATCHED BY PREFIX rather than whole, because the tail carries the byte offset
 * where the truncated body stopped parsing and that offset differs per request.
 */
const PARSE_FAILURE_MARK = 'Could not parse request as valid JSON';

/**
 * Bad Request: the status an oversize body comes back as.
 */
const HTTP_BAD_REQUEST = 400;

/**
 * Signals a request the gateway refused for its size while naming something
 * else.
 *
 * A SUBCLASS RATHER THAN A SIBLING, so every caller branching on
 * {@link SyntheticHttpError} or reading its `status` keeps working. This is one
 * kind of HTTP failure, not a separate failure mode, and a caller that does not
 * care why a `400` arrived should not have to learn about this to keep catching
 * it.
 *
 * @example
 * ```ts
 * throw new SyntheticRequestTooLargeError({
 *   status: 400,
 *   bodyText: 'Could not parse request as valid JSON. Unterminated string ...',
 *   bodyBytes: 11_185_335,
 * },);
 * ```
 */
export class SyntheticRequestTooLargeError extends SyntheticHttpError {
  /**
   * Declares this message safe to forward: it counts bytes.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Bytes the request body occupied on the wire, measured rather than
   * estimated.
   */
  public readonly bodyBytes: number;

  /**
   * Bytes a body is known to survive at, so a reader has both halves of the
   * comparison without opening this file.
   */
  public readonly passingBodyBytes: number;

  /**
   * Builds failure naming size, replacing the message its parent composed.
   *
   * @param status - status returned, carried through so `instanceof` callers
   * branching on it see what they always saw
   *
   * @param bodyText - raw response body, excerpted by the parent constructor
   *
   * @param bodyBytes - measured wire size of what was sent
   *
   * @example
   * ```ts
   * new SyntheticRequestTooLargeError({
   *   status: 400,
   *   bodyText: 'Could not parse request as valid JSON.',
   *   bodyBytes: 11_185_335,
   * },);
   * ```
   */
  public constructor(
    {
      status,
      bodyText,
      bodyBytes,
    }: {
      readonly status: number;
      readonly bodyText: string;
      readonly bodyBytes: number;
    },
  ) {
    super({
      status,
      bodyText,
      // THE GATEWAY'S OWN WORDS STILL FOLLOW THIS, appended by the parent.
      // They are the misleading half, but removing them would take away the
      // one thing a reader could search a provider status page for.
      summary: `Synthetic API refused a request body of ${String(bodyBytes,)} bytes, `
        + `${String(bodyBytes - PASSING_BODY_BYTES,)} above the ${String(PASSING_BODY_BYTES,)} `
        + `measured to pass. It answered HTTP ${String(status,)} naming a JSON parse failure, `
        + `which describes the body we serialised rather than its size, and that body is `
        + `well-formed. Send less in one call: fewer or smaller pictures, a shorter `
        + `instruction, or a smaller slice. `
        + `doc/troubleshooting/synthetic-request-body-size-cap.md records the measurement. `
        + `Gateway said:`,
    },);
    this.name = 'SyntheticRequestTooLargeError';
    this.bodyBytes = bodyBytes;
    this.passingBodyBytes = PASSING_BODY_BYTES;
  }
}

/**
 * Names why a non-success reply failed, re-reading the gateway's size refusal.
 *
 * THREE SIGNALS TOGETHER, and the conjunction is the point. Status alone would
 * catch every malformed request we ever send; the message alone would catch a
 * body we genuinely broke; the size alone would catch an oversize request the
 * gateway happened to accept and then fail for its own reasons. Only all three
 * describe a body refused for being too big, and any one of them missing leaves
 * a plain {@link SyntheticHttpError} saying exactly what it always said.
 *
 * AFTER THE FACT, NEVER BEFORE IT. Nothing here refuses a request. Only the
 * passing size is exact, so a client-side guard at that number would reject
 * bodies between it and the true boundary that the gateway may well carry.
 * Reading an answer that already arrived cannot cost a call that would have
 * worked.
 *
 * @param status - status returned
 *
 * @param bodyText - raw response body, read for its message and excerpted into
 * whichever failure is built
 *
 * @param requestBodyBytes - wire size of what was sent, which must be measured
 * in bytes: this corpus is Chinese, and character counts run about a third of
 * the bytes their UTF-8 costs
 *
 * @returns Failure to throw, size-naming only where all three signals agree
 *
 * @example
 * ```ts
 * throw failureForReply({
 *   status: reply.status,
 *   bodyText: reply.bodyText,
 *   requestBodyBytes: Buffer.byteLength(bodyJson,),
 * },);
 * ```
 */
export function failureForReply(
  {
    status,
    bodyText,
    requestBodyBytes,
  }: {
    readonly status: number;
    readonly bodyText: string;
    readonly requestBodyBytes: number;
  },
): SyntheticHttpError {
  /**
   * Whether the status is the one an oversize body draws.
   */
  const refusedAsBadRequest = status === HTTP_BAD_REQUEST;

  /**
   * Whether the gateway blamed our JSON, which is what it says about a body
   * it stopped reading partway through.
   */
  const blamedOurJson = bodyText.includes(PARSE_FAILURE_MARK,);

  /**
   * Whether what went out was larger than anything measured to arrive.
   */
  const overPassingSize = requestBodyBytes > PASSING_BODY_BYTES;

  if (
    refusedAsBadRequest
    && blamedOurJson
      && overPassingSize
  ) {
    return new SyntheticRequestTooLargeError({
      status,
      bodyText,
      bodyBytes: requestBodyBytes,
    },);
  }

  return new SyntheticHttpError({
    status,
    bodyText,
  },);
}

//endregion Request size refusal
