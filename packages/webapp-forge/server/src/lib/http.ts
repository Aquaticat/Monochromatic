/**
 * HTTP status code constants used by routes and clients.
 *
 * Defined as named constants so call sites stay readable.
 * Mirrors the pattern from `packages/webapp-content/messages-demo/src/lib/http.ts`.
 */

/** Successful request. */
export const HTTP_OK = 200;

/** Resource created. */
export const HTTP_CREATED = 201;

/** No body returned but request succeeded. */
export const HTTP_NO_CONTENT = 204;

/** Client supplied invalid input. */
export const HTTP_BAD_REQUEST = 400;

/** Caller is not authenticated for the requested action. */
export const HTTP_UNAUTHORIZED = 401;

/** Resource does not exist. */
export const HTTP_NOT_FOUND = 404;

/** Conflict with current state (e.g. duplicate insert). */
export const HTTP_CONFLICT = 409;

/** Server-side failure. */
export const HTTP_INTERNAL_SERVER_ERROR = 500;
