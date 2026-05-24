# Documentation organization

Proposal to fix the root-directory documentation sprawl.
Follows the existing `PLANNING.*` convention.
Relocates under `docs/planning/` once accepted (see the location fork below).

## Problem, measured

The repository root holds 128 markdown files (`find . -maxdepth 1 -name '*.md' | wc -l`).
By naming convention:

- `TROUBLESHOOTING.*`: 53
- `TODO.*`: 24
- `HANDOVER.*`: 10
- `PHILOSOPHY.*`: 9 (8 spokes plus the `PHILOSOPHY.md` hub)
- `AUDIT.*`: 9
- `PLANNING.*`: 6
- `BUG-REPORT.*`: 3
- `TECH-DEBT.*`, `MIGRATION.*`: 2 each
- one-offs: `HOWTO`, `SECURITY`, `PIPE-BUG`, `PRAISE_CLAUDE`, `CLAUDE-LIMITATIONS`, `GLM_LIMITATIONS`,
  and `resharp-merged-issue.local`

The convention is hub-and-spoke: a `TODO.md` / `TROUBLESHOOTING.md` / `PHILOSOPHY.md` / `AUDIT.md` index file
points at dotted-prefix spoke files in the same directory.
The dotted prefix acts as a virtual directory (`ls TROUBLESHOOTING.*` is the flat equivalent of `ls troubleshooting/`).

This convention is sound. The mess is in how it is applied.

## Diagnosis

1.  Root is flooded. 128 files drown the handful that genuinely belong at root (`README.md`, `SECURITY.md`,
    `AGENTS.md`, `CLAUDE.md`) and the package directories. Tab-completion and `ls` at root are unusable.
2.  Two doc homes, no rule for which to use. The repo already nests `docs/agents/`, `docs/decisions/`, and
    `.out-of-scope/`, yet the bulk families sit flat at root. The repo is half-migrated to subdirectories.
3.  Hubs go stale because nothing regenerates them. `PHILOSOPHY.md` lists 5 spokes; 8 exist on disk
    (`AGENTS`, `task-shell`, `vm-dev-environment` are missing). `TODO.md` lists 11 of 24. The virtual-directory
    abstraction leaks the moment a spoke is added without editing the hub by hand.
4.  No lifecycle separation. Point-in-time and finished artifacts sit beside living reference:
    `TODO.completed.md`, `PLANNING.module-i18n-compose.locked.md`, `resharp-merged-issue.local.md`,
    dated audits (`AUDIT.2026-05-14-repo-assessment.md`), consumed handovers, finished migrations.
5.  Orphan conventions. Single-file prefixes (`BUG-REPORT`, `TECH-DEBT`, `*-LIMITATIONS`, `PIPE-BUG`,
    `PRAISE_CLAUDE`) each invent a category that overlaps an existing one. `PRAISE_CLAUDE.md` and
    `GLM_LIMITATIONS.md` also break the dot convention with underscores.
6.  The rules regenerate the mess. AGENTS.md line 483 and the `troubleshooting-doc` skill mandate
    `TROUBLESHOOTING.<topic>.md` at the repo root; the `choosing-technology` skill writes `docs/decisions/`;
    the `runbook` skill's canonical example lives in a package directory. Cleanup without updating these sources
    refills root within days. Both `AGENTS.md` and `PHILOSOPHY.portability.md` were modified today, so this is a
    growing pile, not a dead one.

## Cross-cutting fixes (apply regardless of the location fork)

These are independent wins with no architectural trade-off.

1.  Auto-generate the hubs. Add a `file-enforcer.config.ts` rule that builds each family hub
    (`TODO.md`, `TROUBLESHOOTING.md`, `PHILOSOPHY.md`, `AUDIT.md`) from the spoke list, the same way
    `CLAUDE.md` is generated from `AGENTS.md` today. Hubs stop going stale because nobody edits them by hand.
2.  Separate lifecycle. Move finished and point-in-time artifacts to `docs/archive/<family>/`. Targets:
    `TODO.completed.md`, `*.locked.md`, `*.local.md` scratch, dated `AUDIT.*`, consumed `HANDOVER.*`,
    finished `MIGRATION.*`. Handovers are transient by definition: archive once the receiving work lands.
3.  Fold the orphan conventions into existing ones:
    - `BUG-REPORT.*` to `TROUBLESHOOTING.*` (a bug report is the symptom-plus-root-cause shape the
      `troubleshooting-doc` skill already defines).
    - `*-LIMITATIONS.md` to `TROUBLESHOOTING.<tool>-limitations.md`.
    - `PIPE-BUG.md` to `TROUBLESHOOTING.<topic>.md` (also lacks a topic suffix today).
    - `TECH-DEBT.*` to `TODO.*` (tech debt is a kind of todo).
    - `MIGRATION.*` to `PLANNING.*` if pending, or `docs/archive/` if done.
    - `PRAISE_CLAUDE.md`, `resharp-merged-issue.local.md` to `docs/archive/` (ad-hoc scratch).
4.  Standardize naming on dot-kebab (`PREFIX.topic-in-kebab.md`). Rename the two underscore offenders.
5.  Decouple source code from doc paths. `packages/cli/forbidden-strings/src/rules/engine.rs` references
    `TROUBLESHOOTING.resharp.md` 9 times, and `pnpm-workspace.yaml` references `TROUBLESHOOTING.dependencies.md`.
    Add a rule: source code references docs by stable repository URL, not relative path, so doc location can
    change without touching code. This removes the strongest argument for freezing docs at root forever.

## The location fork (ranked)

The one real architectural choice. All three keep the dotted-prefix naming and the cross-cutting fixes above;
they differ in where the spoke files live.

### Option C: hybrid (recommended)

Move the bulk reference and archival families into `docs/<family>/`; keep the small living set at root.

- Root keeps: `README.md`, `SECURITY.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md`, the `PHILOSOPHY.md` hub plus
  its 8 spokes, and the family hubs (`TODO.md`, `TROUBLESHOOTING.md`, `AUDIT.md`).
- Root sheds to `docs/`: troubleshooting (53), audit (9), planning (6), handover (10), and the folded orphans.
- Pros: cuts root from 128 to roughly 15; the biggest clutter sources (troubleshooting, audit, handover)
  leave; the constitution (`AGENTS.md`, `CLAUDE.md`, `PHILOSOPHY.*`) that agents and humans open constantly
  stays adjacent; finishes the nesting the repo already started.
- Cons: a justified inconsistency remains, root families nest while package-level docs stay flat; one
  defensible line (volume), but a line to document.

### Option A: fully nested

Every family moves to `docs/<family>/`, including `PHILOSOPHY.*` and the hubs. Root keeps only the files
tools require there (`README.md`, `SECURITY.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md`).

- Pros: cleanest possible root (roughly 5 files); a single, uniform rule, "all docs live under `docs/`".
- Cons: relocates `PHILOSOPHY.*`, which is tightly bound to `AGENTS.md` and read constantly, for marginal
  extra clutter reduction over Option C; more cross-reference churn for the least-cluttering files; pushes
  hub entry points one directory away from where a newcomer looks first.

### Option B: stay flat, finish the convention

Keep every file at root. Apply only the cross-cutting fixes (auto-generated hubs, lifecycle archive, orphan
folding, naming).

- Pros: zero relocation, so zero broken cross-references; preserves the exact greppability in place today.
- Cons: does not fix the stated problem. Root still holds roughly 100 files after archiving. A request that
  opens with "very messy" is not answered by "the index files are now accurate."

### Ranking: C > A > B

- C over A: the clutter reduction past Option C is marginal (philosophy and hubs are not the bulk), while the
  cost is real. `PHILOSOPHY.*` references `AGENTS.md` heavily and changes alongside it; keeping the two adjacent
  at root is worth one documented inconsistency. C buys roughly 85 percent of the cleanup for roughly 60 percent
  of the churn.
- A over B: A fixes root clutter, the actual complaint; B leaves root at roughly 100 files. Greppability,
  B's headline advantage, survives relocation (`rg docs/troubleshooting` is at least as good as `rg TROUBLESHOOTING.`),
  so B wins only on zero-churn, which a churn-tolerant repo with scripted migrations and frequent atomic commits
  does not weight highly.

The one input that flips C to B: if root cleanliness is not actually what you value and the priority is never
touching a cross-reference, B wins. The evidence (the half-done nesting, the stale hubs, the "very messy" framing)
points at clutter as the real cost, so C leads.

## Target layout under Option C

```text
# root: constitution, tool-required files, family hubs
README.md  SECURITY.md  LICENSE  AGENTS.md  CLAUDE.md
PHILOSOPHY.md  PHILOSOPHY.portability.md  PHILOSOPHY.css.md  ...   # constitution, stays adjacent to AGENTS.md
TODO.md  TROUBLESHOOTING.md  AUDIT.md                             # generated hubs

docs/
  troubleshooting/   oxlint.md  tsdown.md  resharp.md  ...        # was TROUBLESHOOTING.*.md
  audit/             dry.md  fallow-tools.md  ...                 # was AUDIT.*.md
  planning/          module-es-split.md  docs-organization.md  ...
  handover/          no-regex.md  lint-sweep.md  ...
  todo/              build-system.md  security.md  ...            # spokes only; TODO.md hub stays at root
  decisions/         font-subsetting.md  ...                      # already here
  agents/            issue-tracker.md  triage-labels.md  ...      # already here
  archive/
    todo/            completed.md
    planning/        module-i18n-compose.locked.md
    audit/           2026-05-14-repo-assessment.md
    misc/            praise-claude.md  resharp-merged-issue.md
.out-of-scope/       jsr.md  bun-install.md  ...                  # already here; the model for the rest
```

Whether the `TODO.*` and `PHILOSOPHY.*` spokes also move is the C-versus-A seam. Under C the heavy families
move and the constitution stays; the layout above reflects that.

## Rule changes (the slate)

The reorganization is only durable if the sources that write docs are updated in the same change.

1.  `AGENTS.md`, section "When committing or documenting": add a "Doc placement" subsection stating the chosen
    home per family, the lifecycle-archive rule, and the dot-kebab naming rule. This is the canonical source;
    `CLAUDE.md` regenerates from it via file-enforcer.
2.  `troubleshooting-doc` SKILL.md, "File naming" section: change "at the repo root" to the chosen path
    (`docs/troubleshooting/<topic>.md` under C or A). One source edit; file-enforcer mirrors it to `.claude/`
    and `.factory/`. Update the canonical-example relative link (`../../../TROUBLESHOOTING.resharp.md`).
3.  `choosing-technology` SKILL.md: confirm `docs/decisions/` (already correct).
4.  `runbook` SKILL.md: state the rule for root versus package placement explicitly; the canonical example
    currently lives in a package directory, which is fine for handovers co-located with the code they hand off,
    but the rule should say so rather than leave it implicit.
5.  `file-enforcer.config.ts`: add the hub-generation rule (cross-cutting fix 1) and, optionally, a check that
    fails if a dotted-prefix doc appears at root for a family whose home is `docs/`.
6.  New spoke `PHILOSOPHY.documentation.md`: the rationale behind the convention (hub-and-spoke, why volume
    justifies the root-versus-package split, lifecycle). AGENTS.md holds the terse rule; this holds the why,
    matching the existing rules-in-AGENTS, rationale-in-PHILOSOPHY split. Add it to the `PHILOSOPHY.md` hub.

## Migration (one-time, scriptable, not yet executed)

Written as a `mise.<action>.ts` script per repo convention, run after the rule changes land:

1.  Create `docs/<family>/` and `docs/archive/<family>/` directories.
2.  `git mv` each spoke to its new home; rewrite intra-repo links (mechanical: `TROUBLESHOOTING.x.md`
    to `docs/troubleshooting/x.md`).
3.  Switch the `engine.rs` and `pnpm-workspace.yaml` references to stable repository URLs.
4.  Add the file-enforcer hub-generation rule; run file-enforcer; verify generated hubs list every spoke.
5.  Rename the underscore offenders; fold the orphan files.
6.  Commit per family (`refactor(docs): relocate troubleshooting family to docs/`) so each move is reviewable.

This document is analysis, not action. Nothing moves until you pick the location option and authorize the migration.
