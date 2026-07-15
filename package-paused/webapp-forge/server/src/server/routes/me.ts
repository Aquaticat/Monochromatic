/**
 * Per-viewer JSON delta endpoint.
 *
 * Returns the user-specific overlay for a path so the prebuilt fragment
 * (cached in storage, equal across viewers) can be augmented client-side
 * with information that only matters to the signed-in actor: which items
 * they authored on the page, and which actions are allowed for them.
 *
 * This satisfies the per-user variation requirement from the plan
 * (which buttons are visible, comments I authored). Reactions are
 * deferred to Phase 3 when the schema gains a reactions table.
 *
 * Path shapes recognised (anything else falls through to an empty
 * payload so the route stays a stable API contract):
 *
 * - `/owner/repo/issues/N`: single issue + its comments
 * - `/owner/repo/issues`: filter list (permissions only; authored
 *   lookup is skipped because it would scan the whole repo)
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  HTTPError,
} from 'h3';

import {
  getIssueByNumber,
  getRepoByOwnerLogin,
  getRepoMember,
  getUserByLogin,
  listComments,
} from '../../data/queries.ts';
import { auth, } from '../../lib/auth.ts';
import { HTTP_BAD_REQUEST, } from '../../lib/http.ts';

/**
 * Standard headers attached to every JSON delta response.
 */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store',
} as const;

/**
 * Roles in `repo_members` that grant write-action permissions on a
 * repo. Repo owners (matched via `repos.owner_id`) are also treated as
 * writers regardless of whether they hold an explicit membership row.
 */
const WRITE_ROLES = new Set<string>([
  'owner',
  'maintainer',
],);

/**
 * Decimal radix for {@link Number.parseInt} calls.
 */
const DECIMAL_RADIX = 10;

/**
 * Index of the issue-number capture group in the issue-detail regex.
 */
const ISSUE_NUMBER_CAPTURE_INDEX = 3;

/**
 * Resolved actor identity, or `null` when unauthenticated.
 */
type DeltaActor = {
  readonly id: string;
  readonly login: string;
};

/**
 * Shape of the JSON delta payload returned for any path. Empty
 * `authored` and all-false `permissions` are valid values for paths
 * that the endpoint does not specifically recognise, so consumers can
 * always destructure the same fields.
 */
type DeltaPayload = {
  readonly actor: DeltaActor | null;
  readonly path: string;
  readonly authored: {
    readonly issues: readonly string[];
    readonly comments: readonly string[];
  };
  readonly permissions: {
    readonly canClose: boolean;
    readonly canLabel: boolean;
  };
};

/**
 * Resolves the actor identity from a Better Auth session, falling back
 * to the legacy `X-Forge-User` dev header in non-production environments.
 *
 * Returns `null` when no actor can be determined; the route then ships
 * an unauthenticated payload instead of throwing.
 *
 * @param headers - request headers
 *
 * @returns actor identity or `null`
 */
async function resolveActor(headers: Headers,): Promise<DeltaActor | null> {
  /**
   * Active Better Auth session, when present on the request.
   */
  const session = await auth.api
    .getSession({ headers, },);
  if (session !== null) {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- Better Auth's session.user shape includes the username plugin's optional `username` field */
    /**
     * Optional username from the session (provided by the username plugin).
     */
    const sessionUsername = (session.user as { username?: string | null; }).username;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    return {
      id: session.user
        .id,
      login: sessionUsername
        ?? session
        .user
        .id,
    };
  }
  if (process.env
    .NODE_ENV
    === 'production')
    return null;
  /**
   * Dev-only login from the legacy header; missing returns null.
   */
  const headerLogin = headers.get('x-forge-user',);
  if ((headerLogin === null) || (headerLogin === ''))
    return null;
  /**
   * Resolved user row for the dev header login.
   */
  const fallbackUser = await getUserByLogin(headerLogin,);
  if (fallbackUser === undefined)
    return null;
  return {
    id: fallbackUser.id,
    login: fallbackUser.login,
  };
}

/**
 * Parsed `(owner, repo, kind, number?)` view of a path the delta
 * endpoint understands. Returns `null` for any unsupported shape.
 *
 * @param path - request path
 *
 * @returns parsed components or `null`
 */
function parseDeltaPath(path: string,): {
  readonly owner: string;
  readonly repo: string;
  readonly kind: 'issue-detail' | 'filter-list';
  readonly number: number | null;
} | null {
  /* oxlint-disable no-restricted-syntax/no-regex -- URL path parser; input is a request path bounded by Node URL parsing, anchored with no nested quantifiers so no catastrophic backtracking is possible. */
  /**
   * Issue-detail path match; non-null returns the parsed shape below.
   */
  const issueDetailMatch = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/u.exec(path,);
  /* oxlint-enable no-restricted-syntax/no-regex */
  if (issueDetailMatch !== null) {
    return {
      owner: issueDetailMatch[1]
        ?? '',
      repo: issueDetailMatch[2]
        ?? '',
      kind: 'issue-detail',
      number: Number.parseInt(
        issueDetailMatch[ISSUE_NUMBER_CAPTURE_INDEX]
          ?? '0',
        DECIMAL_RADIX,
      ),
    };
  }
  /* oxlint-disable no-restricted-syntax/no-regex -- URL path parser; input is a request path bounded by Node URL parsing, anchored with no nested quantifiers so no catastrophic backtracking is possible. */
  /**
   * Filter-list path match; non-null returns the parsed shape below.
   */
  const filterListMatch = /^\/([^/]+)\/([^/]+)\/issues\/?$/u.exec(path,);
  /* oxlint-enable no-restricted-syntax/no-regex */
  if (filterListMatch !== null) {
    return {
      owner: filterListMatch[1]
        ?? '',
      repo: filterListMatch[2]
        ?? '',
      kind: 'filter-list',
      number: null,
    };
  }
  return null;
}

/**
 * Builds the issue-detail delta payload for a signed-in actor.
 *
 * Looks up the issue by `(owner, repo, number)`, walks its comments to
 * find ones authored by the actor, and resolves the actor's repo
 * membership so action permissions reflect role.
 *
 * @param row - parsed path + actor
 *
 * @returns payload populated for the issue-detail path
 */
async function buildIssueDetailDelta(row: {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly actor: DeltaActor;
  readonly path: string;
},): Promise<DeltaPayload> {
  /**
   * Repo row identified by owner login + repo name.
   */
  const repo = await getRepoByOwnerLogin({
    ownerLogin: row.owner,
    name: row.repo,
  },);
  if (repo === undefined) {
    return {
      actor: row.actor,
      path: row.path,
      authored: {
        issues: [],
        comments: [],
      },
      permissions: {
        canClose: false,
        canLabel: false,
      },
    };
  }
  /**
   * Issue row identified by repo id + number.
   */
  const issue = await getIssueByNumber({
    repoId: repo.id,
    number: row.number,
  },);
  if (issue === undefined) {
    return {
      actor: row.actor,
      path: row.path,
      authored: {
        issues: [],
        comments: [],
      },
      permissions: {
        canClose: false,
        canLabel: false,
      },
    };
  }
  /**
   * Issue comments scanned below for actor authorship.
   */
  const comments = await listComments(issue.id,);
  /**
   * Ids of comments the actor authored on this issue.
   */
  const authoredCommentIds = comments
    .filter(function isMine(comment,) {
      return comment.author_id
        === row
        .actor
        .id;
    },)
    .map(function pickId(comment,) {
      return comment.id;
    },);
  /**
   * Actor's membership row in this repo; `undefined` for non-members.
   */
  const membership = await getRepoMember({
    repoId: repo.id,
    userId: row.actor
      .id,
  },);
  /**
   * Actor owns the repo; bypasses the role check below.
   */
  const isOwner = repo.owner_id
    === row
    .actor
    .id;
  /**
   * Actor has write permission via ownership or membership role.
   */
  const isWriter = isOwner
    || ((membership !== undefined) && WRITE_ROLES
      .has(membership.role,));
  /**
   * Actor authored the issue; combined with isWriter to compute close permission.
   */
  const isAuthor = issue.author_id
    === row
    .actor
    .id;
  return {
    actor: row.actor,
    path: row.path,
    authored: {
      issues: isAuthor ? [issue.id,] : [],
      comments: authoredCommentIds,
    },
    permissions: {
      canClose: isAuthor || isWriter,
      canLabel: isWriter,
    },
  };
}

/**
 * Builds the filter-list delta payload for a signed-in actor. Skips
 * the authored lookup (would require scanning every issue in the repo
 * for one viewer) and returns membership-derived permissions only.
 *
 * @param row - parsed path + actor
 *
 * @returns payload populated for the filter-list path
 */
async function buildFilterListDelta(row: {
  readonly owner: string;
  readonly repo: string;
  readonly actor: DeltaActor;
  readonly path: string;
},): Promise<DeltaPayload> {
  /**
   * Repo row identified by owner login + repo name.
   */
  const repo = await getRepoByOwnerLogin({
    ownerLogin: row.owner,
    name: row.repo,
  },);
  if (repo === undefined) {
    return {
      actor: row.actor,
      path: row.path,
      authored: {
        issues: [],
        comments: [],
      },
      permissions: {
        canClose: false,
        canLabel: false,
      },
    };
  }
  /**
   * Actor's membership row in this repo; `undefined` for non-members.
   */
  const membership = await getRepoMember({
    repoId: repo.id,
    userId: row.actor
      .id,
  },);
  /**
   * Actor owns the repo; bypasses the role check below.
   */
  const isOwner = repo.owner_id
    === row
    .actor
    .id;
  /**
   * Actor has write permission via ownership or membership role.
   */
  const isWriter = isOwner
    || ((membership !== undefined) && WRITE_ROLES
      .has(membership.role,));
  return {
    actor: row.actor,
    path: row.path,
    authored: {
      issues: [],
      comments: [],
    },
    permissions: {
      canClose: isWriter,
      canLabel: isWriter,
    },
  };
}

/**
 * `GET /api/me/delta?path=/owner/repo/issues/N`: per-viewer JSON
 * overlay for the prebuilt fragment at `path`. Returns
 * `{ actor: null, ... }` for unauthenticated requests so the client
 * always has the same payload shape.
 *
 * @example
 * ```ts
 * app.get('/api/me/delta', meDeltaHandler);
 * ```
 */
export const meDeltaHandler: EventHandlerWithFetch = defineHandler(
  async function handleMeDelta(event,) {
    /**
     * Request URL parsed once so query params are reachable below.
     */
    const url = new URL(event.req
      .url,);
    /**
     * Required `?path=...` query parameter naming the fragment path.
     */
    const path = url.searchParams
      .get('path',);
    if ((path === null) || (path === '')) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing path query parameter',
      },);
    }
    /**
     * Resolved actor; null produces the unauthenticated payload below.
     */
    const actor = await resolveActor(event.req
      .headers,);
    if (actor === null) {
      /**
       * Unauthenticated delta payload returned with a null actor.
       */
      const payload: DeltaPayload = {
        actor: null,
        path,
        authored: {
          issues: [],
          comments: [],
        },
        permissions: {
          canClose: false,
          canLabel: false,
        },
      };
      return Response.json(
        payload,
        { headers: JSON_HEADERS, },
      );
    }
    /**
     * Parsed path components; null for unsupported shapes.
     */
    const parsed = parseDeltaPath(path,);
    if (parsed === null) {
      /**
       * Empty-overlay payload returned for paths the endpoint does not recognise.
       */
      const payload: DeltaPayload = {
        actor,
        path,
        authored: {
          issues: [],
          comments: [],
        },
        permissions: {
          canClose: false,
          canLabel: false,
        },
      };
      return Response.json(
        payload,
        { headers: JSON_HEADERS, },
      );
    }
    if ((parsed.kind
      === 'issue-detail') && (parsed.number
        !== null)) {
      /**
       * Issue-detail delta payload populated from the actor's repo membership.
       */
      const payload = await buildIssueDetailDelta({
        owner: parsed.owner,
        repo: parsed.repo,
        number: parsed.number,
        actor,
        path,
      },);
      return Response.json(
        payload,
        { headers: JSON_HEADERS, },
      );
    }
    /**
     * Filter-list delta payload populated from the actor's repo membership.
     */
    const payload = await buildFilterListDelta({
      owner: parsed.owner,
      repo: parsed.repo,
      actor,
      path,
    },);
    return Response.json(
      payload,
      { headers: JSON_HEADERS, },
    );
  },
);
