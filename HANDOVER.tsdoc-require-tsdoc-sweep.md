# Handover: tsdoc require-tsdoc sweep

## Status (2026-05-14, in progress)

Workspace-wide sweep adding TSDoc on local `const`/`let` declarations to
satisfy the `tsdoc/require-tsdoc` rule defined in
`packages/config/oxlint-tsdoc/src/rules/require-tsdoc.ts`. The rule fires
on every local declaration without a `/** ... */` comment immediately
preceding it.

The previous session and this session committed 26 `docs(<scope>): add
TSDoc on local declarations` commits plus one `fix(*)` for an
oxlint-disable ordering pitfall.

## Counts

- Total workspace errors at session start: 3620.
- Total after this session: 3582 (38 cleared).
- Commits ending at HEAD = `e18849bc`.

Per-package remaining counts (sorted descending, captured 2026-05-14
07:18 via `oxlint --quiet` from repo root):

```
494 packages/webapp-content/messages-demo
368 packages/webapp-forge/server
304 packages/desktop-daemon/editord
229 packages/webapp-content/ssg-test
210 packages/webapp-edu/paper2vn
205 packages/webapp-productivity/done
185 packages/webapp-productivity/done-postcss
171 packages/module/toml-edit
121 packages/pi/morph-compact
117 packages/webapp-productivity/doodle-widget
114 packages/webapp-forge/stress
104 packages/dev-script/deps-cube
 96 packages/module/es
 93 packages/webapp-productivity/rss
 89 packages/webapp-forge/seed
 85 packages/dev-script/inference-canary-viewer
 84 packages/cli/terminal-exec
 79 packages/module/test
 69 packages/config/oxlint-stylistic
 62 packages/dev-script/inference-canary
 47 packages/rolldown-plugins/import-attributes
 37 packages/module/matrix
 36 packages/dev-script/page-weight
 29 packages/module/fs-path
 25 packages/module/zip-writer
 22 packages/cli/mvm
 19 packages/webapp-search/exa-search
 17 packages/module/numeric-format
 13 packages/config/oxlint-no-restricted-syntax
 12 packages/module/hyperscript
 10 packages/pi/auto-mode
 10 packages/module/token-count
 10 packages/build-tool/css
  9 packages/webapp-productivity/syllable-break-demo
```

## Commit history (this session)

Captured in 19 new commits between `846948b9` and `e18849bc`:

- `846948b9 docs(cli/forbidden-strings)` -- 2 files, 72 ins
- `dc45573a docs(cli/mvm)` -- 3 files, 19 ins
- `4553e6ef docs(cli/vmsync)` -- 3 files, 25 ins
- `50181259 docs(config/oxlint-stylistic)` -- 5 files, 11 ins
- `f2eac9cb docs(desktop-daemon/editord)` -- 30 files, 190 ins
- `e7f53635 docs(desktop-daemon/hall-monitor)` -- 6 files, 40 ins
- `6e82a640 docs(dev-script/deps-cube)` -- 11 files, 87 ins
- `fdf936f6 docs(dev-script/inference-canary-viewer)` -- 10 files, 90 ins
- `51bc13c2 docs(dev-script/inference-canary)` -- 14 files, 62 ins
- `93b33f83 docs(dev-script/page-weight)` -- 4 files, 26 ins
- `301b3990 docs(dev-script/task-util)` -- 13 files, 52 ins
- `d0d03a8c docs(dev-script/vm-builder)` -- 3 files, 14 ins
- `4c39427c docs(module/es)` -- 5 files, 32 ins
- `e7f8da79 docs(module/or-throw)` -- 2 files, 2 ins (fully cleared)
- `5de6a871 docs(desktop-daemon/hall-monitor)` -- 3 files, 4 ins (fully cleared require-tsdoc)
- `68143ee9 docs(dev-script/task-util)` -- 1 file, 4 ins (fully cleared)
- `d720c9a5 docs(cli/vmsync)` -- 7 files, 15 ins (fully cleared)
- `907dee17 docs(pi/terminal-title)` -- 3 files, 9 ins (fully cleared)
- `e18849bc fix(*): use block-level oxlint-disable when paired with TSDoc` -- 13 files

## Approach

For each package:

1. Run `mise run //packages/<path>:lint:oxlint` (or scan root with
   `oxlint --quiet`); filter for `tsdoc(require-tsdoc)`.
2. For each flagged declaration, add a single-line TSDoc immediately
   above it. Comment text explains **why** the binding exists, not
   what; matches the prose style of pre-existing TSDoc in the same file.
3. Verify `grep -c "tsdoc(require-tsdoc)"` drops on the package.
4. Commit as `docs(<scope>): add TSDoc on local declarations`. Use the
   per-package message body that matches recent commits in the log.

`multiline-blocks` and `no-mixed-operators` warnings are out of scope.
Other rule errors (`no-restricted-syntax`, `require-destructured-params`)
encountered in the same files are out of scope; leave them.

## Pitfalls

### Block-level oxlint-disable when paired with TSDoc

Adding `/** TSDoc */` above a declaration that already has
`// oxlint-disable-next-line <rule>` between the existing comment and
the declaration breaks one or the other depending on order:

- TSDoc, then disable-next-line, then declaration: disable still targets
  the declaration (correct), but the require-tsdoc rule no longer sees
  TSDoc as the "immediately preceding comment" of the declaration -- the
  intervening directive line takes that slot.
- disable-next-line, then TSDoc, then declaration: directive applies to
  the literal next physical line (the TSDoc), so the suppression lands
  on the comment and the declaration is no longer suppressed.

Fix is the block-level pair wrapping both:

```ts
/* oxlint-disable typescript/no-unsafe-type-assertion -- justification */
/** TSDoc explaining the local. */
const foo = bar as Foo;
/* oxlint-enable typescript/no-unsafe-type-assertion */
```

This is the AGENTS.md rule under "Linting" added in commit `09e7f34c`.
Commit `e18849bc` retrofits this pattern across the files touched this
session.

### Commit scope hygiene

`git add -A` once accidentally swept in the untracked
`PLANNING.mise-toml-file-enforcer.md` (unrelated to this sweep). Always
stage specific package paths (`git add packages/<scope>/`) for these
commits, never `-A`.

### Stale `.git/index.lock`

A stale `index.lock` from a previous session blocked the first commit.
The fix is `rm .git/index.lock` after confirming no live git process
holds it (`ps -ef | grep '\bgit\b'`).

### Bash `< /dev/null` redirect misfires with chained `rg` and command
chains

Per AGENTS.md, always pass an explicit path argument to `rg`
(`rg <pattern> .` not `rg <pattern>`) or the sandbox switches it into
stdin-reading mode and the chain hangs. Not encountered this session
but easy to trigger.

## Plan for the next session

Workload partitioning for parallel child sessions (cap 16 per
AGENTS.md/Spawning-child-Claude-sessions). Group by expected runtime:

### Tier 1 (small, fast) -- 5 to 25 errors each

```
build-tool/css          10
module/token-count      10
pi/auto-mode            10
module/hyperscript      12
config/oxlint-no-restricted-syntax  13
module/numeric-format   17
webapp-search/exa-search 19
cli/mvm                 22
module/zip-writer       25
webapp-productivity/syllable-break-demo  9
```

Each finishes in one child session quickly. Batch 2-3 packages per
child or single-package children, depending on parallelism budget.

### Tier 2 (medium) -- 30 to 100 errors

```
module/fs-path            29
dev-script/page-weight    36
module/matrix             37
rolldown-plugins/import-attributes  47
dev-script/inference-canary 62
config/oxlint-stylistic   69
module/test               79
cli/terminal-exec         84
dev-script/inference-canary-viewer 85
webapp-forge/seed         89
webapp-productivity/rss   93
module/es                 96
```

One child per package. Module/test and config/oxlint-stylistic deserve
slightly more care because they're library code.

### Tier 3 (large) -- 100+ errors

```
dev-script/deps-cube      104
webapp-forge/stress       114
webapp-productivity/doodle-widget  117
pi/morph-compact          121
module/toml-edit          171
webapp-productivity/done-postcss   185
webapp-productivity/done  205
webapp-edu/paper2vn       210
webapp-content/ssg-test   229
desktop-daemon/editord    304
webapp-forge/server       368
webapp-content/messages-demo  494
```

These may need finer subdivision (per-file or per-directory). Webapp
packages may have different code patterns (Lit components, server
handlers) that resist the single-line TSDoc template; expect a few
patterns to need pattern-specific comments.

### Child prompt template

Each child gets a self-contained prompt that names:

- the package path (e.g. `packages/module/test`),
- the rule (`tsdoc/require-tsdoc`),
- the verification command (`mise run //packages/<path>:lint:oxlint`,
  expected `grep -c "tsdoc(require-tsdoc)"` to drop to 0 for that
  package),
- the AGENTS.md block-level disable rule,
- the canonical commit message and trailer,
- the constraint to NOT fix unrelated rules (multiline-blocks,
  no-mixed-operators, no-function-root-let, etc.),
- the instruction to commit when the package's require-tsdoc count
  reaches 0.

Spawn via `spawn-claude` (general-purpose Agent tool is banned per
AGENTS.md). Cap concurrent children at 16.

## Verification rubric

After each commit:

1. `mise run //packages/<scope>:lint:oxlint 2>&1 | grep -c
   "tsdoc(require-tsdoc)"` returns 0.
2. `git status -s -- packages/<scope>/` is clean.
3. `git log -1 --stat` shows only `packages/<scope>/` paths.

After full sweep:

1. `oxlint --quiet 2>&1 | grep -c "tsdoc(require-tsdoc)"` returns 0
   from repo root.
2. `pnpm tsgo --build` succeeds (TSDoc additions cannot introduce type
   errors but worth confirming the comment blocks parse correctly).
