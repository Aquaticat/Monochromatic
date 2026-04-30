/**
 * GET /m/:id/c/:idx/raw and GET /m/:id/c/:idx/md.
 *
 * Pure-data endpoints: HTML or markdown of one chunk. Used by the
 * client to lazy-load chunk bodies during prev/next navigation in
 * tier-3 chunk-paginated mode and to populate the edit composer.
 *
 * Same caching contract as the page handlers: strong ETag derived from
 * `(revision, chunkIdx)`, `Cache-Control: no-cache, must-revalidate`.
 */

import {
  getChunk,
  getSnapshot,
} from '../../lib/db/messages.ts';
import {
  etagForChunk,
  matches,
} from '../../lib/etag.ts';
import {
  HTTP_GONE,
  HTTP_INTERNAL_ERROR,
  HTTP_NOT_FOUND,
  HTTP_NOT_MODIFIED,
  HTTP_OK,
} from '../../lib/http.ts';

/**
 * Picks the rendered HTML field of a chunk.
 *
 * @param chunk - chunk row with `md` and `html`
 *
 * @returns the HTML string
 *
 * @example
 * ```ts
 * pickHtml({ md: '# hi', html: '<h1>hi</h1>' }); // '<h1>hi</h1>'
 * ```
 */
function pickHtml(chunk: ChunkFields,): string {
  return chunk.html;
}

/**
 * Picks the source markdown field of a chunk.
 *
 * @param chunk - chunk row with `md` and `html`
 *
 * @returns the markdown string
 *
 * @example
 * ```ts
 * pickMd({ md: '# hi', html: '<h1>hi</h1>' }); // '# hi'
 * ```
 */
function pickMd(chunk: ChunkFields,): string {
  return chunk.md;
}

/** Chunk row shape consumed by the data-endpoint pickers. */
type ChunkFields = {
  readonly md: string;
  readonly html: string;
};

/**
 * Returns the raw pre-rendered HTML for one chunk.
 *
 * @param input - message id, chunk index
 *
 * @param ifNoneMatch - request `If-None-Match` header
 *
 * @returns 200 with HTML body, 304, 404, or 410
 *
 * @example
 * ```ts
 * const r = await renderChunkRaw({ messageId: 1, chunkIndex: 0 }, null);
 * ```
 */
export async function renderChunkRaw(
  input: {
    messageId: number;
    chunkIndex: number;
  },
  ifNoneMatch: string | null,
): Promise<Response> {
  return await renderChunkData(
    {
      ...input,
      contentType: 'text/html; charset=utf-8',
      pickField: pickHtml,
    },
    ifNoneMatch,
  );
}

/**
 * Returns the source markdown for one chunk. Drives the edit composer.
 *
 * @param input - message id, chunk index
 *
 * @param ifNoneMatch - request `If-None-Match` header
 *
 * @returns 200 with markdown body, 304, 404, or 410
 *
 * @example
 * ```ts
 * const r = await renderChunkMd({ messageId: 1, chunkIndex: 0 }, null);
 * ```
 */
export async function renderChunkMd(
  input: {
    messageId: number;
    chunkIndex: number;
  },
  ifNoneMatch: string | null,
): Promise<Response> {
  return await renderChunkData(
    {
      ...input,
      contentType: 'text/markdown; charset=utf-8',
      pickField: pickMd,
    },
    ifNoneMatch,
  );
}

/**
 * Shared implementation for the two data endpoints. Differs only in
 * the field returned and the Content-Type header.
 *
 * @param input - identifiers + which chunk field to return
 *
 * @param ifNoneMatch - request `If-None-Match` header
 *
 * @returns 200, 304, 404, or 410
 */
async function renderChunkData(
  input: {
    messageId: number;
    chunkIndex: number;
    contentType: string;
    pickField: (chunk: ChunkFields,) => string;
  },
  ifNoneMatch: string | null,
): Promise<Response> {
  const snapshot = await getSnapshot(input.messageId,);
  if (snapshot === null) {
    return new Response(
      null,
      {
        status: HTTP_GONE,
        headers: { 'Cache-Control': 'no-store', },
      },
    );
  }
  const etag = etagForChunk({
    revision: snapshot.revision,
    chunkIndex: input.chunkIndex,
  },);
  if (matches(
    ifNoneMatch,
    etag,
  )) {
    return new Response(
      null,
      {
        status: HTTP_NOT_MODIFIED,
        headers: {
          ETag: etag,
          'Cache-Control': 'no-cache, must-revalidate',
        },
      },
    );
  }
  if (input.chunkIndex < 0 || input.chunkIndex >= snapshot.chunkCount) {
    return new Response(
      null,
      {
        status: HTTP_NOT_FOUND,
        headers: { 'Cache-Control': 'no-store', },
      },
    );
  }
  const chunk = await getChunk({
    messageId: input.messageId,
    chunkIndex: input.chunkIndex,
  },);
  if (chunk === null) {
    return new Response(
      null,
      {
        status: HTTP_INTERNAL_ERROR,
        headers: { 'Cache-Control': 'no-store', },
      },
    );
  }
  return new Response(
    input.pickField(chunk,),
    {
      status: HTTP_OK,
      headers: {
        'Content-Type': input.contentType,
        ETag: etag,
        'Cache-Control': 'no-cache, must-revalidate',
      },
    },
  );
}
