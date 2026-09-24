# Unified linter design

Design for `monochromatic-lint`,
one self-maintained linter written in Rust that replaces the Rust linter and the Markdown linter.
Every decision here comes from the design interview recorded in
[`doc/handover/unified-linter.md`](../handover/unified-linter.md),
which holds the quotes,
evidence,
rejected options,
and corrections.
Incumbent responsibilities and their owners:
[`doc/planning/unified-linter-coverage-ledger.md`](unified-linter-coverage-ledger.md).

Status:
awaiting the user's confirmation of a shared understanding;
no product code exists.

## Goal and scope

- One linter instead of two:
   "My objection is maintaining multiple linters when we can only maintain 1."
   (user)
- It replaces `package/linter/rust`,
   `package/rust-module/rust-linter-core`,
   `package/rust-module/rust-linter-pattern`,
   `package/rust-linter-plugin/builtin`,
   and `package/cli/markdown-lint`,
   and removes Node from Markdown linting.
- Languages:
   Rust,
   Markdown,
   and MDX.
  Kotlin stays on detekt;
   TypeScript stays on oxlint.
- Model:
   ESLint's shape,
   minus every knob without a consumer.
- Behavior parity:
   what each current rule reports and fixes stays exact,
   frozen by ported tests.
  Command-line flags,
   configuration,
   and output follow the new design;
   every consumer switches in the same change.

## Package layout

- One crate,
   `monochromatic-lint`,
   in `package/linter/monochromatic-lint`,
   with modules instead of plugin crates,
   because the repository's no-workspace rule gives every crate its own `target` directory
   and heavy dependencies would compile once per crate.
- Binary:
   `monochromatic-lint`.
- A separate crate,
   `monochromatic-deepmerge`,
   in `package/rust-module/monochromatic-deepmerge`:
   a Rust port of deepmerge-ts,
   licensed BSD-3-Clause with upstream's notice.
- Dependencies:
  - `ra_ap_syntax`,
     pinned exactly,
     for Rust;
  - `satteri-pulldown-cmark` 0.6.3,
     `satteri-arena` 0.3.1,
     and `satteri-ast` 0.5.3,
     pinned with `=` and upgraded together
     ([`doc/audit/tech-unified-linter-markdown-parser-vet-2026-09-23.md`](../audit/tech-unified-linter-markdown-parser-vet-2026-09-23.md));
  - `hcl-edit` 0.9.7,
     unpatched,
     for configuration
     ([`doc/audit/tech-meow-hcl-front-end-vet-2026-09-17.md`](../audit/tech-meow-hcl-front-end-vet-2026-09-17.md);
     its two patches fix write-back only);
  - `monochromatic-deepmerge` for rule-setting merges.
- Build-time C or assembly inside dependencies is allowed
   (`psm`,
   pulled in by Sätteri through `stacker`).
- Development builds skip fat LTO and `codegen-units = 1`;
   published release binaries keep the optimized profile.

## Files and languages

- The walker reads `.gitignore` files,
   `.ignore` files,
   `.git/info/exclude`,
   and the global gitignore,
   includes hidden directories except `.git`,
   and picks only `.rs`,
   `.md`,
   and `.mdx` files.
- ESLint's default ignores (`.git`,
   `node_modules`) are built in;
   repository-specific trees such as `package-paused` are ignored through the repository configuration.
- A file's extension chooses its language:
   `.rs` is Rust,
   `.md` is Markdown,
   `.mdx` is MDX.
- A file is linted only when at least one configuration block's `files` pattern matches it.

## Processors

Processors are always on and not configurable.
Each produces virtual files that configuration targets by path,
and every finding and fix maps back to the host file.

- Rust fences in Markdown and MDX:
   every fence whose info string starts with `rust` or `rs`,
   with any rustdoc attribute (`ignore`,
   `no_run`,
   `should_panic`,
   `compile_fail`,
   `edition20xx`).
  Virtual path:
   `<host>/<ordinal>.rs`,
   such as `doc/x.md/0.rs`.
- Rustdoc comments in Rust:
   each documented item's doc comment is one virtual Markdown file:
   a run of `///` lines,
   a run of `//!` lines,
   or one `/** */` or `/*! */` block.
  `#[doc = ...]` attributes are not processed.
  Virtual path:
   `<host>/<first line>.md`,
   such as `src/a.rs/42.md`.
- Doc tests:
   Rust fences inside rustdoc,
   two levels deep,
   including fences with no language,
   which rustdoc compiles as Rust.
  Virtual path:
   `<host>/<first line>.md/<ordinal>.rs`.
- Rust snippets are prepared the way rustdoc prepares doc tests:
   the `# ` hidden-line marker is stripped,
   leading `//!` lines stay at the top,
   and a fragment without `fn main` is wrapped in a synthetic one
   that is never reported or counted.
- Every Rust snippet needs a `//!` opening line,
   the same file-level `require-rustdoc` requirement as real files.
- Syntax errors are not findings,
   so `compile_fail` fences are linted for whatever parses.
- Fixes inside rustdoc re-add the comment prefix and indentation.
- TypeScript fences stay unlinted.

A glob such as `**/*.rs` matches virtual Rust files as well as real ones,
and `**/*.md` matches rustdoc virtual files;
configuration uses `ignores` such as `**/*.md/**` when a block must reach real files only.

## Configuration

- File name:
   `monochromatic-lint.config.hcl`.
- Lookup:
   for each linted file,
   the nearest configuration file in its directory or an ancestor is used alone;
   files are never merged.
  `files` and `ignores` resolve against that file's directory.
- `--config <path>` skips lookup,
   and its patterns resolve against the working directory,
   so a temporary file outside the repository still matches repository paths.
- No built-in rule defaults:
   a rule runs only if the configuration turns it on.
- Shape:
   one-label HCL blocks,
   as meow uses,
   each `config "<name>" { }` with `files`,
   `ignores`,
   and `rules`.
- A block with only `ignores` removes matching files from linting entirely.
- Every other block needs `files`;
   it applies to a file when one `files` pattern matches and no `ignores` pattern does.
- A rule setting is always an object:
   `"rust/max-lines" = { severity = "error", max = 300 }`,
   with severity `off`,
   `warn`,
   or `error`.
- For each file,
   the `rules` objects of every applying block merge in block order in one deepmerge-ts call:
   objects merge key by key,
   arrays concatenate,
   and any other value,
   or a value whose type differs from the first,
   takes the last one.
  So a later `{ severity = "warn" }` keeps an earlier `max`,
   and a later `exclude` list adds to an earlier one.
- Values are literals only;
   `null`,
   duplicate keys,
   variables,
   functions,
   and expressions are configuration errors.
- Rule options have per-rule defaults,
   such as `max = 300` for `rust/max-lines`.

## Rules

Rust:

- `rust/max-lines`:
   code lines per file,
   blank and comment-only lines excluded,
   option `max` (default 300).
- `rust/require-rustdoc`:
   a doc comment on every documentable item,
   public and private,
   and on the file itself,
   with today's hardcoded cxx-qt carve-out.

Markdown (numbers in each rule's documentation):

- `markdown/heading-increment` (MD001).
- `markdown/commands-show-output` (MD014),
   fixable.
- `markdown/no-duplicate-heading` (MD024).
- `markdown/single-h1` (MD025).
- `markdown/no-trailing-punctuation` (MD026),
   fixable.
- `markdown/no-bare-urls` (MD034),
   fixable.
- `markdown/no-emphasis-as-heading` (MD036).
- `markdown/fenced-code-language` (MD040),
   fixable:
   inserts `text`,
   or `rust` inside rustdoc,
   where an unlabeled fence is a doc test.
- `markdown/link-image-reference-definitions` (MD053),
   fixable.
- `markdown/link-image-style` (MD054),
   fixable.
- `markdown/no-pipe-tables`,
   fixable to an HTML `<table>`.
- `markdown/semantic-line-breaks`,
   fixable,
   add-only.
- `markdown/lfs-image-url`,
   fixable,
   option `exclude` (gitignore-syntax patterns).

Processing findings from the core:

- a file that fails to parse,
   an MDX error,
   or a parser panic caught with `catch_unwind`;
- a fix refused because it would empty a non-empty file.

No rule can be suppressed:
there are no directive comments.

## Fixes

- Each finding carries at most one fix,
   applied all or nothing;
   it may hold several edits,
   and overlapping edits are rejected.
- `--fix` applies fixes in up to 10 passes,
   re-parsing each pass,
   stopping early on a circular fix,
   then lints once more.
- Edits are localized byte ranges;
   untouched bytes stay identical.
- Writes are atomic and keep the file mode.

## Command line

- Paths (default `.`),
   `--config`,
   `--fix`,
   `--stdin` with `--stdin-filename`,
   `--max-warnings`,
   `--quiet`,
   `--silent`,
   `--print-config`,
   `--init`,
   `--rules`,
   `--concurrency`,
   `--ignore-pattern`,
   `--ignore-path`,
   `--no-ignore`,
   `--no-error-on-unmatched-pattern`,
   `--debug`.
- `--stdin --fix` prints the fixed source to stdout and findings to stderr,
   as `markdown-lint` does today for cli-git.
- Exit codes:
   0 clean,
   1 findings that fail the run,
   2 setup or usage error.

## Output

- JSONL only,
   on stdout,
   one record per finding,
   in today's Rust linter shape (`message`,
   `code`,
   `severity`,
   `causes`,
   `filename`,
   `labels[].span`,
   `related`,
   optional `url` and `help`),
   with the rule id in `code`.
- Findings from virtual files report the host file and host positions.
- A clean run prints nothing.

## Distribution and consumers

- `monochromatic-lint` and `monochromatic-deepmerge` publish through `.github/workflows/cargo-publish.yml`
   to crates.io with GitHub release assets in cargo-binstall's default naming,
   like `forbidden-strings`.
  The first publish claims both crate names and waits for the user's go-ahead.
- Root `mise.toml` installs the binary as `"cargo:monochromatic-lint"` through cargo-binstall;
   `mise.lock` pins the version.
  Linter changes reach the repository through a release.
- Root tasks:
   one lint task in the `lint` aggregate and one `--fix` task in the `format` aggregate
   replace `lint:rust`,
   `lint:markdown`,
   `format:markdown`,
   and the 17 package `lint:rust` tasks.
  Rust linting thereby joins `mise run lint`,
   which it never did before.
- `package/git-policy/markdown-lint` keeps its policy and calls `monochromatic-lint`:
   it writes a one-rule configuration for `markdown/lfs-image-url` to a temporary file created with a proper temporary-file call,
   passes `--config`,
   `--stdin`,
   `--stdin-filename`,
   and `--fix`,
   and reads JSONL.

## Draft repository configuration

```hcl
# monochromatic-lint.config.hcl
config "ignored-trees" {
  ignores = ["package-paused/", "package-deprecated/", ".out-of-scope/"]
}

config "rust" {
  files = ["**/*.rs"]
  rules = {
    "rust/max-lines"       = { severity = "error", max = 300 }
    "rust/require-rustdoc" = { severity = "error" }
  }
}

# Exemptions for real Rust files only; snippets inside Markdown stay linted.
config "rust-exemptions" {
  files = [
    "**/tests/**/*.rs", "**/*_tests.rs", "**/fuzz/**/*.rs", "**/*.fuzz/**/*.rs",
    "**/build.rs", "**/fixture/**/*.rs", "**/test-fixture/**/*.rs", "**/invalid/**/*.rs",
    "doc/audit/**/*.rs",
  ]
  ignores = ["**/*.md/**", "**/*.mdx/**"]
  rules = {
    "rust/max-lines"       = { severity = "off" }
    "rust/require-rustdoc" = { severity = "off" }
  }
}

config "markdown" {
  files = ["**/*.md", "**/*.mdx"]
  rules = {
    "markdown/heading-increment"                 = { severity = "error" }
    "markdown/commands-show-output"              = { severity = "error" }
    "markdown/no-duplicate-heading"              = { severity = "error" }
    "markdown/single-h1"                         = { severity = "error" }
    "markdown/no-trailing-punctuation"           = { severity = "error" }
    "markdown/no-bare-urls"                      = { severity = "error" }
    "markdown/no-emphasis-as-heading"            = { severity = "error" }
    "markdown/fenced-code-language"              = { severity = "error" }
    "markdown/link-image-reference-definitions"  = { severity = "error" }
    "markdown/link-image-style"                  = { severity = "error" }
    "markdown/no-pipe-tables"                    = { severity = "error" }
    "markdown/semantic-line-breaks"              = { severity = "error" }
    "markdown/lfs-image-url"                     = { severity = "error", exclude = ["package/ssg/"] }
  }
}

# Rustdoc keeps level-1 sections such as `# Safety` and `# Examples`.
config "rustdoc" {
  files = ["**/*.rs/*.md"]
  rules = {
    "markdown/single-h1" = { severity = "off" }
  }
}

# Snippet backlog at cutover: warn until the 905 findings are fixed, then delete this block.
config "snippet-burn-down" {
  files = ["**/*.md/*.rs", "**/*.mdx/*.rs"]
  rules = {
    "rust/require-rustdoc" = { severity = "warn" }
    "rust/max-lines"       = { severity = "warn" }
  }
}
```

## Build order

1.  `monochromatic-lint` skeleton:
     command line,
     walker,
     JSONL output,
     exit codes,
     fix loop,
     processing findings.
2.  Rust language and its two rules,
     with the incumbent's user-visible tests ported as the specification.
3.  Markdown and MDX through Sätteri with explicit feature flags
     (never `DEFAULT_OPTIONS`),
     byte offsets with a 3-byte adjustment after a byte order mark,
     no astral correction,
     and the 13 rules with the 137 TypeScript tests ported.
4.  Processors and fix mapping.
5.  Configuration:
     HCL parsing,
     lookup,
     block matching.
    Rule-setting merge lands with `monochromatic-deepmerge`,
     which waits for the user's deepmerge-ts fork and its fuller tests;
     upstream deepmerge-ts 8.0.2 defines the semantics,
     and a fork test that disagrees is decided case by case.
    No interim merge code is written.
6.  Differential comparison against both incumbents over the whole repository,
     processors off,
     expecting identical findings and fixes
     except the findings issue #559 hides from the TypeScript linter.
7.  Cutover in one change,
     after the user approves the first publish:
     publish,
     install through mise,
     switch every consumer,
     update `AGENTS.md` MXR and RDC,
     delete the five incumbent packages and their registrations
     (pnpr configuration,
     file-enforcer configuration,
     `cargo-publish.yml`),
     auto-fix the rustdoc blocks,
     and add the snippet burn-down block.
8.  Fix the 905 snippet findings,
     then delete the burn-down block.

## Deferred until a consumer exists

- `extends` and sharing between configuration files.
- Categories and built-in shareable configurations.
- A language server.
- Declarative pattern rules,
   the suggestion and dangerous fix levels,
   and their flags.
- Directive comments of any kind,
   including rule-setting comments.
- Output formats other than JSONL.
- `--rule`,
   `--format`,
   `--lsp`,
   and a flag for running one rule.
- `deepmergeCustom` customizers in the deepmerge port.
- A parse time budget.

## Not replicated from ESLint

`language`,
`languageOptions`,
`settings`,
`plugins`,
`processor`,
`basePath`,
per-block `extends`,
`linterOptions`,
numeric severities,
runtime plugins,
shareable configuration packages,
a public library API,
bulk suppressions,
caching,
`--fix-type`,
`--fix-dry-run`,
`--no-config-lookup`,
`--inspect-config`,
`--env-info`,
`--mcp`,
`--flag`,
`--stats`,
`--exit-on-fatal-error`,
`--output-file`,
color flags,
rule `meta.type`,
message-ID placeholders,
JSON Schema option validation,
deprecation metadata,
selectors,
code-path and scope analysis,
`<!-- eslint-skip -->`,
comment injection into fences,
and fence `filename=` metadata.

## Incumbent defects not carried over

- A multi-edit fix applied partly.
- Exemptions matched relative to the working directory instead of the configuration.
- The language server ignoring directives and ignore patterns.
- `run_cli_from_env` dropping the order of `-A`,
   `-W`,
   and `-D`.
- The advertised but unbuilt `--debug=timings`.
- The double offset correction after astral characters (#559).

## Risks

- Sätteri:
   one dominant maintainer,
   breaking minor releases about every three weeks,
   two private vulnerability reports unacknowledged until bruits/satteri#306,
   invalid MDX that can take minutes to parse,
   and one release panic site.
  The parity harness gates every upgrade.
- Build cost:
   about 28.5 s for a clean dev build of the Markdown side alone.
- The configuration merge depends on the deepmerge-ts fork's timeline.
- Rust linting joining `mise run lint` exposes the Rust files no package task covered,
   handled by the `*.fuzz` and `doc/audit` exemptions.
- `mise run lint` is already red on existing Markdown debt (#294);
   the migration does not change that.

## Licences

- `monochromatic-deepmerge`:
   BSD-3-Clause,
   with deepmerge-ts's notice (Copyright (c) 2021,
   Rebecca Stevens).
- `monochromatic-lint`:
   LGPL-3.0-or-later,
   carrying markdownlint's MIT notice for the rule logic ported from it,
   which the TypeScript package claims to record but does not.
