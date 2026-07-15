/**
 * ETag derivation and `If-None-Match` handling.
 *
 * Strong ETags for chunk endpoints: `"r<rev>-<idx>"` where `rev` is
 * `messages.revision` and `idx` is the chunk index within the message.
 * Strong feed ETags: `"f<maxId>-<maxUpdatedAt>"`.
 *
 * The values are **strong** (no `W/` prefix) because the byte content of
 * a (revision, idx) tuple is fully determined: chunks are pre-rendered
 * once and never re-rendered. A successful `If-None-Match` therefore
 * permits the browser to serve the cached body verbatim.
 */

/**
 * Builds the strong ETag header value for a single chunk response.
 *
 * @param revision - `messages.revision`
 *
 * @param chunkIndex - chunk index within the message
 *
 * @returns quoted ETag value, e.g. `"r3-7"`
 *
 * @example
 * ```ts
 * etagForChunk({ revision: 3, chunkIndex: 7 }); // '"r3-7"'
 * ```
 */
export function etagForChunk(
  {
    revision,
    chunkIndex,
  }: {
    readonly revision: number;
    readonly chunkIndex: number;
  },
): string {
  return `"r${String(revision,)}-${String(chunkIndex,)}"`;
}

/**
 * Builds the strong ETag header value for a feed page.
 *
 * Derived from the maximum message id and updated_at across the live
 * (non-deleted) messages. Any new message, edit, or delete bumps one of
 * these, so the cached feed body is invalidated immediately.
 *
 * @param maxId - `MAX(messages.id)` over live rows; 0 when corpus is empty
 *
 * @param maxUpdatedAt - `MAX(messages.updated_at)` over live rows; 0 when
 *                      corpus is empty
 *
 * @returns quoted ETag value
 *
 * @example
 * ```ts
 * etagForFeed({ maxId: 1042, maxUpdatedAt: 1714080000000 });
 * // '"f1042-1714080000000"'
 * ```
 */
export function etagForFeed(
  {
    maxId,
    maxUpdatedAt,
  }: {
    readonly maxId: number;
    readonly maxUpdatedAt: number;
  },
): string {
  return `"f${String(maxId,)}-${String(maxUpdatedAt,)}"`;
}

/**
 * Tests whether the request's `If-None-Match` header matches the supplied
 * ETag. The comparison is byte-exact; there is only one strong ETag
 * shape per resource.
 *
 * @param input - raw `If-None-Match` header value plus the resource's ETag
 *
 * @returns `true` when the client's cached copy is current
 *
 * @example
 * ```ts
 * if (matches({ ifNoneMatch: req.headers.get('if-none-match'), etag })) return new Response(null, { status: 304 });
 * ```
 */
export function matches(
  input: {
    readonly ifNoneMatch?: string;
    readonly etag: string;
  },
): boolean {
  if (input.ifNoneMatch
    === undefined)
    return false;
  // The client may send a comma-separated list (e.g. multiple cached
  // entries for the same URL across redirects); a hit on any of them
  // means our resource is current.
  return input
    .ifNoneMatch
    .split(',',)
    .map(function trim(part,) {
      return part.trim();
    },)
    .includes(input.etag,);
}
