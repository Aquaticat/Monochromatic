/**
 * Shared helpers used by every route handler.
 *
 * Auth resolves the actor from a Better Auth session (`auth.api.getSession`)
 * over the request headers; in non-production environments a legacy
 * `X-Forge-User: <login>` header is honoured as a fallback so seed-driven
 * smoke tests and dev tooling that predate the cutover keep working.
 * Production must use Better Auth: when `NODE_ENV === 'production'` the
 * header escape is ignored and a missing session yields 401.
 */

import { HTTPError, } from 'h3';

import { getUserByLogin, } from '../../data/queries.ts';
import { auth, } from '../../lib/auth.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_UNAUTHORIZED,
} from '../../lib/http.ts';
import type { IssueStateFacet, } from '../../worker/fragment-keys.ts';
import { dispatchAndFlush, } from '../dispatch-and-flush.ts';
import {
  getEventCursor,
  setEventCursor,
  storage,
  writeBuffer,
} from '../runtime.ts';

/**
 * Reads a route param or throws a 400 when missing.
 *
 * @param row - inputs
 *
 * @returns parameter value (always non-empty)
 *
 * @example
 * ```ts
 * const owner = requireParam({ params: event.context.params, name: 'owner' });
 * ```
 */
export function requireParam(row: {
  /**
   * h3 route parameter record.
   */
  readonly params: Readonly<Record<string, string>> | undefined;
  /**
   * Parameter name to extract.
   */
  readonly name: string;
},): string {
  /**
   * Raw param value; missing/empty triggers the 400 below.
   */
  const value = row.params?.[row.name];
  if ((value === undefined) || (value === '')) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: `missing route param: ${row.name}`,
    },);
  }
  return value;
}

/**
 * Minimal subset of the h3 event used by {@link requireActor}.
 */
export type ActorEvent = {
  readonly req: {
    readonly headers: Headers;
  };
};

/**
 * Resolved actor identity returned by {@link requireActor}.
 */
export type Actor = {
  id: string;
  login: string;
};

/**
 * Resolves the actor identity from a Better Auth session, falling back
 * to the legacy `X-Forge-User: <login>` header in non-production
 * environments so seed-driven smoke tests keep working during the
 * cutover.
 *
 * Throws 401 when no session is present and the dev-only header escape
 * is unavailable (production) or unset.
 *
 * @param event - h3 event whose request carries auth headers
 *
 * @returns resolved actor identity
 *
 * @example
 * ```ts
 * const actor = await requireActor(event);
 * ```
 */
export async function requireActor(event: ActorEvent,): Promise<Actor> {
  /**
   * Active Better Auth session, when one is present on the request.
   */
  const session = await auth.api
    .getSession({ headers: event.req
      .headers, },);
  if (session !== null) {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- Better Auth's session.user shape includes the username plugin's optional `username` field, which the framework's typed surface omits at this entry point */
    /**
     * Username from the Better Auth session, when the username plugin is configured.
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
    === 'production') {
    throw new HTTPError({
      status: HTTP_UNAUTHORIZED,
      message: 'no session',
    },);
  }
  /**
   * Dev-only login from the legacy header; missing triggers the 401 below.
   */
  const login = event.req
    .headers
    .get('x-forge-user',);
  if ((login === null) || (login === '')) {
    throw new HTTPError({
      status: HTTP_UNAUTHORIZED,
      message: 'no session and missing X-Forge-User dev header',
    },);
  }
  /**
   * Resolved user row keyed by login; missing triggers the 401 below.
   */
  const user = await getUserByLogin(login,);
  if (user === undefined) {
    throw new HTTPError({
      status: HTTP_UNAUTHORIZED,
      message: `unknown user: ${login}`,
    },);
  }
  return {
    id: user.id,
    login: user.login,
  };
}

/**
 * Drains every event newer than the in-memory cursor and flushes the
 * write buffer. Called after every successful write so the read path
 * sees the rebuilt fragment immediately.
 *
 * @example
 * ```ts
 * await runDispatch();
 * ```
 */
export async function runDispatch(): Promise<void> {
  /**
   * New event-id high-water mark returned after the drain completes.
   */
  const cursor = await dispatchAndFlush({
    afterEventId: getEventCursor(),
    storage,
    writeBuffer,
  },);
  setEventCursor(cursor,);
}

/**
 * Maps a state-facet string to the typed facet.
 *
 * @param raw - input from the query string
 *
 * @returns typed facet, or `null` for invalid input
 *
 * @example
 * ```ts
 * parseStateFacet('open'); // 'open'
 * parseStateFacet('done'); // null
 * ```
 */
export function parseStateFacet(raw: string,): IssueStateFacet | null {
  if ((raw === 'open') || (raw === 'closed'))
    return raw;
  return null;
}

/**
 * Decimal radix used by `parseInt` calls inside route handlers.
 */
export const DECIMAL_RADIX = 10;
