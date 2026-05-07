# Phase 2 deferred work

Phase 2 of the plan at `~/.claude/plans/let-s-put-our-effort-valiant-hopper.md`
shipped in two parts. This file documents the items that did **not** ship in
the first session and the constraints the next session needs to address.

## What shipped

- Phase 2 schema (`orgs`, `repo_members`, `milestones`, `issue_assignees`,
  `issue_milestone`, `prs`, `reviews`, `mention_index`) and queries; tests
  green, migrations applied at boot.
- S3 storage adapter (`aws4fetch`) implementing the `Storage` interface; round-trip
  tested against an in-process fake fetch client.
- Phase 2 fragment renderers (`pr-detail`, `review-thread`, `merge-status`,
  `comment`); each pure, with XSS escape and dispatcher tests.
- Dependency-graph extensions for `pr.opened`, `pr.merged`, `pr.closed`,
  `review.submitted`, `push`, and the standalone `comment.created` fragment.
- Dispatcher event-kind expansion plus `commentId` payload extraction so the
  standalone-comment branch is wired end-to-end.
- Garage Dockerfile + auto-init entrypoint + `prepare:garage` mise task.
- Seed extension (`generate-phase2.ts`, `generate-phase2-prs.ts`,
  `generate-phase2-helpers.ts`) covering milestones, PRs, reviews, assignees,
  members.
- `wide-service` stress scenario (single-writer over many sparse repos).

## What did not ship

### Git smart-HTTP protocol (task #16)

Spike findings live in `packages/webapp-forge/server/TROUBLESHOOTING.isomorphic-git.md`.
The spike confirmed isomorphic-git ships everything except sideband `mux`,
`parseReceivePackRequest`, `writeReceivePackResponse`, and
`writeUploadPackResponse` -- roughly 150 LOC of vendored wire code.

The next session needs:

1. Decide the filesystem strategy. The spike doc lists two viable options
   (real local scratch dir vs libSQL-backed virtual fs); the choice is currently
   listed as "decision pending."
2. Pick a default for `WEBAPP_FORGE_GITDIR_ROOT` and add the env-read helper
   (e.g. `lib/git-config.ts`) before writing any pack-protocol code.
3. Implement the four vendored wire helpers in `src/git/pack-protocol.ts`.
4. Implement `iso-server.ts` (ref read/write, pack assembly from object store, pack
   apply on receive) backed by isomorphic-git's `_pack`, `_readObject`, `_writeObject`,
   `GitRefManager`, and `GitPackIndex.fromPack` primitives.
5. Add the three routes: `info/refs`, `git-upload-pack`, `git-receive-pack`.
6. Add an integration test that runs `git clone http://localhost:3000/x/y.git` and
   `git push` against a freshly seeded repo. The plan's verification step calls
   for round-tripping a 5 MB binary blob and a 100-ref batched push, so include
   those.
7. Add `isomorphic-git` to the catalog (deferred this session because dead deps
   are noise; add it at the same commit as the protocol implementation).

The git fragments (`file-tree`, `blob`, `diff`) ride on this work because their
source data is git objects. Their fragment-key encoders are already in place
(`fileTreeKey`, `blobKey`, `diffKey` in `worker/fragment-keys.ts`) so adding
the renderers is mechanical once `iso-server.ts` exists.

### Better Auth (task #15)

The plan calls for Better Auth as the source of truth for users and sessions
with our `repos.owner_id` joined to its `user.id`. The schema reconciliation is
an open user-decision: drop our `users(id, login, email, password_hash, created_at)`
in favour of Better Auth's, extend ours and join, or run a bridge table.

Next session steps:

1. Surface the schema-reconciliation question to the user (it is a design
   preference, not a measurable fact).
2. Add `better-auth` to the catalog when the implementation lands (deferred for
   the same dead-deps reason as `isomorphic-git`).
3. Apply Better Auth's migrations alongside `0002_phase2.sql` (its own file --
   per the advisor's checkpoint discipline rule, do not co-mingle with our
   schema additions).
4. Wire route middleware to enforce session checks and add a per-user JSON
   delta endpoint (`/api/me/delta?path=...`).

### `force-push` stress scenario (task #18 partial)

Depends on the git protocol. The scenario asserts "only affected blob/diff
fragments rebuild" after a force-push event; without git, we cannot generate the
push event with realistic blob set. Land it together with task #16.

## Verification of what shipped

`mise run //packages/webapp-forge/server:lint:oxlint` (and `:lint:types`),
same for `seed` and `stress`: all clean.

15 unit-test files pass with 76 total cases:

```text
- server:    9 files / 53 tests
- seed:      1 file  /  6 tests
- stress:    --      / scenarios run via CLI

Includes: storage adapter round-trips (memory + S3 fake), write-buffer
contracts, dispatcher Phase 1 + Phase 2, dependency-graph map, all 6 fragment
renderers (XSS + structure), Phase 2 queries (orgs / membership / milestones /
PRs / reviews / mentions), and the deterministic RNG.
```

Stress runs:

```text
| scenario       | duration ms | events | p50 ms | p99 ms | violations |
| hot-repo       | 1025        | 10     | 2      | 3      | none       |
| bursty-comment | 1007        | 10     | 1      | 2      | none       |
| wide-service   | 1011        | 10     | 1      | 1      | none       |
```

Seed CLI smoke (using Phase 2 resources):

```text
bun packages/webapp-forge/seed/src/cli.ts --repos=2 --users=5 \
    --max-issues-per-repo=3 --seed=7
# users=5 repos=2 labels=8 issues=5 comments=15
# milestones=5 prs=6 reviews=13 assignees=7 members=5
```
