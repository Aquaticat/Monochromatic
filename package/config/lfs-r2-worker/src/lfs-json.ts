/**
 Git LFS batch API JSON responses.

 @module
 */

/**
 Content type the batch API speaks on both request and response.
 */
export const LFS_JSON = 'application/vnd.git-lfs+json';

/**
 Parameters for {@link lfsJson}.
 */
export type LfsJsonParams = {
  /**
   Value serialized as the response payload.
   */
  readonly body: unknown;
  /**
   HTTP status code to return.
   */
  readonly status: number;
};

/**
 Build a git-lfs JSON response with the protocol content type.

 @param body - value serialized as the response payload

 @param status - HTTP status code to return

 @returns response carrying `body` as git-lfs JSON

 @example
 ```ts
 lfsJson({ body: { transfer: 'basic', objects: [] }, status: 200 });
 ```
 */
export function lfsJson({
  body,
  status,
}: LfsJsonParams,): Response {
  return Response.json(
    body,
    {
      status,
      headers: { 'Content-Type': LFS_JSON, },
    },
  );
}
