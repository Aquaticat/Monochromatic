# Phase 2 status

Phase 2 of the plan at `~/.claude/plans/let-s-put-our-effort-valiant-hopper.md`
is largely complete. This file tracks what shipped, what remains, and the
constraints around the remaining work.

## What shipped

### Forge surface (queries, fragments, dispatcher, storage, stress)

- Phase 2 schema (`orgs`, `repo_members`, `milestones`, `issue_assignees`,
  `issue_milestone`, `prs`, `reviews`, `mention_index`) and queries.
- Fragment renderers for the four issue/PR surfaces: `pr-detail`,
  `review-thread`, `merge-status`, `comment`. Each pure, with XSS escape
  and dispatcher tests.
- Dependency-graph extensions for `pr.opened`, `pr.merged`, `pr.closed`,
  `review.submitted`, `push`, and the standalone `comment.created` fragment.
- Dispatcher event-kind expansion plus `commentId` payload extraction so the
  standalone-comment branch is wired end-to-end.
- S3 storage adapter (`aws4fetch`) implementing the `Storage` interface;
  round-trip tested against an in-process fake fetch client.
- Garage Dockerfile + auto-init entrypoint + `prepare:garage` mise task.
- Seed extension (`generate-phase2.ts`, `generate-phase2-prs.ts`,
  `generate-phase2-helpers.ts`) covering milestones, PRs, reviews, assignees,
  members.
- Stress scenarios `wide-service` (single-writer over many sparse repos) and
  `force-push` (commit `feece259`).

### Git smart-HTTP protocol (commit `41869e43`)

The protocol layer ships in `src/git/`:

- `pkt-line.ts`: pkt-line frame encode/decode.
- `pack-protocol.ts` + `pack-protocol-writers.ts`: vendored
  `parseUploadPackBody`, `parseReceivePackBody`,
  `writeUploadPackResponse`, `writeReceivePackResponse`.
- `iso-server.ts`, `iso-server-refs.ts`, `iso-server-walk.ts`,
  `iso-server-advertisement.ts`: ref read/write, pack assembly from the
  isomorphic-git object store, pack apply on receive.
- `lib/git-config.ts`: `WEBAPP_FORGE_GITDIR_ROOT` env helper; default
  is a per-process scratch dir under `os.tmpdir()`.
- Routes: `info/refs`, `git-upload-pack`, `git-receive-pack` mounted in
  `src/server/routes/git.ts`.
- `isomorphic-git` added to the catalog at the same commit (avoids the
  dead-dep noise the spike doc warned about).

Real-CLI verification (`server/src/server/routes/git.cli.unit.test.ts`)
spawns `/usr/bin/git` against a `serve()`-bound port and exercises the
plan's three scenarios end-to-end:

- Tiny-file clone roundtrip (push then clone elsewhere, contents diff).
- 5 MiB binary blob roundtrip (byte-for-byte equality after pack apply).
- 100-ref batched push (single `git push --all`, verified via
  `git ls-remote`).

The test surfaced one protocol bug that in-process `app.fetch()` could
not catch: `writeReceivePackResponse` advertised `side-band-64k` in
the receive-pack capabilities advertisement but emitted the report
unwrapped, which the system git CLI rejected with
`send-pack: protocol error: bad band #117`. Fix wraps the
`unpack ok` / `ok <ref>` report on sideband channel 1 when the client
negotiated `side-band` or `side-band-64k`, and an outer flush-pkt
terminates the stream.

### Better Auth

- Migration `0003_better_auth.sql` adds `user`, `session`, `account`, and
  `verification` tables (with username plugin columns on `user`).
- `lib/auth.ts` constructs the Better Auth instance against the same
  SQLite file via the Kysely libsql dialect; `routes/auth.ts` mounts the
  combined auth route table at `ALL /api/auth/**`.
- Plugins wired: `username()` only. Email/password is enabled via the
  base config (`emailAndPassword.enabled = true`).
- Migration `0004_drop_users.sql` performs the destructive cutover: drops
  every legacy table referencing `users(id)` and recreates them with
  `REFERENCES user(id)`. Guarded in `data/db.ts` by inspecting `repos.sql`
  for the post-cutover FK signature so it runs at most once per database.
- Queries in `data/queries/user-repo.ts` and `data/queries/membership.ts`
  read from the Better Auth `user` table. SELECT aliases `username AS
  login`; the `User` row converts `createdAt` ISO strings to ms epoch in
  JS so the shape stays numeric and renderers do not change. `insertUser`
  writes synthesised `name`, `email`, `emailVerified=0`, `username`,
  `displayUsername`, and ISO `createdAt`/`updatedAt`.
- Session middleware: `requireActor` resolves the actor from
  `auth.api.getSession({ headers })`. The legacy `X-Forge-User: <login>`
  header is honoured as a non-production fallback so seed-driven smoke
  tests keep working; production (`NODE_ENV === 'production'`) ignores
  it and a missing session yields 401.
- `/api/me/delta?path=...` per-viewer JSON delta. Returns
  `{ actor, path, authored: { issues, comments }, permissions: { canClose, canLabel } }`.
  Recognises `/owner/repo/issues/N` and `/owner/repo/issues` paths;
  other paths receive an empty payload so the contract stays stable.
  Permissions are derived from `repo_members.role` (write roles:
  `owner`, `maintainer`); a repo owner identified by
  `repos.owner_id == actor.id` is also treated as a writer regardless
  of whether they hold an explicit `repo_members` row (commit
  `eceaa259`).

The `as unknown as Auth` cast in `lib/auth.ts` is required because
Better Auth's deeply-inferred `Auth<TConfig>` is structurally a subtype
of the public `Auth` interface but its plugin tuple is invariant under
`isolatedDeclarations`. Documented inline.

End-to-end verified inside a podman container: sign-up, sign-in by
email, and sign-in by username all return 200 with valid tokens.

## What remains

### Git object fragments (file tree, blob, diff)

The plan calls for `file-tree`, `blob`, and `diff` fragment renderers
alongside the four that shipped. None exist yet; only their fragment-key
encoders (`fileTreeKey`, `blobKey`, `diffKey` in
`worker/fragment-keys.ts:174,195,216`) are in place. Implementation is
mechanical now that `iso-server.ts` exists: the renderers read git
objects via the iso-server primitives and produce JSX the same way the
issue/PR fragments do.

### Magic-link auth

The plan lists "Better Auth: email/password, sessions, magic links":
email/password and sessions ship; the magic-link plugin is not wired.
Adding it is `import { magicLink } from 'better-auth/plugins'` plus a
`sendMagicLink` callback (transport TBD: SMTP / SES / log-only for dev).

### Known follow-up (not blocking)

- The dev-only `X-Forge-User` escape exists in `routes/helpers.ts` and
  `routes/me.ts`. Once tests are migrated to use Better Auth sessions,
  the fallback can be removed.

## Verification snapshot

Lint clean: `mise run //packages/webapp-forge/server:lint:oxlint` and
`:lint:types`, same for `seed` and `stress`.

Tests pass via the new `test:unit` task (commit `16a01b22` fixed the
fanout discovery so `mise run //packages/webapp-forge/<pkg>:test`
actually executes the suite):

```text
- server: 19 unit-test files / 105 PASS / 0 FAIL
- seed:   1  unit-test file  / 6   PASS / 0 FAIL
- stress: 0  unit-test files (CLI scenarios only)
```

Server coverage spans storage adapters (memory + S3 fake), write-buffer
contracts, dispatcher Phase 1 + Phase 2, dependency-graph map, all six
issue/PR fragment renderers (XSS + structure), Phase 2 queries (orgs,
membership, milestones, PRs, reviews, mentions), the deterministic RNG,
the git smart-HTTP wire framing (pkt-line, pack-protocol, iso-server,
routes) and the real-CLI roundtrip suite, and provisioning helpers.
