/**
 * Barrel re-export for route handlers.
 *
 * Routes:
 *
 * - `GET /:owner/:repo/issues/:number` -- issue detail page (fragment from storage)
 * - `GET /:owner/:repo/issues` -- filter list (fragment from storage)
 * - `GET /_fragments/...` -- raw fragment passthrough
 * - `POST /api/repos/:owner/:repo/issues` -- create issue
 * - `POST /api/repos/:owner/:repo/issues/:number/comments` -- add comment
 * - `POST /api/repos/:owner/:repo/issues/:number/labels/:label` -- attach label
 * - `ALL  /api/auth/**` -- Better Auth handler (sign-up, sign-in, sessions)
 *
 * Phase 1's `X-Forge-User: <login>` header is still honoured for unauthenticated
 * write paths so the existing seed + tests stay green; Better Auth becomes the
 * source of truth once the queries and seed cut over to the new schema.
 */

export {
  filterListHandler,
  issueDetailHandler,
  rawFragmentHandler,
} from './routes/read.ts';

export {
  createCommentHandler,
  createIssueHandler,
  labelIssueHandler,
} from './routes/write.ts';

export {
  gitInfoRefsHandler,
  gitReceivePackHandler,
  gitUploadPackHandler,
} from './routes/git.ts';

export { authHandler, } from './routes/auth.ts';

export {
  provisionRepo,
  provisionUser,
  type ProvisionRepoRow,
  type ProvisionUserRow,
} from './routes/provisioning.ts';
