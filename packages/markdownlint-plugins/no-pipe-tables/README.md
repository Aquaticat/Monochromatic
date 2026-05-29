# @monochromatic-dev/markdownlint-rule-no-pipe-tables

A markdownlint custom rule (`no-pipe-tables`) that bans Markdown pipe tables and autofixes them to
HTML `<table>` blocks.

## Why

Markdown pipe tables force every row onto a single line, which fights the repo convention of breaking
lines at semantic boundaries. HTML tables do not have that constraint: cell content can span multiple
lines. So pipe tables are banned, while HTML tables are tolerated.

Preference order for tabular content: headings or lists first; an HTML `<table>` is the mechanical
fallback the autofix emits, not the recommended authoring form. The rationale for keeping the
AGENTS.md rule terse ("No tables; use headings or lists instead") rather than advertising the HTML
exception lives in `docs/philosophy/agents.md`.

## What it flags

- Markdown pipe tables (the micromark `table` token). Reported at the table's first line.
- Nothing else. An HTML `<table>` parses as `htmlFlow`, not a `table` token, so HTML tables are never
  flagged. This also makes the autofix idempotent: a converted table is not re-flagged.

## Autofix

`markdownlint-cli2 --fix` (via `mise run format:markdownlint`) rewrites a pipe table to an HTML
`<table>`, one element per line, preserving column alignment with the `align` attribute.

markdownlint fixes are line-scoped, so a multi-line block is rewritten by replacing the table's first
line with the whole HTML block and deleting each remaining line. Before `--fix` runs, this surfaces
one report per table line; `--fix` clears them all in one pass.

Only top-level tables are autofixed. A table inside a blockquote or an indented context is reported
without a fix (so `--fix` cannot corrupt its prefix) and is converted by hand.

Cell content is emitted verbatim, including inline Markdown. GitHub renders Markdown inside HTML table
cells; strict CommonMark does not. Spot-check cells that contained inline Markdown after converting.

## Usage

Referenced from the repo's `.markdownlint-cli2.jsonc` by relative path and enabled by name. The path
is the built artifact, not the source:

```jsonc
{
  "config": { "no-pipe-tables": true },
  "customRules": ["./packages/markdownlint-plugins/no-pipe-tables/dist/final/node/index.mjs"]
}
```

## Build

The rule is authored in TypeScript under `src/` and built with tsdown (`mise run build`, via the
`.node.ts` config) to `dist/final/node/index.mjs`. markdownlint-cli2 is installed as a mise `npm:`
global and runs under Node, which cannot import `.ts`, so it loads the built JavaScript. The bundle is
self-contained: type-only imports (`markdownlint`) are erased and `@monochromatic-dev/module-or-throw`
is inlined, so the artifact has no runtime dependencies.

`dist/` is gitignored. A fresh clone (or a tree after a clean) must build before linting, because a
custom rule that fails to import aborts the whole markdownlint run. No build preamble is wired into the
lint task on purpose; a better solution is tracked in
[issue #231](https://github.com/Aquaticat/Monochromatic/issues/231).

## Development

- Build then self-test (tests import the built dist): `mise run //packages/markdownlint-plugins/no-pipe-tables:buildAndTest`
- Self-test only (requires an up-to-date dist): `mise run //packages/markdownlint-plugins/no-pipe-tables:test:unit`
- Lint (oxlint and types): `mise run //packages/markdownlint-plugins/no-pipe-tables:lint`

The tests exercise the bundled, minified `dist` artifact (the exact module markdownlint-cli2 loads),
using the `@monochromatic-dev/module-test` harness.
