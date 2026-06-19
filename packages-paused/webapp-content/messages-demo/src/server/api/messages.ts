/**
 * Message API: edit and delete.
 *
 * Both endpoints require the identity `user_id` in the body to match
 * the message's stored `user_id`. They piggyback bounded sweeps so the
 * demo never needs a background timer for cleanup.
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  HTTPError,
  readBody,
} from 'h3';

import {
  editMessage,
  softDeleteMessage,
} from '../../lib/db/messages.ts';
import {
  sweepDeleted,
  sweepOrphans,
} from '../../lib/db/sweep.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_FORBIDDEN,
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
 * POST /api/messages/:id/edit
 *
 * Body: `{ user_id, new_draft_id, char_count, chunk_count, preview }`.
 * Atomically swaps the message's `draft_id` to the new draft and
 * increments `revision`. Returns 409 when the revision cap is reached.
 */
export const editMessageHandler: EventHandlerWithFetch = defineHandler(
  async function handleEditMessage(event,) {
    /**
     * Parsed `:id` path param; throws 400 when missing or non-positive.
     */
    const messageId = parseMessageId(event.context
      .params,);
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
     * Identity claimed by the edit; cross-checked against the message row.
     */
    const userId = stringField({
      body,
      key: 'user_id',
    },);
    /**
     * Newly-created child draft id pointed at by the swap.
     */
    const newDraftId = stringField({
      body,
      key: 'new_draft_id',
    },);
    /**
     * Preview snippet copied into messages.preview for the index page.
     */
    const preview = stringField({
      body,
      key: 'preview',
    },);
    /**
     * Raw `char_count`; narrowed to number below before the edit call.
     */
    const charCount = body.char_count;
    /**
     * Raw `chunk_count`; narrowed to number below before the edit call.
     */
    const chunkCount = body.chunk_count;
    if (
      (userId === MISSING)
      || (newDraftId === MISSING)
        || (preview === MISSING)
        || ((typeof charCount) !== 'number')
        || ((typeof chunkCount) !== 'number')
    ) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing edit fields',
      },);
    }

    /**
     * Edit outcome variant; drives the HTTP status returned to the caller.
     */
    const outcome = await editMessage({
      messageId,
      userId,
      newDraftId,
      charCount,
      chunkCount,
      preview,
    },);

    if (outcome.kind
      === 'not-found') {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'no such message',
      },);
    }
    if (outcome.kind
      === 'forbidden') {
      throw new HTTPError({
        status: HTTP_FORBIDDEN,
        message: 'identity mismatch',
      },);
    }
    if (outcome.kind
      === 'capped') {
      throw new HTTPError({
        status: HTTP_CONFLICT,
        message: 'message has reached the 10-revision cap; save as a new message',
      },);
    }

    // Safety-net sweeps for the same user; user-scoped to keep work small.
    await sweepOrphans({ userId, },);

    return Response.json(
      {
        revision: outcome.newRevision,
        location: `/m/${String(messageId,)}/c/0`,
      },
      {
        status: HTTP_OK,
        headers: {
          'Cache-Control': 'no-store',
          Location: `/m/${String(messageId,)}/c/0`,
        },
      },
    );
  },
);

/**
 * POST /api/messages/:id/delete
 *
 * Body: `{ user_id }`. Soft-deletes the message; subsequent feed reads
 * exclude it via the partial index, and `/m/:id/c/:idx` returns 410.
 */
export const deleteMessageHandler: EventHandlerWithFetch = defineHandler(
  async function handleDeleteMessage(event,) {
    /**
     * Parsed `:id` path param; throws 400 when missing or non-positive.
     */
    const messageId = parseMessageId(event.context
      .params,);
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
     * Identity claimed by the delete; cross-checked against the message row.
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
     * Soft-delete outcome variant; drives the HTTP status returned to the caller.
     */
    const outcome = await softDeleteMessage({
      messageId,
      userId,
    },);

    if (outcome.kind
      === 'not-found') {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'no such message',
      },);
    }
    if (outcome.kind
      === 'forbidden') {
      throw new HTTPError({
        status: HTTP_FORBIDDEN,
        message: 'identity mismatch',
      },);
    }

    // Bounded hard-delete sweep: cleans up old soft-deletes opportunistically.
    await sweepDeleted();

    return new Response(
      null,
      {
        status: HTTP_NO_CONTENT,
        headers: { 'Cache-Control': 'no-store', },
      },
    );
  },
);

//region Local helpers

/**
 * Parses the `:id` path parameter as a positive integer.
 *
 * @param params - h3 route parameter record
 *
 * @returns parsed message id
 *
 * @throws `HTTPError` 400 when missing or not a positive integer
 */
function parseMessageId(params?: Readonly<Record<string, string>>,): number {
  /**
   * Raw `:id` path param; empty or undefined trips the 400 below.
   */
  const raw = params?.id;
  if ((raw === undefined) || (raw === '')) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: 'missing message id',
    },);
  }
  /**
   * Parsed id; non-finite or non-positive trips the 400 below.
   */
  const value = Number.parseInt(
    raw,
    DECIMAL_RADIX,
  );
  if ((!Number.isFinite(value,)) || (value <= 0)) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: 'invalid message id',
    },);
  }
  return value;
}

/**
 * Type-guard for plain object bodies.
 *
 * @param value - decoded JSON value
 *
 * @returns `true` when `value` is a plain object
 *
 * @example
 * ```ts
 * if (!isRecord(body)) throw new HTTPError(...);
 * ```
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
 *
 * @example
 * ```ts
 * const name = stringField({ body, key: 'user_id' });
 * ```
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

//endregion
