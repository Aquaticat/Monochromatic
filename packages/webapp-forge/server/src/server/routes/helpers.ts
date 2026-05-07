/**
 * Shared helpers used by every Phase 1 route handler.
 *
 * Auth in Phase 1 is a single `X-Forge-User: <login>` header. The user
 * must already exist (the seed CLI creates the demo set).
 */

import { HTTPError, } from 'h3';

import { getUserByLogin, } from '../../data/queries.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_UNAUTHORIZED,
} from '../../lib/http.ts';
import { dispatchAndFlush, } from '../dispatch-and-flush.ts';
import {
  getEventCursor,
  setEventCursor,
  storage,
  writeBuffer,
} from '../runtime.ts';
import type { IssueStateFacet, } from '../../worker/fragment-keys.ts';

/**
 * Reads a route param or throws a 400 when missing.
 *
 * @param params - h3 route parameter record
 *
 * @param name - parameter name to extract
 *
 * @returns parameter value (always non-empty)
 *
 * @example
 * ```ts
 * const owner = requireParam(event.context.params, 'owner');
 * ```
 */
export function requireParam(
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

/**
 * Minimal subset of the h3 event used by {@link requireActor}.
 */
export type ActorEvent = {
  req: {
    headers: Headers;
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
 * Reads the `X-Forge-User` header or throws a 401.
 *
 * @param event - h3 event whose request headers carry the actor login
 *
 * @returns resolved actor identity
 *
 * @example
 * ```ts
 * const actor = await requireActor(event);
 * ```
 */
export async function requireActor(event: ActorEvent,): Promise<Actor> {
  const login = event.req.headers.get('x-forge-user',);
  if (login === null || login === '') {
    throw new HTTPError({
      status: HTTP_UNAUTHORIZED,
      message: 'missing X-Forge-User header',
    },);
  }
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
  if (raw === 'open' || raw === 'closed')
    return raw;
  return null;
}

/** Decimal radix used by `parseInt` calls inside route handlers. */
export const DECIMAL_RADIX = 10;
