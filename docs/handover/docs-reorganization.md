# Handover: documentation reorganization (Option A)

## Status: migration landed; rule updates and the convention doc remain

Two of four commits are done. The 113-file move into `docs/<family>/` and all
reference rewrites are committed and verified. What remains is updating the
governing rules so future sessions write to the new locations, regenerating
`CLAUDE.md`, and adding the convention rationale doc.

## Task

User instruction: "Execute option A and strip the would-be-unnecessary prefixes"
(GLM_LIMITATIONS.md -> docs/limitations/glm.md), plus "you may also suggest
updates to the rules." Option A is the fully-nested variant from
[docs/planning/docs-organization.md](../planning/docs-organization.md): every
root doc family moves under `docs/<family>/`. The plan was stress-tested through
a `/grill-me` session; the decisions below are settled, do not re-litigate them.

## Decisions locked (from the grilling session)

1.  Layout: fully nested. Every family lives in `docs/<family>/`; root keeps only
    `README.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSES/`.
2.  Naming: `PREFIX.rest.md` -> `docs/<prefix-lowercased>/<rest-lowercased>.md`.
    A second dotted segment stays flat in the filename
    (`TODO.performance.build.md` -> `docs/todo/performance.build.md`), not a deeper
    directory. Kebab-case (`cLikeComments` was renamed to `c-like-comments`).
3.  Hubs: `PREFIX.md` -> `docs/<family>/README.md`, keeping the curated prose.
    No file-enforcer hub-completeness validation (user judged it too much effort).
4.  Orphans: dir-per-prefix, no content folding, EXCEPT bug-reports. The three
    `BUG-REPORT.*` were folded into their most relevant troubleshooting doc as
    sections (`oxlint.md`, `tsdown.md`, `vlt-jsr.md`). `PIPE-BUG.md` ->
    `docs/troubleshooting/pipe-bug.md`; `PRAISE_CLAUDE.md` -> `docs/misc/praise-claude.md`.
5.  Lifecycle: delete verifiably-finished docs (git history is the backstop, so this
    is not destructive), judged per doc by reading each. `PRAISE_CLAUDE.md` is a keeper.
6.  Source references: repo-relative paths (not stable URLs), since a pinned GitHub
    blob URL also 404s on file move.
7.  PHILOSOPHY moves fully, including `PHILOSOPHY.AGENTS.md` -> `docs/philosophy/agents.md`.
8.  `.out-of-scope/` stays at repo root (already a tidy subdirectory; not part of the sprawl).
9.  Regression backstop: deferred. file-enforcer is the wrong tool. The AGENTS.md rule
    change is the cure; a warn-only PreToolUse hook is a documented future option, not built now.

## Done

- `45d9b448 docs(*): delete finished docs and clean hub references`: removed 6
  completed handovers, the already-fixed lint audit, and `TODO.completed.md`
  (8 files); cleaned the TODO hub's completed-tasks links. Kept 4 finished-but-
  referenced docs (`em-dash-sweep-issue-55`, `forbidden-strings-fuzzing`,
  `resharp-panic-fix`, `AUDIT.dry`) because kept docs or Rust source reference them.
- `0a16d0fe docs(*): move doc families into docs/<family>/ and fold bug-reports`:
  the 113-file move, the three bug-report folds, and every link/reference rewrite
  (markdown links via path resolution, plus 26 non-md source/config files).

Verification done: a path-resolution rewrite (not token replace) correctly left
package-local dotted docs untouched (`packages/module/es/TODO.*`, rss `TODO.*`).
Broken-link count is 427, all pre-existing (module/es pseudo-links like
`src/foo.ts:NN` and wrong-depth `../../TODO.*` refs that never resolved from root).
The migration introduced zero net-new broken links after a corrective re-relativization pass.

## Remaining work

Commit 3: update governing rules, then regenerate `CLAUDE.md`.

1.  `AGENTS.md` edits (it is the source; `CLAUDE.md` regenerates from it):
    - Line 5: `PHILOSOPHY.AGENTS.md` -> `docs/philosophy/agents.md`.
    - Line 483: "write up findings in a `TROUBLESHOOTING.<topic>.md` file at the repo
      root" -> "in `docs/troubleshooting/<topic>.md`".
    - Lines 484 to 485: `TROUBLESHOOTING.<topic>.md` -> `docs/troubleshooting/<topic>.md`;
      `PHILOSOPHY.tool-choices.md` -> `docs/philosophy/tool-choices.md`.
    - Line 186: clarify that repo-wide handovers go in `docs/handover/`, package-specific
      handovers stay beside their code (the canonical example is package-local).
    - Add a "Doc placement" subsection under "When committing or documenting" stating the
      rule from decisions 1 to 3 and 6, plus the deferred warn-hook note (decision 9).
    - Re-grep `AGENTS.md` for any other `TROUBLESHOOTING.`/`PHILOSOPHY.`/`TODO.`/`AUDIT.`
      references and update; `docs/decisions/` (line 162) and `docs/agents/` (lines 601 to 603)
      are already correct.
2.  `.agents/skills/troubleshooting-doc/SKILL.md` "File naming" section: "at the repo root"
    -> "in `docs/troubleshooting/`". The canonical-example link was already fixed in commit 2.
    Edit only the `.agents/` canonical copy; `.claude/` and `.factory/` are generated mirrors
    (gitignored, not tracked).
3.  `.agents/skills/runbook/SKILL.md`: state repo-wide vs package-local handover placement.
4.  Verify `.agents/skills/choosing-technology/SKILL.md` still says `docs/decisions/` (correct).
5.  Run file-enforcer (find its mise task) to regenerate `CLAUDE.md` from `AGENTS.md` and
    re-mirror the skills. Confirm `CLAUDE.md` reflects the edits.

Commit 4: add `docs/philosophy/documentation.md` (the convention rationale: hub-and-spoke,
prefix-to-dir, lifecycle delete-finished, repo-relative refs, why volume justifies the
root-vs-package split). Link it from `docs/philosophy/README.md` (the hub list).

Final: confirm the broken-link count stays at the pre-existing baseline (no new breakage),
then the task is complete. Optionally update `docs/planning/docs-organization.md` to mark
Option A as the chosen path.

## Gotchas (cost real time this session)

- `cli-git` guard blocks `git reset --hard` in the main worktree entirely (no bypass; use a
  linked worktree if a hard reset is ever needed). `git add -A` is blocked: use
  `git add --no-enforce-bulk-add -A`. `git commit` needs explicit pathspecs or
  `git commit --no-enforce-only`. Do NOT pipe `git reset` stderr to `/dev/null`; the guard
  rejection is silent then and you will believe a revert succeeded when it did not.
- Migration scripts live in `/tmp` (`migrate-docs.ts`, `check-links.ts`, `fix-moved-links.ts`),
  not committed. `check-links.ts` is reusable for verifying link integrity.
- The 427 broken links are pre-existing and out of scope; do not try to fix them.
- `TROUBLESHOOTING.*.patch` files stayed at repo root (not `.md`, not docs). References to
  them were re-relativized. Moving them into `docs/troubleshooting/` is optional tidying.
- `resharp-merged-issue.local.md` is gitignored and was correctly left untouched.
- The 4 finished-but-referenced docs can be deleted later with reference cleanup if the user wants.
