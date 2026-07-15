/**
 * Draft API: create, chunk PUT, finalize, cancel.
 *
 * All handlers return JSON. Identity is sent in the body for create /
 * finalize and cross-checked against the draft's stored `user_id` for
 * the others. The chunk PUT is identity-free; `draft_id` is opaque
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
  REJECTED,
} from '../../lib/db/drafts.ts';
import { sweepOrphans, } from '../../lib/db/sweep.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_CREATED,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_OK,
} from '../../lib/http.ts';

/**
 * Decimal radix for `parseInt`.
 */
const DECIMAL_RADIX = 10;

/**
 * Sentinel returned by `stringField` when a body field is absent or not
 * a string. A unique `Symbol` rather than `null`: a valid field is
 * always a string, so callers gate with `=== MISSING`.
 */
const MISSING: unique symbol = Symbol('messages-demo:field-missing',);

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
    /**
     * Decoded body; defaulted so an absent body still flows through the shape check.
     */
    const body = await readBody<unknown>(event,) ?? {};
    if (!isRecord(body,)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid body',
      },);
    }
    /**
     * Client-supplied draft id; required so cross-tab races over the same draft collide on the same row.
     */
    const id = stringField({
      body,
      key: 'id',
    },);
    /**
     * Owning user; cross-checked against the draft row by later endpoints.
     */
    const userId = stringField({
      body,
      key: 'user_id',
    },);
    /**
     * Parent draft id for copy-on-write edits; `MISSING` (omitted below) for fresh messages.
     */
    const parentId = stringField({
      body,
      key: 'parent_id',
    },);
    if ((id === MISSING) || (userId === MISSING)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing id or user_id',
      },);
    }

    await createDraft({
      id,
      userId,
      ...(parentId === MISSING ? {} : { parentId, }),
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
    /**
     * Required `:id` path param; bails to 400 when missing.
     */
    const draftId = requirePathParam({
      ...paramsInput(event.context
        .params,),
      name: 'id',
    },);
    /**
     * Raw `:seq` path param; parsed as decimal below.
     */
    const seqRaw = requirePathParam({
      ...paramsInput(event.context
        .params,),
      name: 'seq',
    },);
    /**
     * Parsed seq; non-negative integer or the request is rejected.
     */
    const seq = Number.parseInt(
      seqRaw,
      DECIMAL_RADIX,
    );
    if ((!Number.isFinite(seq,)) || (seq < 0)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid seq',
      },);
    }

    /**
     * Decoded body; defaulted so an absent body still flows through the shape check.
     */
    const body = await readBody<unknown>(event,) ?? {};
    if (!isRecord(body,)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid body',
      },);
    }
    /**
     * Markdown payload; required, written to chunks.md.
     */
    const md = stringField({
      body,
      key: 'md',
    },);
    /**
     * Rendered HTML payload; required, written to chunks.html.
     */
    const html = stringField({
      body,
      key: 'html',
    },);
    /**
     * Raw `char_count` value; narrowed to number below before the upsert.
     */
    const charCountRaw = body.char_count;
    if ((md === MISSING) || (html === MISSING)
      || ((typeof charCountRaw) !== 'number')) {
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

    /**
     * Highest contiguous seq already on disk; the client uses this to drop acknowledged outbox entries.
     */
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
    /**
     * Required `:id` path param; bails to 400 when missing.
     */
    const draftId = requirePathParam({
      ...paramsInput(event.context
        .params,),
      name: 'id',
    },);
    /**
     * Decoded body; defaulted so an absent body still flows through the shape check.
     */
    const body = await readBody<unknown>(event,) ?? {};
    if (!isRecord(body,)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid body',
      },);
    }
    /**
     * Identity claimed by the finalize call; cross-checked against the draft row.
     */
    const userId = stringField({
      body,
      key: 'user_id',
    },);
    /**
     * Preview snippet copied into messages.preview for the index page.
     */
    const preview = stringField({
      body,
      key: 'preview',
    },);
    /**
     * Raw `char_count`; narrowed to number below before the finalize.
     */
    const charCount = body.char_count;
    /**
     * Raw `chunk_count`; narrowed to number below before the finalize.
     */
    const chunkCount = body.chunk_count;
    if (
      (userId === MISSING)
      || (preview === MISSING)
        || ((typeof charCount) !== 'number')
        || ((typeof chunkCount) !== 'number')
    ) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing finalize fields',
      },);
    }

    /**
     * Newly-allocated messages.id; `REJECTED` when the draft is empty, missing, or owned by another user.
     */
    const messageId = await finalizeDraft({
      draftId,
      userId,
      charCount,
      chunkCount,
      preview,
    },);

    if (messageId === REJECTED) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'draft is empty, missing, or owned by a different user',
      },);
    }

    await sweepOrphans({},);

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
    /**
     * Required `:id` path param; bails to 400 when missing.
     */
    const draftId = requirePathParam({
      ...paramsInput(event.context
        .params,),
      name: 'id',
    },);
    /**
     * Reads the body if present; cancel tolerates absent body and reads
     * identity from the JSON, so an empty object is returned on any read
     * failure (including no body sent).
     *
     * @returns parsed body, or `{}` when absent or unreadable
     */
    async function readBodyOrEmpty(): Promise<unknown> {
      try {
        return await readBody<unknown>(event,) ?? {};
      }
      catch {
        return {};
      }
    }
    /**
     * Best-effort body read; cancel tolerates absent body and reads identity from the JSON below.
     */
    const body = await readBodyOrEmpty();
    if (!isRecord(body,)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid body',
      },);
    }
    /**
     * Identity claimed by the cancel call; cross-checked against the draft row.
     */
    const userId = stringField({
      body,
      key: 'user_id',
    },);
    if (userId === MISSING) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing user_id',
      },);
    }

    /**
     * True when the cancel deleted a draft; false signals not-found or ownership mismatch.
     */
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

//region Local validation helpers: thin wrappers, no library

/**
 * Type-guard for plain object bodies. Rejects arrays and `null`.
 *
 * @param value - decoded JSON body
 *
 * @returns `true` when `value` is a plain object
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return (value !== null) && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

/**
 * Reads a string field from a JSON body, returning `MISSING` when absent
 * or not a string.
 *
 * @param body - decoded JSON record
 *
 * @param key - field name
 *
 * @returns string value, or `MISSING` when absent or not a string
 */
function stringField({
  body,
  key,
}: {
  readonly body: Readonly<Record<string, unknown>>;
  readonly key: string;
},): string | typeof MISSING {
  /**
   * Indexed once so the typeof narrow and the return both reference the same value.
   */
  const value = body[key];
  return (typeof value) === 'string' ? value : MISSING;
}

/**
 * Bridges h3's `event.context.params` (present or `undefined`) into a
 * spreadable object whose `params` property is omitted when absent, so
 * call sites build the helper input under `exactOptionalPropertyTypes`
 * without naming a `| undefined` slot.
 *
 * @param params - h3 route parameter record, or `undefined` when none matched
 *
 * @returns object carrying `params` only when present
 *
 * @example
 * ```ts
 * requirePathParam({ ...paramsInput(event.context.params), name: 'id' });
 * ```
 */
function paramsInput(
  params?: Readonly<Record<string, string>>,
): { readonly params?: Readonly<Record<string, string>>; } {
  if (params === undefined)
    return {};
  return { params, };
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
function requirePathParam({
  params,
  name,
}: {
  readonly params?: Readonly<Record<string, string>>;
  readonly name: string;
},): string {
  /**
   * Indexed once so the empty-string check and the return both reference the same value.
   */
  const value = params?.[name];
  if ((value === undefined) || (value === '')) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: `missing route param: ${name}`,
    },);
  }
  return value;
}

//endregion
