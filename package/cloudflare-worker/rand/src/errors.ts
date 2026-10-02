/**
 Error classes the router maps onto HTTP statuses.

 Thrown rather than returned so a refusal cannot be silently dropped by a
 caller that forgets to inspect a result field. The Caddy original this Worker
 replaces had no refusal path at all: its template functions coerced
 unparseable input to zero and answered 200, so a caller could receive a value
 drawn from a range it never asked for.

 @module
 */

//region Errors

/**
 Input the request supplied that this Worker refuses to guess at.

 Maps to 400. Covers a missing or non-canonical `min` or `max`, a repeated
 query parameter, a `min` above its `max`, a range too wide to draw from
 uniformly, and a length segment that looks numeric but falls outside the
 served range.
 */
export class BadRequestError extends Error {
  /**
   @param message - explanation naming the offending input and the domain that
    would have been accepted
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'BadRequestError';
  }
}

/**
 Path that matches no route and does not look like an attempt at one.

 Maps to 404. Deliberately distinct from {@link BadRequestError}: a path such
 as `/nope` is unknown rather than malformed, while `/65` shows the caller
 understood the API and asked for too much, so the two deserve different
 statuses and different remediation text.
 */
export class NotFoundError extends Error {
  /**
   @param message - explanation naming the unmatched path and listing the
    served routes
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'NotFoundError';
  }
}

//endregion Errors
