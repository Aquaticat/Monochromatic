# HANDOVER.lint-sweep

State of the workspace-wide lint sweep that was running when context approached compaction. Resume from here after compact.

## Overall task

User: "Many many lint issues in this repo. (`mise run lint`) Identify which ones you can fix w/o me in the loop, then write those needing me in an AUDIT.*.md file and fix those not needing me by using `spawn-claude`. Max 16 children in flight at a time."

Approach: per-package fan-out using `spawn-claude` to launch child Claude Code sessions; each child fixes one package's lint sweep and commits via `git add ... && git commit -o ...`. AUDIT.lint-2026-05-14.md captures policy decisions.

## Policy decisions (locked in, captured in `/var/home/user/Monochromatic/AUDIT.lint-2026-05-14.md`)

| Rule | Decision |
|----|----|
| 1900× `stylistic(no-mixed-operators)` | Mechanically wrap in parens, workspace-wide |
| `tsdoc(require-example)` | Write good realistic examples (no foo/bar placeholders) |
| `eslint(no-magic-numbers)` time/byte math | Import from `@monochromatic-dev/module-numeric-const` (MS_PER_DAY, BYTES_PER_KIB, etc.) |
| `no-restricted-syntax(require-destructured-params)` | Workspace-wide; children update cross-package callers with retry on `.git/index.lock` |

The 21 cross-package require-destructured-params source functions are catalogued at `/tmp/rdp-survey/cross-pkg.txt`.

## Commits landed (in order, most recent first)

```
9598fea8 docs(audit): finalize policy table after user directives
ec6a3af1 fix(mcp/nvim): lint sweep
d23d5bdb fix(typeface/aquaticat): lint sweep
f449b02e fix(module/or-throw): lint sweep
3c399391 fix(pi/morph-compact): lint sweep
c5541b33 fix(webapp-productivity/done-postcss): lint sweep
3eab0233 fix(webapp-content/ssg-test): lint sweep
73847416 fix(cli/terminal-exec): lint sweep
d4a9bb1a fix(webapp-productivity/done): lint sweep
3bf1d50a fix(dev-script/inference-canary-viewer): lint sweep
0cfd9c36 fix(desktop-daemon/editord): lint sweep
2f7bfc9d fix(webapp-productivity/doodle-widget): lint sweep
4572f027 fix(dev-script/task-util): lint sweep
a2ed3d94 fix(build-tool/css): lint sweep
e2484d8f fix(config/oxlint-no-restricted-syntax): lint sweep
9aa7a2cc fix(cli/fy): lint sweep
b39e60ff docs(audit): catalog workspace lint sweep plan (2026-05-14)
a10df401 fix(build-tool/css): migrate from module-es/ts/path to module-fs-path
```

That's 14 lint-sweep commits + 2 docs + 1 prep cascade fix = 17 new commits this session.

## Round 1 outcome (v1+v2 orchestrators, 16 in flight, 1h timeout)

- 14 packages cleanly committed (above).
- 34 packages timed out at the 1h mark.
- Root cause confirmed via transcript inspection: **user's Claude API rate limit ("extra usage") was exhausted at 1:20pm America/New_York** mid-batch. Children launched after the limit got HTTP 429 on their first turn and hung waiting for retry until the orchestrator killed them. Evidence in `/home/user/.claude/projects/-var-home-user-Monochromatic/c247fc74-13f4-4ceb-a9e9-1a901ad7b626.jsonl` (module/test child): `"error":"rate_limit"`, `"apiErrorStatus":429`, `"text":"You're out of extra usage · resets 1:20pm (America/New_York)"`.

Per-package partial-progress is preserved in the working tree (uncommitted). Many big packages made substantial progress before timeout:
- dev-script/deps-cube: 602 → 244 warnings
- module/es: 251 → 43 issues
- webapp-content/messages-demo: 298 issues → 0 warnings 8 errors
- webapp-edu/paper2vn: 280 → 103 issues
- webapp-forge/server: 158 → 0 warnings 4 errors
- pi/auto-mode: 148 → 5 warnings 6 type errors

Full final-status report: `/tmp/lint-orchestrator/final-status.md`.

## Round 2 (v3 orchestrator) — COMPLETE

- Launched 19:58:51 UTC (15:58:51 local) with v3 orchestrator (`/tmp/lint-orchestrator/run-v3.sh`).
- `MAX_CONCURRENT=4`, `CHILD_TIMEOUT_SEC=5400`.
- 35-package queue, all 35 reached terminal state by 21:46:44 UTC (17:46:44 local).
- ALL DONE at 21:46:44 UTC. Zero timeouts in round 2.
- One BLOCKED reason: `dev-script/inference-canary-viewer` was already clean from inherited partial work — child correctly committed nothing and reported BLOCKED.

Prompt template at `/tmp/lint-orchestrator/prompt.txt` was updated to handle inherited partial state from killed children:
- "Run a fresh `mise run //packages/{PKG}:lint` to get CURRENT state. Cached output is stale."
- "Treat any uncommitted modifications under packages/{PKG}/ as inherited work from your predecessor."
- Race-safe commit: `git add <paths> && git commit -o <paths>` (the `-o` flag commits only listed paths, ignoring sibling staged work).

## Final state (2026-05-14T21:47Z)

- **48 / 48 packages clean** per `/tmp/lint-orchestrator/final-status.md`. Zero dirty.
- **44 commits this session.**
- Across both rounds + the cascade prep + the smoke test, every package that started the day with lint or type issues now passes `mise run //packages/<pkg>:lint`.

## After resume from compact

The lint sweep is done. Likely next steps:

1. Confirm `final-status.md` shows 48 clean / 0 dirty.
2. Optionally run `mise run lint` at the root to verify end-to-end with the workspace task graph (note the AGENTS.md caveat that this can stop halfway if any single package errors; per-package was authoritative).
3. Tell the user the sweep finished and point them at the per-package commits for review. The commit messages are detailed enough that they can scan `git log --oneline | head -50`.
4. Consider a follow-up: add a CI gate that blocks PRs that increase the workspace warning count, so this backlog doesn't accumulate again.

## Key file locations (persist across compact)

- `/var/home/user/Monochromatic/AUDIT.lint-2026-05-14.md` — committed
- `/var/home/user/Monochromatic/HANDOVER.lint-sweep.md` — this doc
- `/tmp/lint-orchestrator/` — orchestrator state, queue, scripts, logs (ephemeral; survives this session)
- `/tmp/lint-orchestrator/run-v3.sh` — current orchestrator
- `/tmp/lint-orchestrator/prompt.txt` — child-prompt template
- `/tmp/lint-orchestrator/queue.txt` — round-2 queue (consumed as children launch)
- `/tmp/lint-orchestrator/progress.log` — append-only event log
- `/tmp/lint-orchestrator/done/*.spawnid` — completed children (rename from `active/`)
- `/tmp/lint-orchestrator/timeout/*.spawnid` — killed-on-timeout children
- `/tmp/lint-orchestrator/final-status.md` — final per-package lint state
- `/tmp/lint-all-pkgs/*.out` — pre-round-1 lint outputs (stale; children should re-run lint)
- `/tmp/rdp-survey/{cross-pkg,internal-only}.txt` — require-destructured-params survey
- `~/.claude/spawn-results/spawns/{spawnId}.{json,reported}` — child spawn state files

## Operational notes for the resumed session

- Spawn-claude flags: nothing extra (no `--print`, no `--dangerously-skip-permissions`). Auto mode is the workspace default permission mode.
- Each child opens a real ghostty terminal via `terminal-exec`. They auto-close when claude exits but not when killed by the orchestrator.
- The `kill_child` function in run-v3.sh greps `/proc/<pid>/environ` for `CLAUDE_SPAWN_ID=<id>` to find the process tree and kills it.
- Children commit only their own package via `git commit -o <paths>` (the `-o` flag is essential — without it parallel commits race on the index).
- If new packages need running, append to `/tmp/lint-orchestrator/queue.txt` while orchestrator is alive — it picks up new entries on its next refill loop.
- General-purpose agents are banned (per CLAUDE.md / AGENTS.md). Use spawn-claude.
