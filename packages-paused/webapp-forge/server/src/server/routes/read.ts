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

/**
 * Standard headers attached to every fragment response.
 */
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
     * Parsed issue number; non-finite or non-positive triggers a 400.
     */
    const number = Number.parseInt(
      numberRaw,
      DECIMAL_RADIX,
    );
    if ((!Number.isFinite(number,)) || (number <= 0)) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'invalid issue number',
      },);
    }
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
     * Rendered fragment body bytes; missing means dispatcher hasn't built it.
     */
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
     * Request URL parsed once so query params are reachable below.
     */
    const url = new URL(event.req
      .url,);
    /**
     * `?label=...` query param; null means "any label".
     */
    const labelParam = url.searchParams
      .get('label',);
    /**
     * `?state=...` query param; defaults to `'open'`.
     */
    const stateParam = url.searchParams
      .get('state',)
      ?? 'open';
    /**
     * Validated state facet; null triggers a 400.
     */
    const stateFacet = parseStateFacet(stateParam,);
    if (stateFacet === null) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: `invalid state: ${stateParam}`,
      },);
    }
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
     * Effective label id; `null` query param means `ANY_LABEL` sentinel.
     */
    const labelId = labelParam ?? ANY_LABEL;
    /**
     * Rendered fragment body bytes; missing means dispatcher hasn't built it.
     */
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
    /**
     * Request URL parsed once so pathname is reachable below.
     */
    const url = new URL(event.req
      .url,);
    /* oxlint-disable no-restricted-syntax/no-regex -- Anchored literal-prefix strip on a bounded request pathname; one-shot match, no quantifier means linear time. */
    /**
     * Path under `/_fragments/`, treated as a literal storage key.
     */
    const path = url.pathname
      .replace(
      /^\/_fragments\//u,
      '',
    );
    /* oxlint-enable no-restricted-syntax/no-regex */
    if (path === '') {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing fragment key',
      },);
    }
    /**
     * Stored fragment bytes; missing yields 404.
     */
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
