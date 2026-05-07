/**
 * Barrel re-export for all Phase 1 route handlers.
 *
 * Routes:
 *
 * - `GET /:owner/:repo/issues/:number` -- issue detail page (fragment from storage)
 * - `GET /:owner/:repo/issues` -- filter list (fragment from storage)
 * - `GET /_fragments/...` -- raw fragment passthrough
 * - `POST /api/repos/:owner/:repo/issues` -- create issue
 * - `POST /api/repos/:owner/:repo/issues/:number/comments` -- add comment
 * - `POST /api/repos/:owner/:repo/issues/:number/labels/:label` -- attach label
 *
 * Auth in Phase 1 is a single `X-Forge-User: <login>` header. The user
 * must already exist (the seed CLI creates the demo set).
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

export {
  provisionRepo,
  provisionUser,
  type ProvisionRepoRow,
  type ProvisionUserRow,
} from './routes/provisioning.ts';
