/**
 * Better Auth route handler.
 *
 * Forwards every request under `/api/auth/**` through the Better Auth
 * instance's `handler(request)` function, which internally dispatches
 * to sign-up, sign-in, sign-out, session, OAuth, username plugin, and
 * verification routes.
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
} from 'h3';

import { auth, } from '../../lib/auth.ts';

/**
 * Handles `ALL /api/auth/**` by passing the underlying Web Request to
 * Better Auth's combined route table.
 *
 * @example
 * ```ts
 * app.all('/api/auth/**', authHandler);
 * ```
 */
export const authHandler: EventHandlerWithFetch = defineHandler(
  async function handleAuth(event,) {
    return await auth.handler(event.req,);
  },
);
