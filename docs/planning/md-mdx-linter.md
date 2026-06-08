# Plan: md/mdx linter and fixer to replace markdownlint

Build a purpose-built Markdown and MDX linter, with localized autofixes, to replace `markdownlint-cli2`.
The fixer half follows the oxlint model: lint rules carry localized fix edits, and `--fix` applies them.
Line breaks are governed by a lint rule with a localized fix (`semantic-line-breaks`), not by a separate
prose-reformatting engine.

## Motivation

Three forces, each verified against repo artifacts, drive the replacement.

- The previous tool, `remark-cli` plus `remark-lint-*`, was dropped for dependency weight (megabytes of
  transitive packages). So the replacement must not re-introduce a large rule-package galaxy.
- `markdownlint-cli2` is being dropped for two reasons. It is easy to misuse: the `.`-plus-argument case
  bypasses the dot-only remap and walks the whole tree, reading multi-gigabyte binaries as Markdown until
  it OOMs (documented in `docs/troubleshooting/markdownlint-cli2.md`). And even when used correctly it is
  slow on this tree, because its glob layer reads every matched file.
- MDX is unlinted today. The config globs in `.markdownlint-cli2.jsonc` are `**/*.md` only, so all 36
  `.mdx` files get zero coverage. Linting them is a motivation for writing a new tool, not an afterthought.

For context, the dprint Markdown plugin is already disabled in `packages/config/dprint/index.json`
("Formats ordered list markers wrongly"), so no tool formats Markdown prose today. That gap is addressed
later, not in this MVP (see non-goals).

## MVP scope

- Reimplement the rules currently enabled in `.markdownlint-cli2.jsonc`: MD001, MD014, MD024, MD025,
  MD026, MD034, MD036, MD040, MD052, MD053, MD054, plus the custom `no-pipe-tables` rule. These rule ids
  name behavior we own and verify with our own unit tests; this is not a parity port (see testing).
- A `semantic-line-breaks` rule with a localized autofix. It enforces a line break after every prose
  break-point character (`,` `.` `;` `:` `?` `!`), excluding code, URLs, MDX nodes, and abbreviations or
  decimals (see the rule inventory). The fix only adds breaks; it never joins or relocates existing ones.
  This supersedes the previously deferred semantic-line-breaks non-goal.
- Lint `.mdx` files in addition to `.md`. Every rule, `semantic-line-breaks` included, runs on both
  extensions uniformly: there is no `.md`-only phase. MDX files are parsed correctly (so surrounding
  Markdown is not misparsed), and the only `.mdx` difference is that MDX-specific nodes (and their
  subtrees) are skipped, while all surrounding Markdown prose is linted identically to the `.md` case. The
  JSX-adjacency risk is handled by skipping those nodes, not by withholding any rule from `.mdx`.
- Localized autofixes for every fixable rule, applied with a `--fix` flag.
- A fast, misuse-resistant CLI that runs under Bun.

## Non-goals (explicitly deferred)

- Clause-aware semantic line breaks (true sembr.org reflow that understands grammar). The MVP ships a
  mechanical, punctuation-based `semantic-line-breaks` rule instead, which needs no grammar engine and so
  sidesteps the blocker that justified deferring this: the absence of an embeddable TypeScript component
  (`sembr` is Python and Transformers; `readable` is a Go binary; `rumdl` has only an open issue). What
  stays out of scope is grammar-aware breaking, and joining or relocating existing breaks: the rule only
  adds breaks at punctuation, it never reflows lines that were wrapped elsewhere.
- MDX-specific rules (linting JSX attributes, expression contents, import hygiene). Deferred, but the
  architecture below is chosen to make these cheap to add later.
- Whole-document re-serialization or prose reformatting. Fixes are localized source edits, never a
  parse-then-stringify round trip; untouched spans stay byte-for-byte identical.

## Architecture decision: mdast as the single engine

Decision: parse to mdast (the Markdown abstract syntax tree), and write all rules against that one tree.

Rationale: the deferred future work (MDX-specific rules) is far easier on mdast, where MDX constructs are
first-class typed nodes (`mdxjsEsm`, `mdxFlowExpression`, `mdxTextExpression`, `mdxJsxFlowElement`,
`mdxJsxTextElement`), than on raw micromark tokens. Choosing mdast now avoids a later re-platforming.

Costs accepted by this decision, and how the plan absorbs each:

- The `no-pipe-tables` rule is written against micromark tokens today
  (`packages/markdownlint-plugins/no-pipe-tables/src/`). It must be ported to mdast `table` / `tableRow` /
  `tableCell` nodes. The HTML-emitting transform in `to-html-table.ts` (alignment handling, `\|`
  unescaping) reuses directly; only the tree-walking layer changes.
- mdast normalizes some syntactic distinctions that two rules depend on. MD034 (bare URL versus `<url>`
  versus inline link) and MD054 (link style) need the exact written form, which mdast can collapse. Those
  rules read the original source slice at `node.position.start.offset` to `node.position.end.offset` to
  recover the written form. This is source inspection at known offsets, not a second parser.
- Diagnostics report against mdast positions (line, column, offsets). There is no requirement to match any
  other tool's column representation, because correct output is defined by this tool's own unit tests, not
  by comparison against markdownlint (see testing).

This is a single engine, not the dual-engine shape discussed earlier: with no serializer in scope, mdast
is the only representation, and fixes are localized text edits applied to source.

## Parser pipeline

One parse function, `parse(source, { mdx })`, returns an mdast tree.

- Core: `mdast-util-from-markdown`.
- GFM: `micromark-extension-gfm` plus `mdast-util-gfm`. Tables are required for `no-pipe-tables`; autolink
  literals affect MD034.
- MDX (only when `mdx` is true): `micromark-extension-mdxjs` plus `mdast-util-mdx`. This is what prevents
  `import` lines, JSX, and `{expr}` from being misparsed as paragraphs or HTML blocks.
- Frontmatter: `micromark-extension-frontmatter` plus `mdast-util-frontmatter`. This is a correctness
  requirement, not optional. A leading YAML block must be recognized and skipped before any rule runs, and
  71 files in this corpus open with `---` frontmatter. Without the step, a leading block parses as a
  thematic break plus paragraph content, so rules would emit spurious diagnostics (and `semantic-line-breaks`
  would try to break YAML lines) on every frontmatter file. The SSG pipeline confirms content files carry
  frontmatter (its `renderMdx` strips it before rendering); the linter sees the raw on-disk file, so it
  must handle it.

Dependency-weight note: these utilities are a small fixed set, and the core parse layer is already present
in `pnpm-lock.yaml` as a transitive dependency (`mdast-util-from-markdown@2.0.3`, `mdast-util-mdx@3.0.0`,
`micromark-extension-mdxjs@3.0.0`), pulled in via `@mdx-js/mdx`, which the SSG packages use
(`packages/webapp-content/ssg-test/`). The MVP adds no rule-package galaxy and no serializer, which is the
opposite of what made `remark-lint` heavy.

Tree walking uses an explicit work-stack, never recursion, matching the `no-pipe-tables` precedent and the
repo rule against recursion over potentially-degenerate input (deeply nested blockquotes or lists can form
a spine).

## Rule and diagnostic model

- A rule is a named object: a stable `id` (the MDxxx code or `no-pipe-tables`), a `check` function that
  walks the tree and pushes diagnostics, and optional fixability.
- A diagnostic carries: rule id, message, position (line, column, and source offsets), and an optional fix.
- A fix is a localized edit expressed as source offsets: `{ start, end, insertText }`. This is the
  oxlint and markdownlint `fixInfo` model translated to offsets, which mdast positions provide directly.
  An add-only fix is the degenerate case where `start === end`: a pure insertion that moves no existing
  byte. `semantic-line-breaks` uses this exclusively (it inserts a newline plus the block's continuation
  prefix at each break-point), which is why untouched spans stay byte-for-byte identical.
- Rules skip MDX node types in the MVP: a rule that walks the tree ignores `mdxjsEsm`,
  `mdxFlowExpression`, `mdxTextExpression`, `mdxJsxFlowElement`, and `mdxJsxTextElement`, plus their
  subtrees. Standard-Markdown nodes around them are linted identically to the `.md` case.

Code follows repo TypeScript conventions: named function declarations, single destructured object
parameter for two or more parameters, explicit types, `const` over `let`, `import type` for type-only
imports, TSDoc on all declarations.

## Rule inventory

Fixability below is a best classification and must be confirmed per rule when the rule is implemented, not
asserted from memory. markdownlint's source is a useful reference for fix semantics (its MIT notice is
recorded under `LICENSES/`), but each rule's behavior is defined by this tool's own unit tests.

- MD001 heading-increment
  - Nodes: `heading`. Check the depth sequence increments by at most one.
  - Report-only.
- MD014 commands-show-output
  - Nodes: `code` (fenced shell). Inspect the value lines for `$ ` prompts with no shown output.
  - Fixable: strip the prompts.
- MD024 no-duplicate-heading (siblings_only)
  - Nodes: `heading` plus parent structure to scope siblings. Replicate the `siblings_only: true` option.
  - Report-only.
- MD025 single-h1
  - Nodes: `heading` of depth one; flag more than one.
  - Report-only.
- MD026 no-trailing-punctuation
  - Nodes: `heading` text; flag a trailing character in the configured set (`.:` here).
  - Fixable: strip the trailing punctuation. Replicate the `punctuation` option.
- MD034 no-bare-urls
  - Nodes: `link` (and gfm autolink-literal links) plus `text`. Needs the source slice to confirm the URL
    was written bare rather than as `<url>` or `[text](url)`.
  - Fixable: wrap in angle brackets.
- MD036 no-emphasis-as-heading
  - Nodes: `paragraph` whose sole child is `emphasis` or `strong`, used as a heading substitute.
  - Report-only.
- MD040 fenced-code-language
  - Nodes: `code` with empty or missing language.
  - Report-only.
- MD052 reference-links-images
  - Nodes: `linkReference` / `imageReference` with no matching `definition`. Two-pass: collect definitions
    first.
  - Report-only.
- MD053 link-image-reference-definitions
  - Nodes: `definition` that is unused or duplicated. Two-pass.
  - Fixable: remove unused definitions.
- MD054 link-image-style
  - Nodes: `link` / `image` / `linkReference` / `imageReference`, classified by style. Replicate the
    style flags (`shortcut: false`, etc.). Needs the source slice for exact style.
  - Fixable for some style conversions; confirm the exact set when implementing.
- no-pipe-tables (custom)
  - Nodes: `table` / `tableRow` / `tableCell`. Ported from the existing token-based rule.
  - Fixable: convert to an HTML `<table>`, reusing the `to-html-table.ts` transform logic.
- semantic-line-breaks (custom)
  - Nodes: prose `text` inside `paragraph`, `listItem`, and `blockquote`. Walk the text and flag any
    break-point character (`,` `.` `;` `:` `?` `!`) not already followed by a line break.
  - Skips, by construction: `heading` (an ATX heading is single-line; a break would split it into heading
    plus paragraph), `code` / `inlineCode`, `link` / `image` URLs and autolinks, `html`, `table` cells,
    `definition` lines, and all MDX nodes plus their subtrees.
  - Skips, by guard within prose text: `.` in known abbreviations (`e.g.`, `i.e.`, `etc.`, `vs.`), in
    decimals or version-like tokens, and in ellipses (`...`); `,` inside numbers (`1,000`). These guards
    are why a naive character scan is insufficient (213 abbreviation occurrences exist across the corpus).
  - Fixable, add-only: insert a newline plus the block's continuation prefix (list-item indentation, or
    `>` for a blockquote) after each flagged break-point, so the broken line stays inside its block. Never
    joins or relocates an existing break, so it converges in a single pass and is idempotent.
  - Owns line breaks only, not maximum line length: a punctuation-free clause that exceeds 120 columns is
    left long (no MD013 equivalent is in scope).

## Fix application

- A rule pass collects diagnostics; those with fixes contribute offset edits.
- Within a pass, apply non-overlapping edits from highest offset to lowest, so earlier edits do not
  invalidate later offsets. Drop any edit that overlaps one already applied in the pass.
- The `semantic-line-breaks` fixes are all add-only insertions at distinct break-points, so they never
  overlap and, because the rule treats an already-broken break-point as compliant, they converge after a
  single pass without relying on the fixpoint loop.
- After applying a pass, re-parse and re-run, repeating until a pass produces no fixes or a pass cap is
  reached. This fixpoint loop is what makes `--fix` idempotent, matching oxlint behavior rather than
  markdownlint's single pass. The fixpoint loop is the one piece of the fixer worth getting right.

## CLI design

Goals: fix the two `markdownlint-cli2` failure modes (misuse and slowness) by construction.

- Accept explicit file arguments. When given a directory or no argument, use a fast internal walk that
  filters by extension (`.md`, `.mdx`), respects gitignore, and never reads files above a size cap or with
  a non-text extension. There is no dot-remap footgun.
- `--fix` applies fixes; without it the tool reports only.
- Exit non-zero when unfixed violations remain; zero when clean.
- A readable default reporter (file, line, column, rule id, message), plus a machine-readable format for CI.
- Run under Bun, with a `#!/usr/bin/env bun` shebang on the bin entry.

## Testing and acceptance

- Correctness bar: per-rule unit tests are the acceptance criterion. There is no markdownlint oracle,
  snapshot, or live comparison anywhere; `markdownlint-cli2` is too slow to run as an oracle even once in
  the dev loop. Each rule's intended behavior is defined and frozen by its own fixtures.
- Per-rule unit tests with the `@monochromatic-dev/module-test` harness (`*.unit.test.ts`), with fixtures
  covering each rule's pass, fail, and fix branches. Where useful, derive fixture cases from markdownlint's
  documented examples, but assert against our own expected output.
- `semantic-line-breaks` tests: one fixture per break-point character; one per exclusion (inline code,
  code block, link URL, abbreviation, decimal/version, ellipsis, number comma, heading-skip); and
  continuation-prefix cases inside a list item and a blockquote. Assert the add-only fix and its
  single-pass idempotency.
- MDX tests: fixtures containing JSX, ESM, and expressions, asserting that surrounding Markdown is linted,
  that MDX nodes are skipped, and that MDX constructs produce no false positives.
- Idempotency: after `--fix`, re-linting is clean and a second `--fix` is a no-op.
- Mirror the package `buildAndTest` pattern (build, then run tests).

## Package layout and conventions

- Location: `packages/cli/markdown-lint` (the tool name is a rename-friendly decision; `markdown-lint` is
  the working name). One package holds the engine and the bin; do not split a library out until a second
  consumer exists (YAGNI).
- `package.json`: workspace and catalog dependencies; a `./ts` source export so cross-package imports
  resolve to TypeScript source, not built output (repo rule); `bin` entry; license `LGPL-3.0-or-later`,
  with the MIT notice for any ported markdownlint rule logic recorded under `LICENSES/`.
- `tsdown.node.config.ts` extending `@monochromatic-dev/config-tsdown/.node.ts`.
- `mise.toml` extending the shared `build` / `lint` / `test` task templates, plus a task that lints the
  tree and a `--fix` variant, wired into the root `lint` and `format` tasks in place of the markdownlint
  tasks.
- `README.md`: rule list (including `semantic-line-breaks`), CLI usage, rule-behavior notes, and the
  deferred-work list.

## Cutover and cleanup

1.  Build the new tool; acceptance is every rule passing its own unit tests (no markdownlint oracle).
2.  Swap the root `mise.toml` `lint` and `format` tasks from `markdownlint-cli2` to the new CLI.
3.  Remove `.markdownlint-cli2.jsonc`, and drop `markdownlint` and `markdownlint-cli2` from the catalog and
    package dependencies.
4.  Retire `packages/markdownlint-plugins/no-pipe-tables` once its logic lives in the new engine; its
    `to-html-table.ts` transform is the reusable core.
5.  Close issue #231 (the build-dist-before-lint problem disappears, because the new runner is ours and can
    execute TypeScript source directly under Bun).
6.  Update `docs/troubleshooting/markdownlint-cli2.md` with a pointer to the replacement, and record the
    measured runtime of the new tool versus the old.

## Sequenced implementation steps

1.  Scaffold the package: `package.json`, `tsconfig.json`, `tsdown.node.config.ts`, `mise.toml`, README
    skeleton, bin with the Bun shebang.
2.  Parser module: `parse(source, { mdx })` returning mdast, with the gfm and conditional mdxjs extensions,
    plus an iterative tree-walk helper using an explicit stack.
3.  Rule, diagnostic, and fix types.
4.  Vertical slice: port `no-pipe-tables` as the first rule (table to HTML, reusing the transform logic),
    wire the fixpoint fixer, run the CLI on one `.md` and one `.mdx`, assert idempotency, and assert the
    `.md` diagnostics against the rule's own unit fixtures. This proves parse, MDX-skip, and the fix loop
    end to end before implementing the rest.
5.  Implement the remaining rules, one per commit, each with unit tests.
6.  Implement the `semantic-line-breaks` rule and its add-only autofix: the break-point set, the
    structural and abbreviation/decimal exclusions, and the continuation-prefix insertion; unit-test each
    and assert single-pass idempotency.
7.  Harden the CLI: the internal walk, extension and size filtering, `--fix`, exit codes, and reporters.
8.  Cutover and cleanup per the section above.

## Open decisions

- Tool and package name (`markdown-lint` is a placeholder).
- Whether to keep `no-pipe-tables` as a standalone package or fold it in (this plan recommends folding it
  in once the rule set is implemented).
- The exact GFM sub-extension set to enable, which must match the constructs the rules assume (tables for
  `no-pipe-tables`, autolink literals for MD034).
- The exact abbreviation list and the decimal/version heuristic for the `semantic-line-breaks` exclusion
  guard, to be settled against the real corpus when the rule is implemented.
