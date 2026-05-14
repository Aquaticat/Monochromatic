/**
 * Write-side route handlers (create issue, comment, label).
 *
 * Every handler runs the dispatcher synchronously after the write so
 * the next read sees the rebuilt fragment.
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  HTTPError,
} from 'h3';

import {
  createCommentWithEvent,
  createIssueWithEvent,
  getIssueByNumber,
  getLabel,
  getRepoByOwnerLogin,
  labelIssueWithEvent,
} from '../../data/queries.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_CREATED,
  HTTP_NOT_FOUND,
} from '../../lib/http.ts';
import {
  DECIMAL_RADIX,
  requireActor,
  requireParam,
  runDispatch,
} from './helpers.ts';

/**
 * Shape of the body accepted by {@link createIssueHandler}.
 */
type CreateIssuePayload = {
  title?: unknown;
  body?: unknown;
  number?: unknown;
};

/**
 * Shape of the body accepted by {@link createCommentHandler}.
 */
type CreateCommentPayload = {
  body?: unknown;
};

/**
 * `POST /api/repos/:owner/:repo/issues`: creates an issue. Body must
 * include `title`; `body` and `number` are optional.
 */
export const createIssueHandler: EventHandlerWithFetch = defineHandler(
  async function handleCreateIssue(event,) {
    const owner = requireParam(
      event.context.params,
      'owner',
    );
    const repoName = requireParam(
      event.context.params,
      'repo',
    );
    const actor = await requireActor(event,);
    const repo = await getRepoByOwnerLogin({
      ownerLogin: owner,
      name: repoName,
    },);
    if (repo === undefined) {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'repo not found',
      },);
    }
    const payload = await event.req.json() as CreateIssuePayload;
    const title = typeof payload.title === 'string' ? payload.title : '';
    if (title === '') {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing title',
      },);
    }
    const issueBody = typeof payload.body === 'string' ? payload.body : '';
    const number = typeof payload.number === 'number'
      ? payload.number
      : Date.now();
    const issueId = `i-${owner}-${repoName}-${String(number,)}`;
    const now = Date.now();
    await createIssueWithEvent({
      id: issueId,
      repoId: repo.id,
      number,
      authorId: actor.id,
      title,
      body: issueBody,
      createdAt: now,
    },);
    await runDispatch();
    return Response.json(
      {
        id: issueId,
        number,
      },
      { status: HTTP_CREATED, },
    );
  },
);

/**
 * `POST /api/repos/:owner/:repo/issues/:number/comments`: posts a
 * comment to an existing issue. Body must include `body`.
 */
export const createCommentHandler: EventHandlerWithFetch = defineHandler(
  async function handleCreateComment(event,) {
    const owner = requireParam(
      event.context.params,
      'owner',
    );
    const repoName = requireParam(
      event.context.params,
      'repo',
    );
    const numberRaw = requireParam(
      event.context.params,
      'number',
    );
    const number = Number.parseInt(
      numberRaw,
      DECIMAL_RADIX,
    );
    const actor = await requireActor(event,);
    const repo = await getRepoByOwnerLogin({
      ownerLogin: owner,
      name: repoName,
    },);
    if (repo === undefined) {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'repo not found',
      },);
    }
    const issue = await getIssueByNumber({
      repoId: repo.id,
      number,
    },);
    if (issue === undefined) {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'issue not found',
      },);
    }
    const payload = await event.req.json() as CreateCommentPayload;
    const body = typeof payload.body === 'string' ? payload.body : '';
    if (body === '') {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing body',
      },);
    }
    const now = Date.now();
    const commentId = `c-${issue.id}-${String(now,)}`;
    await createCommentWithEvent({
      id: commentId,
      issueId: issue.id,
      authorId: actor.id,
      body,
      createdAt: now,
    },);
    await runDispatch();
    return Response.json(
      { id: commentId, },
      { status: HTTP_CREATED, },
    );
  },
);

/**
 * `POST /api/repos/:owner/:repo/issues/:number/labels/:label`: attaches
 * a label to an existing issue. Idempotent at the data layer; the event
 * fires every call so filter list fragments still rebuild.
 */
export const labelIssueHandler: EventHandlerWithFetch = defineHandler(
  async function handleLabelIssue(event,) {
    const owner = requireParam(
      event.context.params,
      'owner',
    );
    const repoName = requireParam(
      event.context.params,
      'repo',
    );
    const numberRaw = requireParam(
      event.context.params,
      'number',
    );
    const labelId = requireParam(
      event.context.params,
      'label',
    );
    const number = Number.parseInt(
      numberRaw,
      DECIMAL_RADIX,
    );
    await requireActor(event,);
    const repo = await getRepoByOwnerLogin({
      ownerLogin: owner,
      name: repoName,
    },);
    if (repo === undefined) {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'repo not found',
      },);
    }
    const issue = await getIssueByNumber({
      repoId: repo.id,
      number,
    },);
    if (issue === undefined) {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'issue not found',
      },);
    }
    const label = await getLabel(labelId,);
    if (label === undefined) {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'label not found',
      },);
    }
    await labelIssueWithEvent({
      issueId: issue.id,
      labelId: label.id,
      createdAt: Date.now(),
    },);
    await runDispatch();
    return Response.json(
      { ok: true, },
      { status: HTTP_CREATED, },
    );
  },
);
