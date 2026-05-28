# Handover: no-pipe-tables markdownlint rule

Implementing a markdownlint rule that bans Markdown pipe tables and autofixes them to HTML. Approved
plan: `/home/user/.claude/plans/wire-in-a-markdownlint-vectorized-kazoo.md`.

## Decisions locked in (from the planning Q&A)

- Ban Markdown pipe tables only; HTML `<table>` is acceptable but not preferred (rationale: pipe
  tables force each row onto one line, fighting the semantic-line-break rule; HTML allows multi-line
  cells).
- The rule reports and autofixes pipe tables to HTML `<table>` (one element per line, alignment
  preserved via `align` attr). Lists/headings are the preferred form; HTML is the mechanical fallback.
- Authored as hand-written `.mjs` (not TypeScript-built-to-JS), mirroring `packages/config/stylelint`.
  No build step. Reason: markdownlint-cli2 runs under Node and imports the rule directly; a committed
  `.mjs` is always present (no build/lint ordering hazard).
- Housed under a new plugin category `packages/markdownlint-plugins/` (a lint rule is a plugin, not
  config; precedent `packages/oxlint-plugins/*`).
- AGENTS.md line 529 ("No tables; use headings or lists instead") is left UNCHANGED on purpose; the
  rationale is documented in `docs/philosophy/agents.md` instead (do not advertise the HTML escape
  hatch in the terse rule).

## A bigger issue is pending

The user said there is one more bigger issue they will reveal after the compact. Do not consider the
task settled; wait for it before finishing tasks 2 to 5 below, and re-evaluate whether it changes the
approach.

## Done (committed: 23f59a11)

- Package `packages/markdownlint-plugins/no-pipe-tables/`:
  - `to-html-table.mjs`: pure token-to-HTML transform (the unit-tested core).
  - `no-pipe-tables.mjs`: the rule (detection + fixInfo autofix; deep iterative token walk;
    top-level-only fix, blockquote/indented tables report without fix).
  - `index.mjs`: `export default [noPipeTables]`.
  - `no-pipe-tables.unit.test.mjs`: 6 tests, all passing via `node:assert` + markdownlint's `lint`
    and `applyFixes`. No module-test harness (it needs a built dist; node:assert keeps the package
    build-free).
  - `package.json` (name `@monochromatic-dev/markdownlint-rule-no-pipe-tables`, one devDep
    `markdownlint` for JSDoc types + the test), `mise.toml` (lint, lint:oxlint, custom test:unit
    running `bun no-pipe-tables.unit.test.mjs`), `README.md`.
- `markdownlint` added to the pnpm catalog (`pnpm-workspace.yaml`, `>=0.40.0`); `pnpm install` done.
- Unit test passes: `mise run //packages/markdownlint-plugins/no-pipe-tables:test:unit` → 6/6.

## Verified facts (do not re-investigate)

- Pipe-table micromark token type is `table`. Tree: `table` -> `tableHead` (contains the header
  `tableRow` and the `tableDelimiterRow`) and `tableBody` (body `tableRow`s); also a `lineEnding`
  child between them. Cells are `tableHeader`/`tableData`/`tableDelimiter`; cell text is the
  `tableContent` child's `.text`. `\|` is preserved in `.text` (the transform unescapes it to `|`).
  Alignment from delimiter cell text: leading `:` and/or trailing `:` give left/center/right.
- HTML `<table>` parses as `htmlFlow`, never a `table` token, so it is never flagged; the autofix is
  idempotent.
- markdownlint applies custom-rule `fixInfo` under `--fix`. `applyFix` is line-scoped
  (`{lineNumber, editColumn, deleteCount, insertText}`; `insertText` may contain `\n`;
  `deleteCount: -1` deletes a whole line). Multi-line replacement therefore needs one
  replace-the-first-line fix plus per-line delete fixes (so there is one report per table line until
  `--fix` runs). An absent fix is normalized to `null` (not `undefined`) on the resulting LintError.
- `customRules` entries load via `await import(fileURL)` resolved relative to the config file dir
  (`markdownlint-cli2.mjs:70-95, 585-595`). Reference by relative path, not package name.
- markdownlint exports: `lint` from `markdownlint/sync`; `applyFixes`/`applyFix` from `markdownlint`.
- markdownlint-cli2 runtime is 0.22.1 bundling markdownlint 0.40.0; the catalog devDep is also 0.40.0.

## Remaining work

### Immediate: oxlint cleanup on the new package (blocks "done")

`mise run //packages/markdownlint-plugins/no-pipe-tables:lint` currently reports 8 errors + 91
warnings. The package is NOT complete until lint is zero (errors and warnings).

- 8 errors: `typescript(no-unsafe-call)` / `no-unsafe-member-access` / `no-unsafe-return` on
  `node:assert` calls in the test, because there is no tsconfig so type-aware oxlint resolves the
  import to an `error` type. The root `lint:oxlint` runs `task-oxlint --type-aware` (`mise.toml:227`),
  which needs a tsconfig. Fix: add `tsconfig.json` to the package. Stylelint's is just
  `{ "extends": "@monochromatic-dev/config-typescript/dom" }`; this package runs under Node/Bun, so
  pick the matching config-typescript variant (check the variants under `packages/config/typescript`;
  likely a node/neutral one) and add `@types/bun` (catalog) as a devDep so `node:assert` types
  resolve. NOTE: stylelint has a tsconfig but NO `lint:types` task; keep that (do not add lint:types).
- 91 warnings include: `typescript(prefer-readonly-parameter-types)` (10) on the destructured-object
  params (mark array params `readonly`); `unicorn(prefer-string-raw)` (2) (use `String.raw` for the
  `'\\|'` literal, or rephrase); `unicorn(explicit-length-check)` (2) (`stack.length > 0` etc. ->
  the form unicorn wants). Get the full list with:
  `mise run //packages/markdownlint-plugins/no-pipe-tables:lint 2>&1`.
- Re-run the unit test after any code change (the test caught the null-vs-undefined fixInfo detail).

### Task 2: wire into root config (`.markdownlint-cli2.jsonc` + `mise.toml`)

- In `.markdownlint-cli2.jsonc`: add `"no-pipe-tables": true` inside `"config"`; add top-level
  `"customRules": ["./packages/markdownlint-plugins/no-pipe-tables/index.mjs"]`; add
  `"globs": ["**/*.md"]`, `"gitignore": true`; extend `"ignores"` with `"packages-paused/**"`,
  `"packages-deprecated/**"`, `".out-of-scope/**"` (keep the existing four).
- In `mise.toml`: change the no-arg branch of `[tasks."lint:markdownlint"]` (lines ~425-436) from
  `markdownlint-cli2 .` to plain `markdownlint-cli2` (uses config globs). Add a
  `[tasks."format:markdownlint"]` mirroring `format:stylelint` (`mise.toml:453`) that runs
  `markdownlint-cli2 --fix`, and add `"format:markdownlint"` to the root `format` task's tasks list
  (`mise.toml:451`).

### Task 3: fixture verification (real task path)

Create a throwaway `.md` in the repo with a pipe table; `mise run lint:markdownlint -- <file>.md`
flags `no-pipe-tables`; `markdownlint-cli2 --fix <file>.md` converts to a valid `<table>`; re-lint is
clean; a table-free and an HTML-table file pass. Delete fixtures.

### Task 4: migrate existing pipe tables

34 files have real pipe tables; `packages-paused/**` and `packages-deprecated/**` (2) are now
ignored, leaving ~32. Run `mise run format:markdownlint`, review `git diff` (well-formed tables,
alignment, cells that had inline Markdown), `agent-browser` a converted doc to confirm it renders,
and hand-convert any blockquote/indented tables the rule reported without a fix. Then full
`mise run lint:markdownlint` must be zero errors with no OOM; note the runtime (troubleshooting doc
saw ~15s for `**/*.md`; `gitignore: true` should help). Fallback if too slow: enumerate `.md` files
in nushell and pass with `--no-globs`.

### Task 5: docs

- `docs/philosophy/agents.md`: add a `####` subsection under the "Relocated rule rationale" area
  (alongside "#### Communication style: ...") titled e.g. "Documentation standards: why \"No tables\"
  stays terse despite HTML being tolerated". Content drafted in the plan file (section 5).
- `docs/troubleshooting/markdownlint-cli2.md`: the "subdirectory coverage out of scope" note is now
  resolved; record how coverage was expanded and the measured runtime.

## Commit/verification conventions

- Commit eagerly per logical unit, scoped pathspecs (no `git add -A`/`.`), on `main`.
- This handover doc itself uses lists, not tables (dogfooding the rule); keep it that way.
- /tmp has throwaway introspection scripts (`introspect-table.mjs`, `introspect2.mjs`,
  `introspect-bq.mjs`, `introspect-bq2.mjs`); leave them. Token facts above mean no re-introspection
  is needed.
