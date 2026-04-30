/**
 * Draft API: create, chunk PUT, finalize, cancel.
 *
 * All handlers return JSON. Identity is sent in the body for create /
 * finalize and cross-checked against the draft's stored `user_id` for
 * the others. The chunk PUT is identity-free -- `draft_id` is opaque
 * and finalize is the gatekeeper.
 *
 * Each successful write piggybacks a small bounded sweep on the same
 * SQLite connection so abandoned drafts never accumulate.
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  HTTPError,
  readBody,
} from 'h3';

import {
  cancelDraft,
  createDraft,
  finalizeDraft,
  highestContiguousSeq,
  putChunk,
} from '../../lib/db/drafts.ts';
import { sweepOrphans, } from '../../lib/db/sweep.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_CREATED,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_OK,
} from '../../lib/http.ts';

/** Decimal radix for `parseInt`. */
const DECIMAL_RADIX = 10;

/**
 * POST /api/drafts
 *
 * Body: `{ id, user_id, parent_id? }`. Creates an empty draft. The
 * `parent_id` field is set when this draft is being created as the
 * basis for an edit (copy-on-write); omitted for fresh messages.
 *
 * Piggybacks a user-scoped orphan sweep so abandoned drafts by the same
 * user are reaped before they pile up.
 */
export const createDraftHandler: EventHandlerWithFetch = defineHandler(
  async function handleCreateDraft(event,) {
    const body = await readBody<unknown>(event,) ?? {};
    if (!isRecord(body,)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid body',
      },);
    }
    const id = stringField(
      body,
      'id',
    );
    const userId = stringField(
      body,
      'user_id',
    );
    const parentId = optionalStringField(
      body,
      'parent_id',
    ) ?? null;
    if (id === null || userId === null) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing id or user_id',
      },);
    }

    await createDraft({
      id,
      userId,
      parentId,
    },);

    await sweepOrphans({ userId, },);

    return Response.json(
      { id, },
      {
        status: HTTP_CREATED,
        headers: { 'Cache-Control': 'no-store', },
      },
    );
  },
);

/**
 * PUT /api/drafts/:id/chunks/:seq
 *
 * Body: `{ md, html, char_count }`. Idempotent upsert. Returns the
 * highest contiguous seq already on disk so the client can drop
 * acknowledged entries from its outbox.
 */
export const putChunkHandler: EventHandlerWithFetch = defineHandler(
  async function handlePutChunk(event,) {
    const draftId = requirePathParam(
      event.context.params,
      'id',
    );
    const seqRaw = requirePathParam(
      event.context.params,
      'seq',
    );
    const seq = Number.parseInt(
      seqRaw,
      DECIMAL_RADIX,
    );
    if (!Number.isFinite(seq,) || seq < 0) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid seq',
      },);
    }

    const body = await readBody<unknown>(event,) ?? {};
    if (!isRecord(body,)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid body',
      },);
    }
    const md = stringField(
      body,
      'md',
    );
    const html = stringField(
      body,
      'html',
    );
    const charCountRaw = body['char_count'];
    if (md === null || html === null || typeof charCountRaw !== 'number') {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing md, html, or char_count',
      },);
    }

    await putChunk({
      draftId,
      seq,
      chunk: {
        md,
        html,
        charCount: charCountRaw,
      },
    },);

    const ack = await highestContiguousSeq(draftId,);
    return Response.json(
      { ack, },
      {
        status: HTTP_OK,
        headers: { 'Cache-Control': 'no-store', },
      },
    );
  },
);

/**
 * POST /api/drafts/:id/finalize
 *
 * Body: `{ user_id, char_count, chunk_count, preview }`. Rejects empty
 * drafts (400) and identity mismatch (403). On success returns the new
 * `messages.id` and a 303 `Location` to the first chunk page.
 *
 * Piggybacks an unscoped orphan sweep as the periodic safety net for
 * abandoned drafts owned by users who have not posted in a while.
 */
export const finalizeDraftHandler: EventHandlerWithFetch = defineHandler(
  async function handleFinalizeDraft(event,) {
    const draftId = requirePathParam(
      event.context.params,
      'id',
    );
    const body = await readBody<unknown>(event,) ?? {};
    if (!isRecord(body,)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid body',
      },);
    }
    const userId = stringField(
      body,
      'user_id',
    );
    const preview = stringField(
      body,
      'preview',
    );
    const charCount = body['char_count'];
    const chunkCount = body['chunk_count'];
    if (
      userId === null
      || preview === null
      || typeof charCount !== 'number'
      || typeof chunkCount !== 'number'
    ) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing finalize fields',
      },);
    }

    const messageId = await finalizeDraft({
      draftId,
      userId,
      charCount,
      chunkCount,
      preview,
    },);

    if (messageId === null) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'draft is empty, missing, or owned by a different user',
      },);
    }

    await sweepOrphans({ userId: null, },);

    // 200 (not 303) so `fetch` does not auto-follow the Location and
    // turn our JSON body into the redirected page's HTML. The client
    // reads `location` from the body and navigates explicitly.
    return Response.json(
      {
        messageId,
        location: `/m/${String(messageId,)}/c/0`,
      },
      {
        status: HTTP_OK,
        headers: { 'Cache-Control': 'no-store', },
      },
    );
  },
);

/**
 * DELETE /api/drafts/:id
 *
 * Body: `{ user_id }`. Cancels an unfinalised draft. Refuses to delete
 * a finalised draft (would orphan a messages row).
 */
export const cancelDraftHandler: EventHandlerWithFetch = defineHandler(
  async function handleCancelDraft(event,) {
    const draftId = requirePathParam(
      event.context.params,
      'id',
    );
    let body: unknown = {};
    try {
      body = await readBody<unknown>(event,) ?? {};
    }
    catch {
      // Empty body is acceptable for cancel; identity comes from path.
    }
    if (!isRecord(body,)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid body',
      },);
    }
    const userId = stringField(
      body,
      'user_id',
    );
    if (userId === null) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing user_id',
      },);
    }

    const removed = await cancelDraft({
      draftId,
      userId,
    },);
    if (!removed) {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'draft not cancellable',
      },);
    }

    return new Response(
      null,
      {
        status: HTTP_NO_CONTENT,
        headers: { 'Cache-Control': 'no-store', },
      },
    );
  },
);

//region Local validation helpers -- thin wrappers, no library

/**
 * Type-guard for plain object bodies. Rejects arrays and `null`.
 *
 * @param value - decoded JSON body
 *
 * @returns `true` when `value` is a plain object
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value,);
}

/**
 * Reads a string field from a JSON body, returning `null` when absent
 * or not a string.
 *
 * @param body - decoded JSON record
 *
 * @param key - field name
 *
 * @returns string value or `null`
 */
function stringField(
  body: Record<string, unknown>,
  key: string,
): string | null {
  const value = body[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Like `stringField` but returns `undefined` when absent so callers can
 * distinguish "field not supplied" from "field supplied but invalid."
 *
 * @param body - decoded JSON record
 *
 * @param key - field name
 *
 * @returns string when present and valid, `undefined` when absent,
 *          `null` when present but not a string
 */
function optionalStringField(
  body: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!(key in body))
    return undefined;
  const value = body[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Extracts a required path parameter, throwing 400 if missing.
 *
 * @param params - h3 route parameter record
 *
 * @param name - parameter name
 *
 * @returns parameter value
 *
 * @throws `HTTPError` 400 when parameter is missing
 */
function requirePathParam(
  params: Record<string, string> | undefined,
  name: string,
): string {
  const value = params?.[name];
  if (value === undefined || value === '') {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: `missing route param: ${name}`,
    },);
  }
  return value;
}

//endregion
