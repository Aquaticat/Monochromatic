# HANDOVER.require-regex-justification

State of the lint-failure refactor triggered by the new oxlint rule
`no-restricted-syntax/require-regex-justification`. Resume from here after compaction.

## Overall task

User: "Fix /tmp/pi-bash-25cddcf1ce4714e4.log" — that log captured `mise //:lint`
failing with 114 errors from the new rule across 4 packages.

User's v2 directive after the first plan was rejected: **"Refactor as many of[f]
regex as possible. We don't care about refactor cost."** I.e. replace regex with
string-API/parser code; do NOT pad with `oxlint-disable-next-line` justification
comments. Helper extraction is in scope. The user is in fast-action mode and
does not want clarifying questions.

Approved plan: `/home/user/.claude/plans/fix-tmp-pi-bash-25cddcf1ce4714e4-log-dynamic-orbit.md`.

## Failure breakdown (from the log)

- `//packages/cli/mvm:lint` — 2 errors
- `//packages/claude-code-plugins/source:lint` — 99 errors
- `//packages/cli/terminal-exec:lint` — 2 errors
- `//packages/cli/vmsync:lint` — 11 errors

## Commits landed

```text
21b9acfd feat(claude-code-plugins/source): add text-scan helper module
```

## Progress (tasks 1-12 from the in-memory TaskList; recreate via TaskCreate after compact)

- [x] **#1 text-scan helper module + tests** — committed in `21b9acfd`. Provides
      `isDigit`, `isLowerAlpha`, `isUpperAlpha`, `isAlphaNum`, `isWordChar`,
      `isWhitespace`, `splitWhitespace`, `containsWordBoundedPhrase`,
      `containsAnyOfWordBounded`, `stripBetweenDelims`, `stripLinesStartingWith`.
      Lint clean on text-scan files; tests pass via `bun
      packages/claude-code-plugins/source/src/lib/text-scan.unit.test.ts`.
- [ ] **#2 cli/mvm regex refactors** — pending. Files: `src/list.ts:47`,
      `src/config.ts:79`. Inline predicates only (mvm doesn't import source helpers).
- [ ] **#3 cli/terminal-exec refactors** — pending. Files: `src/desktop-entry-types.ts:74`,
      `src/xdg-paths.ts:104`.
- [ ] **#4 cli/vmsync refactors** — pending. Files: `tsdown.node.config.ts:14-16`
      (use picomatch globs — verified in `node_modules/tsdown/dist/general-D3muxt2f.mjs:14`
      `resolveRegex` accepts strings), `src/boot.ts:316-334`, `src/qemu-img.ts:303`,
      `src/import.ts:121-130`, `src/config.ts:93`, `src/config.unit.test.ts:261,269,281`.
- [ ] **#5 source: simple call-site fixes** — pending. Files: `src/handlers/guardrail.ts:55`,
      `src/cli/spawn-claude.ts:99-104`, `src/handlers/claude-spawn/session-finder.ts:50-52`,
      `src/handlers/claude-spawn/inject.ts:113-117`, `src/handlers/prompt-time.unit.test.ts:86-88`.
- [ ] **#6 source: correction-reminder + tests** — pending. Convert
      `CORRECTION_PATTERNS` to phrase list; tests' `.toMatch(/literal/)` to
      `.toContain('literal')`.
- [ ] **#7 source: bash-output-filter/validation** — pending. Convert
      `ALLOW_PATTERNS` and `SKIP_PATTERNS` arrays to predicate arrays.
- [ ] **#8 source: bash-output-filter/filter-patterns + filter-transforms** —
      pending. Same predicate-array pattern; transforms file's
      `collapseRepeatedChars` becomes a char-scan recursion.
- [ ] **#9 source: uncertainty.ts** (big file) — pending. Convert 4 pattern arrays
      (`UNCERTAINTY_PATTERNS`, `DISMISSAL_PATTERNS`, `CITATION_PATTERNS`,
      `rhetoricalPrefixes`) to phrase lists; rewrite `strip*` functions using
      `stripBetweenDelims` / `stripLinesStartingWith`; rewrite
      `findTrailingQuestion`. **Type change:** `UncertaintyMatch` /
      `findCategoricalDismissal` return shape drops `pattern: RegExp` — update
      any test that destructures `.pattern`.
- [ ] **#10 source: terminal-title/formatter-utils.ts:209** — pending. Replace
      `COMMAND_NOISE_RE` with `stripCommandNoise(command)` token-walker.
- [ ] **#11 Run lint + tests across all 4 packages** — pending. Per-package
      `mise run //packages/<...>:lint` and `:test:unit`; then full
      `mise run //:lint`.
- [ ] **#12 Commit per logical unit** — partly done (#1). Remaining commits:
      one per (source refactor batch | cli/mvm | cli/terminal-exec | cli/vmsync).

## Critical conventions captured during this session

- **Block-disable syntax verified**: `/* oxlint-disable rule -- justification */
  ... /* oxlint-enable rule */` is valid and supports the `--` justification
  suffix; example at `packages/config/oxlint-no-restricted-syntax/src/rules/prefer-describe-function-ref-name.ts:16`.
  But we're refactoring rather than disabling per user direction.
- **`no-non-null-assertion` is enforced workspace-wide**: avoid `s[idx]!`; use
  `s.charAt(idx)` (returns `''` for out-of-bounds) or `s.at(-1) ?? ''`.
- **`prefer-at` rule fires for `s.charAt(s.length - 1)`** but NOT for
  `s.charAt(idx)` with a non-end index. So:
  - End-of-string char → `s.at(-1) ?? ''`
  - Mid-string char → `s.charAt(idx)`
- **Inner `function walk()` declarations need full TSDoc** (@param per
  destructured field name, @returns, @example). The TSDoc lint rule treats
  inner functions exactly like exported ones.
- **dprint workspace format** is what enforces destructure-per-line and
  type-property-per-line. Run `mise run //:format` after writing new code with
  packed object literals. Note: `mise run //:format` runs across the whole
  workspace; lint failures elsewhere are pre-existing, not caused by my edits.
- **Cannot run `dprint`/`pnpm exec dprint` directly** — Claude auto-mode
  classifier denies it (workspace rule: use mise tasks). Use `mise run //:format`.
- **Cannot use TaskCreate/TaskUpdate after compaction** without first invoking
  `ToolSearch` with `select:TaskCreate,TaskUpdate,TaskList` — those tools are
  deferred and need to be re-loaded.

## Working-tree state at handover

Out-of-scope modifications introduced by `mise run //:format` (auto-format)
that I did NOT commit:

- `.pnpmfile.mjs`
- `HANDOVER.forbidden-strings-fuzzing.md`
- `packages/claude-code-plugins/session-start-housekeeping/dist/final/node/index.mjs` (was already dirty pre-session)
- `packages/cli/forbidden-strings/README.md`
- `packages/cli/forbidden-strings/fuzz/Cargo.toml` (was already dirty pre-session)
- `packages/cli/forbidden-strings/fuzz/dictionaries/forbidden-strings.dict`
- `packages/figma-parsers/penpot/src/index.ts`
- `packages/pi/advisor/src/commands.ts`
- `packages/pi/advisor/src/context.unit.test.ts`
- `packages/pi/advisor/src/model-cost.ts`
- `packages/pi/advisor/src/rendering-summary.ts`
- `packages/pi/advisor/src/tool.ts`
- `pnpm-lock.yaml`
- Untracked `packages/cli/forbidden-strings/fuzz/src/` (pre-session)

The new lib files (`packages/claude-code-plugins/source/src/lib/text-scan.ts`
and `text-scan.unit.test.ts`) ARE committed in `21b9acfd`. None of the other
working-tree changes are part of this task — leave them alone unless the user
asks otherwise.

## Resume instructions

1. Recreate the task list with TaskCreate using the 12 items above (mark #1
   completed, #2 in_progress).
2. Start from task #2 (cli/mvm). Files are short; finish in one pass with
   inline `isAlphaNum`/`isWhitespace` predicates per the plan.
3. After each package's refactor: `mise run //packages/<pkg>:lint` (must show
   `Found 0 warnings and 0 errors.`) and `mise run //packages/<pkg>:test:unit`.
4. Commit each package separately with explicit pathspecs (cli-git pre-commit
   hook enforces this: `git commit -m '...' <files>`, not bare `git commit -m`).
5. The biggest unknown is `uncertainty.ts` (task #9) — that file has 4 pattern
   arrays plus 5+ inline regex calls, plus a return-type change that ripples to
   call sites. Save it for last so you have momentum from finishing the others.
6. Re-run `mise run //:lint` at the end to confirm zero remaining errors from
   the original log.
