/**
 * Barrel re-export for route handlers.
 *
 * Routes:
 *
 * - `GET /:owner/:repo/issues/:number`: issue detail page (fragment from storage)
 * - `GET /:owner/:repo/issues`: filter list (fragment from storage)
 * - `GET /_fragments/...`: raw fragment passthrough
 * - `POST /api/repos/:owner/:repo/issues`: create issue
 * - `POST /api/repos/:owner/:repo/issues/:number/comments`: add comment
 * - `POST /api/repos/:owner/:repo/issues/:number/labels/:label`: attach label
 * - `ALL  /api/auth/**`: Better Auth handler (sign-up, sign-in, sessions)
 * - `GET  /api/me/delta?path=...`: per-viewer JSON delta overlay
 *
 * Write routes resolve the actor from a Better Auth session
 * (`auth.api.getSession`); in non-production environments a legacy
 * `X-Forge-User: <login>` header is honoured as a fallback so seed-driven
 * smoke tests keep working without first signing in. Production ignores
 * the header escape; missing session yields 401.
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

export { meDeltaHandler, } from './routes/me.ts';

export {
  provisionRepo,
  type ProvisionRepoRow,
  provisionUser,
  type ProvisionUserRow,
} from './routes/provisioning.ts';
