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
    /**
     * Owner login segment of the route path.
     */
    const owner = requireParam({
      params: event.context
        .params,
      name: 'owner',
    },);
    /**
     * Repo name segment of the route path.
     */
    const repoName = requireParam({
      params: event.context
        .params,
      name: 'repo',
    },);
    /**
     * Authenticated actor authoring the new issue.
     */
    const actor = await requireActor(event,);
    /**
     * Repo row identified by owner login + repo name.
     */
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
    /**
     * Untyped request body cast to the expected payload shape.
     */
    const payload = await event.req
      .json() as CreateIssuePayload;
    /**
     * Validated title; empty triggers a 400.
     */
    const title = ((typeof payload.title) === 'string') ? payload.title : '';
    if (title === '') {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing title',
      },);
    }
    /**
     * Optional issue body; defaults to empty string.
     */
    const issueBody = ((typeof payload.body) === 'string') ? payload.body : '';
    /**
     * Optional client-supplied number; defaults to current ms epoch.
     */
    const number = ((typeof payload.number) === 'number')
      ? payload.number
      : Date.now();
    /**
     * Synthesised issue id used as primary key.
     */
    const issueId = `i-${owner}-${repoName}-${String(number,)}`;
    /**
     * Creation timestamp shared by the row and the emitted event.
     */
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
    /**
     * Owner login segment of the route path.
     */
    const owner = requireParam({
      params: event.context
        .params,
      name: 'owner',
    },);
    /**
     * Repo name segment of the route path.
     */
    const repoName = requireParam({
      params: event.context
        .params,
      name: 'repo',
    },);
    /**
     * Raw issue number from the URL; parsed below.
     */
    const numberRaw = requireParam({
      params: event.context
        .params,
      name: 'number',
    },);
    /**
     * Parsed issue number for the lookup below.
     */
    const number = Number.parseInt(
      numberRaw,
      DECIMAL_RADIX,
    );
    /**
     * Authenticated actor authoring the new comment.
     */
    const actor = await requireActor(event,);
    /**
     * Repo row identified by owner login + repo name.
     */
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
    /**
     * Issue row identified by repo id + number.
     */
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
    /**
     * Untyped request body cast to the expected payload shape.
     */
    const payload = await event.req
      .json() as CreateCommentPayload;
    /**
     * Validated body; empty triggers a 400.
     */
    const body = ((typeof payload.body) === 'string') ? payload.body : '';
    if (body === '') {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing body',
      },);
    }
    /**
     * Creation timestamp shared by the row and the emitted event.
     */
    const now = Date.now();
    /**
     * Synthesised comment id; includes timestamp for uniqueness.
     */
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
    /**
     * Owner login segment of the route path.
     */
    const owner = requireParam({
      params: event.context
        .params,
      name: 'owner',
    },);
    /**
     * Repo name segment of the route path.
     */
    const repoName = requireParam({
      params: event.context
        .params,
      name: 'repo',
    },);
    /**
     * Raw issue number from the URL; parsed below.
     */
    const numberRaw = requireParam({
      params: event.context
        .params,
      name: 'number',
    },);
    /**
     * Label id segment of the route path.
     */
    const labelId = requireParam({
      params: event.context
        .params,
      name: 'label',
    },);
    /**
     * Parsed issue number for the lookup below.
     */
    const number = Number.parseInt(
      numberRaw,
      DECIMAL_RADIX,
    );
    await requireActor(event,);
    /**
     * Repo row identified by owner login + repo name.
     */
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
    /**
     * Issue row identified by repo id + number.
     */
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
    /**
     * Label row; missing triggers a 404.
     */
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
