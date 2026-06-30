# Handover: TSDoc inline-link audit (issue #265)

## Status (2026-06-30, in progress)

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
| 10 | morph-compact, advisor, module/test, image-diff, test-support | a45d6464be450676a | running |
| 11 | doodle-widget, claude-code-plugins/source, catalog-tighten | a43019c52544dcb94 | running |
| 12 | deps-cube, git-clone-size, current-time-context, oxlint-plugins/shared | a67f97dc2d73bf0d2 | done, 50 findings |
| 13 | page-weight, logger, hall-monitor, android-exempt-unused, build-tool/css, pipe, matrix, tofu, aquaticat (typeface), import-attributes, config/tsdown, rgffplay, prompt-time | a7c1304125f5a7feb | running |
| 14 | terminal-exec, hyperscript, rss, config/oxlint, kv-store, fs-path, hook-types, or-throw, session-start-housekeeping | a310a6a4a89c3ec6f | running |
| 15 | vmsync, spawn, figma kiwi, figma penpot, pi/statusline, llm-types | a7c2305b8b17293df | running |
| 16 | terminal-title, vm-builder, catalog-tighten.matrix, forbidden-strings, dom, claude-code-plugins/statusline, thinking-defaults, mcp/mvm, syllable-break-demo, const, memoize, token-count, observable, runtime-error/bun, function-arity, module/current-time-context, guardrail, root config files | abe1a6f6fcb46d1cf | running |

Rule: never have more than 8 batches running at once. Launch the next
queued batch as soon as a running one completes.

## Next steps

1. As each batch agent finishes, record its findings (file + total
   count) in this doc, then launch the next queued batch (respecting
   the 8-cap).
2. Once all 16 batches are done, compile: Category 1 (full list) +
   Category 2 (aggregated counts per package/category, with full or
   representative listings depending on volume) into a single audit.
3. Post the audit as a **comment** on issue #265 (not an edit to the
   original triage-generated body). No outward-facing "let me know if"
   offers (`XCM`), no AI-attribution footer (`ATR`).
4. Mark all tasks in the task list completed; this handover doc can then
   be deleted per `DL4` once the issue comment is posted (git history is
   the backstop).
