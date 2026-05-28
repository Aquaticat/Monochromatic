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

Referenced from the repo's `.markdownlint-cli2.jsonc` by relative path and enabled by name:

```jsonc
{
  "config": { "no-pipe-tables": true },
  "customRules": ["./packages/markdownlint-plugins/no-pipe-tables/index.mjs"]
}
```

The module is committed `.mjs` (no build step); markdownlint-cli2 runs under Node and imports it
directly.

## Development

- Self-test: `mise run //packages/markdownlint-plugins/no-pipe-tables:test:unit`
- Lint: `mise run //packages/markdownlint-plugins/no-pipe-tables:lint`
