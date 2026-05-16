# HANDOVER.require-regex-justification

State of the lint-failure refactor triggered by the new oxlint rule
`no-restricted-syntax/require-regex-justification`. Resume from here after compaction.

## Status: DONE for the original log

All 114 errors from `/tmp/pi-bash-25cddcf1ce4714e4.log` have been refactored,
plus 18 additional out-of-scope `config/stylelint` + `config/tsdown` errors
that the same rule was firing on. Tests pass for every package that has a
`test:unit` task.

Remaining workspace-wide failures are unrelated to this rule and out of
scope for this task (see "Remaining out-of-scope failures" below).

## Overall task

User: "Fix /tmp/pi-bash-25cddcf1ce4714e4.log" — that log captured `mise //:lint`
failing with 114 errors from the new rule across 4 packages.

User's v2 directive after the first plan was rejected: **"Refactor as many of[f]
regex as possible. We don't care about refactor cost."** I.e. replace regex with
string-API/parser code; do NOT pad with `oxlint-disable-next-line` justification
comments. Helper extraction is in scope. The user is in fast-action mode and
does not want clarifying questions.

Approved plan: `/home/user/.claude/plans/fix-tmp-pi-bash-25cddcf1ce4714e4-log-dynamic-orbit.md`.

## Commits landed (in order)

```text
21b9acfd feat(claude-code-plugins/source): add text-scan helper module
041221a3 docs(handover): require-regex-justification refactor state pre-compact  (superseded by this doc)
f0f7aeb0 refactor(mvm): replace regex with inline string-API parsers
98dec9b1 refactor(terminal-exec): replace regex with char-walker + recursive trim
069f377f refactor(vmsync): replace regex with parsers, predicates, picomatch globs
00c9d73d refactor(source): replace simple regex call-sites with text-scan helpers
c217d580 refactor(source): replace correction-reminder regex with phrase list
874feab2 refactor(source): replace bash-output-filter validation regex with predicates
d7455d80 refactor(source): replace bash-output-filter pattern regex with predicates
a457ddcb refactor(source): split uncertainty.ts into regex-free sibling modules
67b3be43 feat(source): add uncertainty-phrases/citations/strip helper modules
3cdc45a9 refactor(source): replace formatter-utils command-noise regex with walker
c11c4d16 refactor(config): replace tsdown/stylelint regex with strings + globs
```

## Per-package outcome

- `//packages/cli/mvm:lint` — 0 errors (was 2). No `test:unit` task; manual smoke
  trace through `parseVirshRow` confirms regex parity.
- `//packages/cli/terminal-exec:lint` — 0 errors (was 2). No `test:unit` task.
- `//packages/cli/vmsync:lint` — 0 errors (was 11), `test:unit` all green
  (validateName, vmDir, vmConfigPath, nameFromPath, parseMemoryToBytes,
  stripJsoncComments).
- `//packages/claude-code-plugins/source:lint` — 0 errors (was 99), `test:unit`
  all green (text-scan, correction-reminder, uncertainty, prompt-time,
  session-start-housekeeping handlers, etc.).
- `//packages/config/tsdown:lint` — 0 errors (was 8, not in original log).
- `//packages/config/stylelint:lint` — 0 errors (was 10, not in original log).

## Remaining out-of-scope failures from `mise run //:lint`

Other rules, other packages, unrelated to `require-regex-justification`:

- `//packages/config/oxlint-stylistic:lint` — 12 errors.
- `//packages/desktop-daemon/hall-monitor:lint` — 3 errors.
- `//packages/config/oxlint-tsdoc:lint` — 10 errors.
- `//packages/desktop-daemon/editord:lint` — 8 errors.

These were not in the original log and are not blocked by anything in this
refactor. Document only; do not start fixing them under this task.

## Critical conventions captured during this session

- **Block-disable syntax** (unused but verified):
  `/* oxlint-disable rule -- justification */ ... /* oxlint-enable rule */`
  with `--` justification. We refactored throughout instead.
- **`no-non-null-assertion` is enforced workspace-wide**: avoid `s[idx]!`; use
  `s.charAt(idx)` (returns `''` for out-of-bounds) or `s.at(-1) ?? ''`.
- **`prefer-at` rule fires for `s.charAt(s.length - 1)`** but NOT for
  `s.charAt(idx)` with a non-end index.
- **`typescript-eslint(no-misused-spread)`** fires on `[...str]` even for ASCII
  scans. Use a `for...of` loop over the string (the loop var is `const`, so
  the function-root-let rule does not fire) or a recursive walker.
- **`stylistic(no-mixed-operators)`** wants `(a !== b) || (!fn(x))`-style
  parens around BOTH operands when `||` mixes with comparison and `!`.
- **TSDoc destructure docs**: do not use `@param parent.field` form; the rule
  reads it as `@param ""`. Use individual `@param fieldName` lines instead
  (see `text-scan.ts:splitWhitespace`).
- **TSDoc backtick-in-backticks** (`` Mirrors `text.replaceAll(/`...`/g, '')` ``)
  trips `tsdoc-code-span-missing-delimiter`. Reword the doc instead.
- **TSDoc `*/` in code-example regex** literally ends the doc comment, breaking
  the file. Escape as `*\/` inside TSDoc blocks.
- **stylelint accepts regex-shaped strings** (`'/^max-/'`, etc.). Use
  ``String.raw`/.../` `` to preserve regex escapes through the JS string layer.
- **tsdown accepts strings in `alwaysBundle`**: non-`/`-fenced strings go
  through `picomatch` (`'@scope/**'`) or exact-match (`'jspdf'`). Verified in
  `node_modules/tsdown/dist/general-D3muxt2f.mjs:14-30`.
- **dprint workspace format** is what enforces destructure-per-line and
  type-property-per-line. Run `mise run //:format`. Note: `//:format` runs
  across the whole workspace; lint failures elsewhere are pre-existing.
- **Cannot run `dprint`/`pnpm exec dprint` directly** — auto-mode classifier
  denies it. Use `mise run //:format`.
- **`cli-git` pre-commit hook requires explicit pathspecs**: `git commit -m '...'
  <files>`, not bare `git commit -m '...'`.
- **`mise run //:lint` runs the full workspace**: surfacing unrelated
  failures (oxlint-tsdoc, editord, etc.) was a side-effect of the final check,
  not part of this task.
- **`bash-output-filter` hook** transforms paths: `~` in Bash output is a
  display substitution for `$HOME`, not a literal. Filesystem values are
  unchanged; only output display is filtered.

## Working-tree state at handover

Out-of-scope modifications already in the working tree (NOT touched by this
task; carry-over from the previous session and from running
`mise run //:format` at the start of this one):

- `.pnpmfile.mjs`
- `HANDOVER.forbidden-strings-fuzzing.md`
- `packages/claude-code-plugins/session-start-housekeeping/dist/final/node/index.mjs`
- `packages/cli/forbidden-strings/Cargo.lock`
- `packages/cli/forbidden-strings/Cargo.toml`
- `packages/cli/forbidden-strings/README.md`
- `packages/cli/forbidden-strings/fuzz/Cargo.toml`
- `packages/cli/forbidden-strings/fuzz/dictionaries/forbidden-strings.dict`
- `packages/figma-parsers/penpot/src/index.ts`
- `packages/pi/advisor/src/commands.ts`
- `packages/pi/advisor/src/context.unit.test.ts`
- `packages/pi/advisor/src/model-cost.ts`
- `packages/pi/advisor/src/rendering-summary.ts`
- `packages/pi/advisor/src/tool.ts`
- `pnpm-lock.yaml`
- Untracked `packages/cli/forbidden-strings/fuzz/src/` (pre-session)

Every file I changed for this task is committed; leave the above alone unless
the user asks otherwise.

## If you need to resume / extend

- **Closing out**: nothing left for the original log. Optional cleanup: delete
  this `HANDOVER.*` file once the user has reviewed.
- **If user wants the other workspace lint failures fixed**: they are
  unrelated rules (`oxlint-stylistic`, `oxlint-tsdoc`, plus type errors in
  `hall-monitor`/`editord`). Start fresh; do not assume `require-regex-justification`
  rule semantics carry over.
- **If a downstream test fails because of the `UncertaintyMatch` type change**:
  the `pattern: RegExp` field was dropped from `UncertaintyMatch` /
  `findCategoricalDismissal`. Only consumer outside `uncertainty*.ts` is
  `stop-reminders/index.ts`, which only reads `.phrase`. No other readers exist.
