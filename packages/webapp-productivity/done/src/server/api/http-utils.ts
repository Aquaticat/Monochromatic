/**
 * Shared HTTP response utilities for API handlers.
 */

/** HTTP status code for successful responses. */
export const HTTP_OK = 200;

/** HTTP status code for resource creation. */
export const HTTP_CREATED = 201;

/** HTTP status code for bad requests. */
export const HTTP_BAD_REQUEST = 400;

/** HTTP status code for not found. */
export const HTTP_NOT_FOUND = 404;

/** HTTP status code for conflict (blocked task). */
export const HTTP_CONFLICT = 409;

/** HTTP status code for internal server errors. */
export const HTTP_INTERNAL_ERROR = 500;

/**
 * Wraps a payload in a JSON `Response` with the correct content type.
 *
 * @param payload - Serializable value
 *
 * @param status - HTTP status code (defaults to 200)
 *
 * @returns JSON response with content-type header
 */
export function jsonResponse(
  payload: unknown,
  status: number = HTTP_OK,
): Response {
  return Response.json(
    payload,
    { status, },
  );
}
