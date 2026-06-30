# Handover: TSDoc inline-link audit (issue #265)

## Status (2026-06-30, fix phase in progress)

Audit phase complete: all 16 batches finished, 2467
`downgraded-link`/`missing-reference` findings recorded across the
active codebase, plus the separately tracked 53-instance `@throws`
Error-class list (Category 1, fully subsumed by the batch totals). The
compiled audit was posted as
[a comment on issue #265](https://github.com/Aquaticat/Monochromatic/issues/265#issuecomment-4848121912).

Fix phase started same day: applying every recorded finding directly to
source, per the "Fix phase" section below.

This handover doc and the sibling `tsdoc-link-audit-issue-265.findings.md`
are kept (not deleted per `DL4`) because the fix hasn't fully landed yet:
the findings data is the working checklist for the fix-phase batch
agents. Delete both once the fix phase status table below shows every
batch done and committed.

Issue: [#265](https://github.com/Aquaticat/Monochromatic/issues/265),
"Restore TSDoc inline links removed from comments".

Goal: populate issue #265 with a full audit (not a sample) of TSDoc
comments across the active codebase that should use `{@link Name}` but
instead use plain text, a backtick code span, or mention nothing at all
for a declaration the commented code actually depends on. This is a
read-only documentation audit; no source files are being edited as part
of this work. Git history is explicitly out of scope per user
instruction (many TSDoc comments were wrong from the start, not just
regressed by the lint bug).

User-set scope constraints (in order given):

- Don't search git history.
- Don't stop at the common `@throws ErrorName` pattern; also check
  `@param`/`@returns`/summaries/remarks, and cases where the comment
  references nothing at all but should.
- Audit every TSDoc comment, not just exported/public-API declarations
  (locals and private declarations count too, matching the `TSD`/`RDC`
  rules in `AGENTS.md`).
- Skip `packages-paused/` and `packages-deprecated/` entirely.
- Subagents are allowed and expected (manual single-session review of
  ~28,000 TSDoc blocks is not feasible); max 8 active subagents at a
  time.

## Root cause (already verified, cite this in the issue)

`packages/oxlint-plugins/tsdoc/src/rules/type-annotations.ts` implements
the `no-types` rule (function `findTypeAnnotations`, line 81). It used to
flag any `@tag {body}` shape, including `{@link Target}`, as a JSDoc-style
type annotation. The fix is the `isInlineTagOpener` check (lines 42-60,
applied at line 133): a `{` immediately followed by `@` is now recognized
as a TSDoc inline tag opener and skipped, not reported. This is already
fixed in the current tree; the audit is about restoring/adding the links
that were never written or were downgraded while the bug was live.

## Methodology

### Category 1: `@throws` referencing a real custom Error class (DONE, exhaustive)

Grep-verified across the whole repo (not batched): every `@throws` tag
whose first word is a PascalCase identifier ending in `Error`, not
already wrapped in `{@link}`, cross-checked against an actual
`export class <Name>` (or equivalent) declaration. Result: 56 occurrences
of 17 distinct custom error classes across 13 packages, all confirmed to
resolve to a real exported class (one, `HTTPError`, resolves to an
import from the `h3` package rather than a project file, still a real,
linkable symbol). Full list already collected; goes directly into the
issue comment, not re-derived by the batch agents.

### Category 2: everything else (in progress, batched subagent sweep)

Grepping alone produces too many false positives once you go past the
`ErrorName` pattern (e.g. `@returns Absolute path to...` starts with a
capital letter because it's a sentence, not a type reference; backtick
spans like `` `Date` ``, `` `Set` ``, `` `T` `` are generic builtins, not
project symbols). This category needs per-declaration judgment: read the
declaration's body, see what real (imported or sibling) declarations it
throws/calls/returns/depends on, and check whether the doc comment
mentions each one, and how.

Two finding types:

- `downgraded-link`: doc mentions the real dependency as plain prose or
  a backtick code span instead of `{@link Name}`.
- `missing-reference`: doc does not mention the dependency at all even
  though the body clearly depends on it.

Excluded from findings: generic JS/TS builtins (`Error`, `Date`, `Map`,
`Set`, `Promise`, `RegExp`, `string`, `number`, bare generic params like
`T`) unless the project has its own branded/wrapped type of that exact
name. Bias is toward recall (the user wants completeness over precision)
but agents were told not to invent links to non-resolving names.

### Scope of the batched sweep

Built from `git ls-files '*.ts' '*.tsx'`, filtered to drop:

- `node_modules/`, `dist/`, `.out-of-scope/`
- `packages-paused/`, `packages-deprecated/`
- test files: `*.test.ts`, `*.spec.ts`, `*.unit.test.ts`, `*.bench.ts`,
  anything under `test-fixture/`
- `packages/dev-script/file-enforcer/data/packages.generated.ts`
  (22,606-line auto-generated Repology package list, single top-of-file
  comment, no per-declaration TSDoc to audit)

Result: 1529 files, ~262K lines, partitioned into 16 batches of roughly
13K-17K lines each (greedy bin-packing by package, biggest package
split by subdirectory). One general-purpose background subagent per
batch, each given the exact file list and the rubric above, reporting
back a flat `file:line | kind | current | target` list plus an exact
`TOTAL FINDINGS` count (large repetitive clusters may be summarized in
the listing, but the count must stay exact).

The per-batch file lists were written to
`/tmp/claude-1000/-var-home-user-Monochromatic/7644b1ce-9b87-4da8-aabc-37c7d9722439/scratchpad/batch01.txt`
through `batch16.txt`. **That scratchpad is session-ephemeral and will
not exist in a future session.** If those files are gone, regenerate
them from the package-to-batch mapping below plus
`git ls-files '*.ts' '*.tsx'` with the same exclusion filters.

### Package-to-batch mapping (for regeneration if scratchpad is gone)

- batch01: `packages/dev-script/file-enforcer` (all subdirs except
  `data/packages.generated.ts`)
- batch02: `packages/cli/mvm`, `packages/dev-script/mutation-test`,
  `packages/module/async-time`, `packages/claude-code-plugins/claude-spawn`
- batch03: `packages/module/toml-edit`, `packages/pi/linkup`,
  `packages/module/throws`
- batch04: `packages/oxlint-plugins/no-restricted-syntax`,
  `packages/cli/git`, `packages/module/numeric-format`,
  `packages/claude-code-plugins/correction-reminder`
- batch05: `packages/webapp-productivity/done-postcss`,
  `packages/module/i18n-compose`, `packages/cli/fy`,
  `packages/dev-script/backup-path`
- batch06: `packages/ssg/aquati.cat`, `packages/cli/markdown-lint`,
  `packages/intellij-plugins/islands-black`, `packages/module/async-iter`
- batch07: `packages/oxlint-plugins/stylistic`,
  `packages/pi-shared/model-selection`,
  `packages/dev-script/watch-restart`, `packages/module/zip-writer`,
  `packages/claude-code-plugins/stop-reminders`,
  `packages/claude-code-plugins/terminal-title`
- batch08: `packages/pi/auto-mode`, `packages/oxlint-plugins/tsdoc`,
  `packages/claude-code-plugins/bash-output-filter`
- batch09: `packages/webapp-productivity/done`,
  `packages/dev-script/task-util`, `packages/mcp/stdio`
- batch10: `packages/pi/morph-compact`, `packages/pi/advisor`,
  `packages/module/test`, `packages/module/image-diff`,
  `packages/oxlint-plugins/test-support`
- batch11: `packages/webapp-productivity/doodle-widget`,
  `packages/claude-code-plugins/source`,
  `packages/dev-script/catalog-tighten`
- batch12: `packages/dev-script/deps-cube`,
  `packages/cli/git-clone-size`, `packages/pi/current-time-context`,
  `packages/oxlint-plugins/shared`
- batch13: `packages/dev-script/page-weight`, `packages/module/logger`,
  `packages/desktop-daemon/hall-monitor`,
  `packages/cli/android-exempt-unused`, `packages/build-tool/css`,
  `packages/module/pipe`, `packages/module/matrix`,
  `packages/config/tofu`, `packages/typeface/aquaticat`,
  `packages/rolldown-plugins/import-attributes`,
  `packages/config/tsdown`, `packages/cli/rgffplay`,
  `packages/claude-code-plugins/prompt-time`
- batch14: `packages/cli/terminal-exec`, `packages/module/hyperscript`,
  `packages/webapp-productivity/rss`, `packages/config/oxlint`,
  `packages/module/kv-store`, `packages/module/fs-path`,
  `packages/claude-code-plugins/hook-types`, `packages/module/or-throw`,
  `packages/claude-code-plugins/session-start-housekeeping`
- batch15: `packages/cli/vmsync`, `packages/pi/spawn`,
  `packages/figma-parsers/kiwi`, `packages/figma-parsers/penpot`,
  `packages/pi/statusline`, `packages/module/llm-types`
- batch16: `packages/pi/terminal-title`, `packages/dev-script/vm-builder`,
  `packages/dev-script/catalog-tighten.matrix`,
  `packages/cli/forbidden-strings`, `packages/module/dom`,
  `packages/claude-code-plugins/statusline`,
  `packages/pi/thinking-defaults`, `packages/mcp/mvm`,
  `packages/webapp-productivity/syllable-break-demo`,
  `packages/module/const`, `packages/module/memoize`,
  `packages/module/token-count`, `packages/module/observable`,
  `packages/runtime-error/bun`, `packages/module/function-arity`,
  `packages/module/current-time-context`,
  `packages/claude-code-plugins/guardrail`, plus the repo-root config
  files `file-enforcer.config.ts`, `oxlint.config.ts`,
  `oxlint-require-tsdoc.ts`, `playwright.browser.config.ts`,
  `playwright.e2e.config.ts`, `playwright/global.d.ts`,
  `playwright/serve.ts`

### Batch agent status

| Batch | Packages (short) | Agent ID | Status |
| --- | --- | --- | --- |
| 01 | file-enforcer | a1c00c2bf9c3b21d1 | done, 294 findings |
| 02 | mvm, mutation-test, async-time, claude-spawn | a95c3884bfa6c3316 | done, 44 findings |
| 03 | toml-edit, linkup, throws | a37e6ff13e12bbda0 | done, 153 findings |
| 04 | no-restricted-syntax, git, numeric-format, correction-reminder | a2e4ea7abc709c2d0 | done, 485 findings |
| 05 | done-postcss, i18n-compose, fy, backup-path | a125f0fc146d11e83 | done, 68 findings |
| 06 | aquati.cat, markdown-lint, islands-black, async-iter | a2790fd594c501e06 | done, 81 findings |
| 07 | stylistic, model-selection, watch-restart, zip-writer, stop-reminders, terminal-title | a344cc088ad287c9e | done, 82 findings |
| 08 | auto-mode, tsdoc, bash-output-filter | a5d335e4e5b8860af | done, 281 findings |
| 09 | done, task-util, mcp/stdio | a102680557ea5e8a9 | done, 150 findings |
| 10 | morph-compact, advisor, module/test, image-diff, test-support | a45d6464be450676a | done, 23 findings |
| 11 | doodle-widget, claude-code-plugins/source, catalog-tighten | a43019c52544dcb94 | done, 111 findings |
| 12 | deps-cube, git-clone-size, current-time-context, oxlint-plugins/shared | a67f97dc2d73bf0d2 | done, 50 findings |
| 13 | page-weight, logger, hall-monitor, android-exempt-unused, build-tool/css, pipe, matrix, tofu, aquaticat (typeface), import-attributes, config/tsdown, rgffplay, prompt-time | a7c1304125f5a7feb | done, 159 findings |
| 14 | terminal-exec, hyperscript, rss, config/oxlint, kv-store, fs-path, hook-types, or-throw, session-start-housekeeping | a310a6a4a89c3ec6f | done, 139 findings |
| 15 | vmsync, spawn, figma kiwi, figma penpot, pi/statusline, llm-types | a7c2305b8b17293df | done, 225 findings |
| 16 | terminal-title, vm-builder, catalog-tighten.matrix, forbidden-strings, dom, claude-code-plugins/statusline, thinking-defaults, mcp/mvm, syllable-break-demo, const, memoize, token-count, observable, runtime-error/bun, function-arity, module/current-time-context, guardrail, root config files | abe1a6f6fcb46d1cf | done, 122 findings |

Rule: never have more than 8 batches running at once. Launch the next
queued batch as soon as a running one completes.

## Audit next steps (done)

1. As each batch agent finishes, record its findings (file + total
   count) in this doc, then launch the next queued batch (respecting
   the 8-cap). Done.
2. Once all 16 batches are done, compile: Category 1 (full list) +
   Category 2 (aggregated counts per package/category, with full or
   representative listings depending on volume) into a single audit.
   Done.
3. Post the audit as a **comment** on issue #265 (not an edit to the
   original triage-generated body). No outward-facing "let me know if"
   offers (`XCM`), no AI-attribution footer (`ATR`). Done.

## Fix phase

Goal: apply every recorded `downgraded-link`/`missing-reference` finding
directly to source (and the Category 1 `@throws` list, fully subsumed by
Category 2), wrapping the named dependency in `{@link Name}` per this
codebase's established convention (bare identifier, `{@link Name}` or
`{@link Name.member}`; never file-path- or package-qualified, confirmed
by grepping existing correct usages across the repo, including ones
naming external-package symbols).

Re-uses the same 16-batch partition as the audit, with the four largest
single-or-dominant-package batches split in half purely to keep each
fix-agent's edit volume manageable (no audit-finding renumbering, same
underlying packages): batch01 -> f01a/f01b (file-enforcer), batch04 ->
f04a (no-restricted-syntax alone) / f04b (git, numeric-format,
correction-reminder), batch08 -> f08a (auto-mode alone) / f08b (tsdoc,
bash-output-filter). 19 fix-batches total. Split file lists are at
`<scratchpad>/f01a.txt`, `f01b.txt`, `f04a.txt`, `f04b.txt`, `f08a.txt`,
`f08b.txt` (session-ephemeral; regenerate from the package-to-batch
mapping above plus the subdirectory splits noted here if lost: f01a =
file-enforcer `data/` + `src/io,package,watch`; f01b = the rest of
file-enforcer; f04a = `oxlint-plugins/no-restricted-syntax` only; f04b =
`cli/git` + `module/numeric-format` + `claude-code-plugins/correction-reminder`;
f08a = `pi/auto-mode` only; f08b = `oxlint-plugins/tsdoc` +
`claude-code-plugins/bash-output-filter`).

Each fix-batch agent: reads its findings.md batch section as a checklist
(expanding any condensed/grouped entries by inspecting every file/pattern
they refer to, since large batches were summarized during the audit, not
exhaustively line-listed), applies `{@link}` fixes directly, runs
`lint:oxlint` + `lint:types` per touched package, and commits per package
with scoped pathspecs (`fix(<package>): restore TSDoc inline links (issue #265)`).

### Fix-batch status table

| Batch | Packages (short) | Agent ID | Status |
| --- | --- | --- | --- |
| f01a | file-enforcer (data, io, package, watch) | adeafb1c9d4434f30 | done, 132 findings, 45 files, commits a445a386e/642a31733 |
| f01b | file-enforcer (pipeline, jetbrains, root) | a026a84a78b0975f2 | done, 17 files, commit a24250b7b |
| f02 | mvm, mutation-test, async-time, claude-spawn | a55c638b0ae14975e | done, 42/42 findings, 27 files, commits 3236c3186/25f0d78cb/0323683d1 |
| f03 | toml-edit, linkup, throws | af107f680f7e6b614 | done, 153/153 findings, 38 files, commits 6311f254c/981112c38/0aecb7671/f57d6277b/69d616e81 |
| f04a | oxlint-plugins/no-restricted-syntax | a6d8aa4c72be9a16f | done, ~166 link insertions, 64 files, 12 commits (c45a94b5c..6121b5cb4) |
| f04b | git, numeric-format, correction-reminder | a8287a03d6364d612 | done, 26 files, commits d39c01303/0d64b82dd/568a6f59d/5055ca8af |
| f05 | done-postcss, i18n-compose, fy, backup-path | acfac2ca064b22aa2 | done, 68/68 findings, 34 files, commits fc4aecc76/0accc0700 |
| f06 | aquati.cat, markdown-lint, islands-black, async-iter | a8650684bc0cf2bdb | done, 81/81 findings, 18 files, commits 9d25283be/4fc7f8033/4dd06f75a |
| f07 | stylistic, model-selection, watch-restart, zip-writer, stop-reminders, terminal-title | a236bb586d250c34d | done, 70 link insertions, 27 files, commits 63e75558f/8bef4e8c2/f16be6b94 |
| f08a | auto-mode | a91bc92778e72e1b1 | done, ~250 link insertions, 38 files, commits 3f9800c5e/794064be5/457404352/a5e720415 |
| f08b | tsdoc, bash-output-filter | a4a6b817e212274ea | done, 43 findings, 23 files, commits 3cab138f8/a87959e62 |
| f09 | done, task-util, mcp/stdio | a73bd08ceb0208742 | done, 35/35 findings (97 locations), 51 files, commits bff4cff90/6bae8a2de/c116a5756 |
| f10 | morph-compact, advisor, module/test, image-diff, test-support | a96731bd848cdd929 | done, 32 link restorations, 13 files, commits 6c529d5bb/42a3249d7/3f4d20813 |
| f11 | doodle-widget, claude-code-plugins/source, catalog-tighten | a166231c9b11bdb32 | done, ~111 findings, 34 files, commits ddf0bed84/99e10dc0f/4a6986694 |
| f12 | deps-cube, git-clone-size, current-time-context, oxlint-plugins/shared | abf93d7976d062f11 | done, 50/50 findings, 21 files, commits 6a74c6c6f/a76fcd3d7/9d654e5ff |
| f13 | page-weight, logger, hall-monitor, android-exempt-unused, build-tool/css, pipe, matrix, tofu, aquaticat, import-attributes, config/tsdown, rgffplay, prompt-time | | queued |
| f14 | terminal-exec, hyperscript, rss, config/oxlint, kv-store, fs-path, hook-types, or-throw, session-start-housekeeping | a627dd408e4a90bd9 | done, 143 link insertions, 58 files, commits 91f356590/169cd3a1c/b69c645b2/8c6e09408/f358330bd/19c173c6c |
| f15 | vmsync, spawn, figma kiwi, figma penpot, pi/statusline, llm-types | | queued |
| f16 | terminal-title, vm-builder, catalog-tighten.matrix, forbidden-strings, dom, statusline, thinking-defaults, mcp/mvm, syllable-break-demo, const, memoize, token-count, observable, runtime-error/bun, function-arity, current-time-context, guardrail, root config | | queued |

Rule: never have more than 8 fix-batches running at once. Launch the
next queued batch as soon as a running one completes.

## Fix phase next steps

1. As each fix-batch agent finishes, record its result (files edited,
   findings resolved, skipped count) in the table above, then launch the
   next queued batch (respecting the 8-cap).
2. Once all 19 fix-batches are done and committed, run a final
   repo-formatting spot check (`lint:dprint`) over the touched files.
3. Post a wrap-up comment on issue #265 noting the fix landed (commit
   range, total findings resolved), then close issue #265 per `SK1`.
4. Delete both this handover doc and the findings doc per `DL4` (git
   history is the backstop).
