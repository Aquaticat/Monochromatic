/**
 * Read-side route handlers.
 *
 * - `GET /:owner/:repo/issues/:number`: issue detail page
 * - `GET /:owner/:repo/issues`: filter list
 * - `GET /_fragments/...`: raw fragment passthrough
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  HTTPError,
} from 'h3';

import {
  getIssueByNumber,
  getRepoByOwnerLogin,
} from '../../data/queries.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
} from '../../lib/http.ts';
import {
  ANY_LABEL,
  filterListKey,
  issueDetailKey,
} from '../../worker/fragment-keys.ts';
import { storage, } from '../runtime.ts';
import {
  DECIMAL_RADIX,
  parseStateFacet,
  requireParam,
} from './helpers.ts';

/** Standard headers attached to every fragment response. */
const HTML_FRAGMENT_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-cache',
} as const;

/**
 * `GET /:owner/:repo/issues/:number`: serves the issue-detail fragment
 * straight from the storage adapter. Returns 500 if the fragment has
 * not been built yet (a sign the dispatcher missed the event).
 */
export const issueDetailHandler: EventHandlerWithFetch = defineHandler(
  async function handleIssueDetail(event,) {
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
    if (!Number.isFinite(number,) || number <= 0) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid issue number',
      },);
    }
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
    const body = await storage.get(issueDetailKey({
      repoId: repo.id,
      issueId: issue.id,
    },),);
    if (body === undefined) {
      throw new HTTPError({
        status: HTTP_INTERNAL_SERVER_ERROR,
        message: 'fragment not built yet',
      },);
    }
    return new Response(
      new TextDecoder().decode(body,),
      { headers: HTML_FRAGMENT_HEADERS, },
    );
  },
);

/**
 * `GET /:owner/:repo/issues[?label=...&state=...]`: serves the
 * filter-list fragment. Returns 500 when the fragment has not been
 * built yet.
 */
export const filterListHandler: EventHandlerWithFetch = defineHandler(
  async function handleFilterList(event,) {
    const owner = requireParam(
      event.context.params,
      'owner',
    );
    const repoName = requireParam(
      event.context.params,
      'repo',
    );
    const url = new URL(event.req.url,);
    const labelParam = url.searchParams.get('label',);
    const stateParam = url.searchParams.get('state',) ?? 'open';
    const stateFacet = parseStateFacet(stateParam,);
    if (stateFacet === null) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: `invalid state: ${stateParam}`,
      },);
    }
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
    const labelId = labelParam ?? ANY_LABEL;
    const body = await storage.get(filterListKey({
      repoId: repo.id,
      labelId,
      state: stateFacet,
    },),);
    if (body === undefined) {
      throw new HTTPError({
        status: HTTP_INTERNAL_SERVER_ERROR,
        message: 'filter fragment not built yet',
      },);
    }
    return new Response(
      new TextDecoder().decode(body,),
      { headers: HTML_FRAGMENT_HEADERS, },
    );
  },
);

/**
 * `GET /_fragments/...`: raw fragment passthrough; lets clients fetch
 * any fragment by storage key. Treats anything under the prefix as a
 * literal storage key.
 */
export const rawFragmentHandler: EventHandlerWithFetch = defineHandler(
  async function handleRawFragment(event,) {
    const url = new URL(event.req.url,);
    const path = url.pathname.replace(
      /^\/_fragments\//,
      '',
    );
    if (path === '') {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing fragment key',
      },);
    }
    const body = await storage.get(path,);
    if (body === undefined) {
      throw new HTTPError({
        status: HTTP_NOT_FOUND,
        message: 'fragment not found',
      },);
    }
    return new Response(
      new TextDecoder().decode(body,),
      { headers: HTML_FRAGMENT_HEADERS, },
    );
  },
);
