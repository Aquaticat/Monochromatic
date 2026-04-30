/**
 * HTTP status code constants.
 *
 * Extracted from inline number literals to keep response paths readable
 * and to satisfy `no-magic-numbers`. Only the codes the demo actually
 * uses are defined here; add more as new responses appear.
 */

/** 200 OK -- request succeeded. */
export const HTTP_OK = 200;

/** 201 Created -- new resource created. */
export const HTTP_CREATED = 201;

/** 204 No Content -- request succeeded, no body. */
export const HTTP_NO_CONTENT = 204;

/** 302 Found -- temporary redirect that may change method on follow. */
export const HTTP_FOUND = 302;

/** 303 See Other -- response is at the URL in `Location`. */
export const HTTP_SEE_OTHER = 303;

/** 304 Not Modified -- conditional GET hit cache. */
export const HTTP_NOT_MODIFIED = 304;

/** 400 Bad Request -- malformed input. */
export const HTTP_BAD_REQUEST = 400;

/** 403 Forbidden -- identity check failed. */
export const HTTP_FORBIDDEN = 403;

/** 404 Not Found -- resource never existed. */
export const HTTP_NOT_FOUND = 404;

/** 409 Conflict -- request collides with current state (revision cap, missing chunks). */
export const HTTP_CONFLICT = 409;

/** 410 Gone -- resource existed and was deleted. */
export const HTTP_GONE = 410;

/** 413 Payload Too Large -- single chunk exceeded the hard cap. */
export const HTTP_PAYLOAD_TOO_LARGE = 413;

/** 500 Internal Server Error -- handler crashed. */
export const HTTP_INTERNAL_ERROR = 500;
