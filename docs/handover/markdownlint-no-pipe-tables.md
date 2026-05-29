# Handover: no-pipe-tables markdownlint rule

Implementing a markdownlint rule that bans Markdown pipe tables and autofixes them to HTML. Approved
plan: `/home/user/.claude/plans/wire-in-a-markdownlint-vectorized-kazoo.md` (the plan predates the
TypeScript pivot below; the rule behavior it describes still holds, the authoring/build/test approach
changed).

## Decisions locked in

- Ban Markdown pipe tables only; HTML `<table>` is acceptable but not preferred (pipe tables force each
  row onto one line, fighting the semantic-line-break rule; HTML allows multi-line cells).
- The rule reports and autofixes pipe tables to HTML `<table>` (one element per line, alignment
  preserved via `align` attr). Lists/headings are the preferred form; HTML is the mechanical fallback.
- The rule is authored in TypeScript under `src/` and built with tsdown, not hand-written `.mjs`. The
  rule files grew complex enough that TypeScript reads better. (This reverses an earlier `.mjs`
  decision; the user looked at the built-out files and pivoted.)
- Tests use the `@monochromatic-dev/module-test` harness and import the BUILT dist (the exact module
  markdownlint-cli2 loads), not the source. The user mandated testing against the built artifact.
- Housed under `packages/markdownlint-plugins/` (a lint rule is a plugin, not config; precedent
  `packages/oxlint-plugins/*`).
- AGENTS.md line 529 ("No tables; use headings or lists instead") stays UNCHANGED on purpose; the
  rationale belongs in `docs/philosophy/agents.md` (do not advertise the HTML escape hatch in the
  terse rule). This doc edit is still pending (task 5 below).

## Architecture (current)

- `src/token.ts`: `ReadonlyToken`, a fully-readonly structural view of a micromark token with
  `type: string`. This one type fixes two problems at once: the gfm-table `TokenTypeMap` augmentation
  does not resolve here, so `keyof TokenTypeMap` excludes `'table'` and a literal `token.type ===
  'table'` reports TS2367; and `prefer-readonly-parameter-types` flags markdownlint's deeply-mutable
  `MicromarkToken`. `MicromarkToken` is structurally assignable to `ReadonlyToken`, so tokens flow in
  without a cast.
- `src/to-html-table.ts`: pure token-to-HTML-lines transform. Uses `childrenOfType` (returns an array,
  never `undefined`) plus for-of iteration so absence is an empty result, never a written
  `T | undefined` (banned by `no-restricted-syntax/no-nullish-union`). Default export `toHtmlTable`.
- `src/no-pipe-tables.ts`: the rule. `collectTables` does an iterative deep walk (explicit stack, no
  recursion). `reportTable` emits the replace-first-line fix plus per-line deletes. Top-level-only fix;
  blockquote/indented tables report without a fix.
- `src/index.ts`: `export default [noPipeTables]` (the `customRules` entry) and re-exports
  `toHtmlTable` as a named export so the test can exercise the transform against the built dist.
- Build: tsdown `.node.ts` config (`tsdown.node.config.ts` re-exports
  `@monochromatic-dev/config-tsdown/.node.ts`) bundles `src/index.ts` to
  `dist/final/node/index.mjs` (+ `.d.mts`). The bundle is self-contained: type-only `markdownlint`
  imports are erased, `@monochromatic-dev/module-or-throw` is inlined, zero runtime deps.
- `tsconfig.json` extends `@monochromatic-dev/config-typescript` (neutral, this is a Node rule).
- `mise.toml`: `build`/`build:js`/`build:js:node`, watch variants, `lint`/`lint:oxlint`/`lint:types`,
  `test:unit` (standard glob template), and `buildAndTest` (build then test) mirroring `module/test`.

## Done (committed)

- `7f4b5e0f` refactor: the TypeScript package (src, tsconfig, tsdown config, package.json, mise.toml,
  README) replacing the old `.mjs`; pnpm-lock deps.
- `7eecee77` style: incidental formatter output in two unrelated files (user approved committing).
- Earlier WIP `.mjs` package (`23f59a11`) is superseded by the refactor (its `.mjs` files deleted).
- Package gate is green: `build`; `lint:types` exit 0; `lint:oxlint` 0 warnings / 0 errors;
  `test:unit` 6/6 against the built dist; `buildAndTest` works.
- Issue #231 filed: the rule needs a built dist, so a fresh clone (no `dist/`) breaks markdown linting
  once wired; no build preamble was wired into the lint task on purpose (rejected workaround). The
  issue asks for a better solution (e.g. run markdownlint-cli2 under Bun so `customRules` can point at
  source), left open.

## Verified facts (do not re-investigate)

- Pipe-table micromark token type is `table`. Tree: `table` -> `tableHead` (header `tableRow` +
  `tableDelimiterRow`) and `tableBody` (body `tableRow`s). Cells `tableHeader`/`tableData`/
  `tableDelimiter`; cell text is the `tableContent` child's `.text`; `\|` is preserved (the transform
  unescapes it). Alignment from delimiter cell leading/trailing `:`.
- HTML `<table>` parses as `htmlFlow`, never a `table` token, so it is never flagged; the autofix is
  idempotent.
- markdownlint applies custom-rule `fixInfo` under `--fix`. `applyFix` is line-scoped
  (`{lineNumber, editColumn, deleteCount, insertText}`; `insertText` may contain `\n`;
  `deleteCount: -1` deletes a whole line). Multi-line replacement needs one replace-first-line fix plus
  per-line delete fixes (one report per table line until `--fix`). An absent fix normalizes to `null`.
- markdownlint type exports (`markdownlint`): `Rule`, `RuleParams`, `RuleOnError`,
  `RuleOnErrorFixInfo`, `MicromarkToken`, `LintError`; `applyFixes` is a value export. `lint` is from
  `markdownlint/sync`. `RuleParams.lines` is `readonly string[]`; `.parsers.micromark.tokens` is
  `MicromarkToken[]`.
- `Rule.parser` is `"markdownit" | "micromark" | "none"`; micromark is a choice, not mandated. We use
  micromark for its structured token tree. markdownlint's own table rules match via
  `filterByTypes([...])` (a `string[]`), avoiding the `=== 'table'` literal-overlap; our
  `ReadonlyToken` (`type: string`) achieves the same.
- `customRules` entries load via `await import(fileURL)` relative to the config file dir. Reference by
  relative path. The path must be the BUILT artifact (`dist/final/node/index.mjs`), since
  markdownlint-cli2 runs under Node and cannot import `.ts`.
- markdownlint-cli2 runtime is 0.22.1 bundling markdownlint 0.40.0.

## Remaining work

### Task 2: wire into root config (`.markdownlint-cli2.jsonc` + `mise.toml`)

- In `.markdownlint-cli2.jsonc`: add `"no-pipe-tables": true` inside `"config"`; add top-level
  `"customRules": ["./packages/markdownlint-plugins/no-pipe-tables/dist/final/node/index.mjs"]` (the
  built artifact, not src); add `"globs": ["**/*.md"]`, `"gitignore": true`; extend `"ignores"` with
  `"packages-paused/**"`, `"packages-deprecated/**"`, `".out-of-scope/**"` (keep the existing four).
- In `mise.toml`: change the no-arg branch of `[tasks."lint:markdownlint"]` (lines ~425-436) from
  `markdownlint-cli2 .` to plain `markdownlint-cli2` (uses config globs). Add a
  `[tasks."format:markdownlint"]` mirroring `format:stylelint` (`mise.toml:453`) that runs
  `markdownlint-cli2 --fix`, and add `"format:markdownlint"` to the root `format` task's tasks list
  (`mise.toml:451`).
- BUILD FIRST: before any `lint:markdownlint`/`format:markdownlint` run (fixture, migration, final
  sweep), run `mise run //packages/markdownlint-plugins/no-pipe-tables:build`; the dist is gitignored
  and the lint task has no build preamble (see #231).

### Task 3: fixture verification (real task path) -- MANDATORY

The unit tests validate the dist in isolation; only this step crosses the markdownlint-cli2 boundary
(proves the dist `import()`s under Node through the real config, and a load failure would break ALL
markdown linting). Build first, then: a throwaway `.md` with a pipe table flags `no-pipe-tables` via
`mise run lint:markdownlint -- <file>.md`; `markdownlint-cli2 --fix <file>.md` converts to a valid
`<table>`; re-lint clean; a table-free and an HTML-table file pass. Delete fixtures.

### Task 4: migrate existing pipe tables

~32 files have real pipe tables (`packages-paused/**`, `packages-deprecated/**` now ignored). Build,
then `mise run format:markdownlint`; review `git diff` (well-formed tables, alignment, cells with
inline Markdown), `agent-browser` a converted doc to confirm it renders, hand-convert any
blockquote/indented tables the rule reported without a fix. Then full `mise run lint:markdownlint` must
be zero errors with no OOM; note the runtime.

### Task 5: docs

- `docs/philosophy/agents.md`: add a `####` subsection under the "Relocated rule rationale" area titled
  e.g. "Documentation standards: why \"No tables\" stays terse despite HTML being tolerated". Content
  drafted in the plan file (section 5).
- `docs/troubleshooting/markdownlint-cli2.md`: the "subdirectory coverage out of scope" note is now
  resolved; record how coverage was expanded and the measured runtime.

## Commit/verification conventions

- Commit eagerly per logical unit, scoped pathspecs (no `git add -A`/`.`), on `main`.
- This handover doc uses lists, not tables (dogfooding the rule); keep it that way.
- /tmp has throwaway introspection scripts; leave them. Token facts above mean no re-introspection.
