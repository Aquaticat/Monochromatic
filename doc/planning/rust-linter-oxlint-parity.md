# Rust linter: oxlint feature parity

Working document for the grilling session started 2026-07-25.
Goal stated by the user:
make `package/linter/rust` (`monochromatic-rust-linter`) feature-parity with oxlint,
where "feature" means linter capabilities,
explicitly not the number of rules.

Status: decisions still being collected.
Nothing here is ratified until the user accepts;
promote to `doc/decision/` only then (DRR).

## Measured starting state

`package/linter/rust`, 4386 lines across 13 files (`wc -l`), of which the
non-test implementation is `src/{cli,config,context,diagnostic,lib,main,rule}.rs`
plus `src/builtin/{max_lines,require_rustdoc}.rs`.
Comment density is high:
`src/config.rs` spends 317 lines on two path predicates because of the
`dum-dum-non-ts` `// What:` / `// Why:` convention.

What exists today:

- CLI: positional paths plus `--max <N>`, `--help`, `--version` (clap).
- Two rules, hardcoded on, hardcoded at error severity:
  `max-lines`, `require-rustdoc`.
- `all_rules()` in `src/rule.rs` returns a fixed `Vec<Box<dyn Rule>>`.
  The README calls the linter "pluggable";
  there is no plugin mechanism of any kind.
- Exemptions are hardcoded Rust predicates in `src/config.rs`
  (`max_lines_exempt`, `missing_rustdoc_exempt`),
  duplicated once per rule.
- Discovery: `ignore::WalkBuilder::new(..).build()`, sequential, gitignore-aware.
- Output: one hardcoded line format,
  `path:LINE: error[rule]: message`, printed to stdout.
- Exit codes: 0 clean, 1 violations, 2 fatal.
- No config file, no severity control, no categories, no suppression,
  no autofix, no output formats, no parallelism, no LSP, no semantic analysis.

Repo footprint the linter serves:
310 tracked `.rs` files across 15 Cargo packages,
invoked per package through the `lint:rust` fanout in the root `mise.toml`.

## Measured oxlint feature surface

Installed version: 1.75.0 (`oxlint --version`).
Sources: `oxlint --help`, `node_modules/oxlint/configuration_schema.json`,
and a real `--format json` run.

Config file top-level keys (`configuration_schema.json`):
`$schema`, `categories`, `env`, `extends`, `globals`, `ignorePatterns`,
`jsPlugins`, `options`, `overrides`, `plugins`, `rules`, `settings`.

`options` holds `denyWarnings`, `maxWarnings`, `reportUnusedDisableDirectives`.
`overrides` entries take `files`, `excludeFiles`, `rules`, `env`, `globals`, `plugins`.
`categories` are `correctness`, `suspicious`, `pedantic`, `perf`, `style`,
`restriction`, `nursery`, each set to an `AllowWarnDeny` value.
Rule entries are either a bare severity or `[severity, options]`.

CLI surface beyond config:
`-A/-W/-D` accumulation over rules and categories,
`--fix`, `--fix-suggestions`, `--fix-dangerously`,
`--ignore-path`, `--ignore-pattern`, `--no-ignore`,
`--quiet`, `--deny-warnings`, `--max-warnings`,
`--format` with `checkstyle`, `default`, `agent`, `github`, `gitlab`, `json`,
`junit`, `sarif`, `stylish`, `unix`,
`--debug=files,timings`, `--silent`, `--no-error-on-unmatched-pattern`,
`--threads`, `--print-config`, `--rules`, `--init`, `--lsp`,
`--disable-nested-config`, `--type-aware`, `--type-check`,
`--report-unused-disable-directives[-severity]`,
`--config`, `--tsconfig`.

JSON diagnostic shape, captured from a real run:

```json
{ "diagnostics": [{ "message": "...", "code": "eslint(no-debugger)",
  "severity": "error", "causes": [], "url": "https://...", "help": "...",
  "filename": "/abs/path", "labels": [{ "span": { "offset": 27, "length": 9,
  "line": 2, "column": 15 } }], "related": [] }],
  "number_of_files": 1, "number_of_rules": 479, "threads_count": 16,
  "start_time": 0.283 }
```

Which oxlint features this repo actually leans on
(`package/config/oxlint/src/config-base.ts` and `overrides.ts`):
`categories`, `env`, `ignorePatterns`, `options`, `plugins`, `rules`, `settings`,
and a large glob-driven `overrides` list.
Those overrides are exactly the mechanism the Rust linter hardcodes:
`eslint/max-lines` is turned off for `**/fixture.*`, `**/*.config.*`,
`**/canary-lint/**`, `**/*.{test,bench}.ts`.

Four custom oxlint plugins are authored in-repo under `package/oxlint-plugin/`
(`no-restricted-syntax`, `prefer-readonly-parameter-type`, `stylistic`, `tsdoc`),
so third-party rule authoring is load-bearing for TypeScript.

Existing consumer tooling that a shared diagnostic schema would unlock for free:
`package/dev-script/task-util/src/oxlint-wrapper.ts` (281 lines),
`oxlint-augment.ts` (683), `oxlint-guidance.ts` (140), `oxlint-fix-loop.ts`.

## Adopted without asking

These have one defensible answer given the target, so they are in scope by
default rather than by decision (QGR):

- Severity levels per rule (`allow`/`warn`/`deny`), and rule options as
  `[severity, options]`.
- `categories` with the same seven names, plus `-A/-W/-D` left-to-right
  accumulation over rules and categories.
- `overrides` by glob with `files`/`excludeFiles`/`rules`,
  `ignorePatterns`, `extends`, nested config discovery,
  `--config`, `--disable-nested-config`.
- `--ignore-path`, `--ignore-pattern`, `--no-ignore`.
- `--quiet`, `--deny-warnings`, `--max-warnings`, `--silent`,
  `--no-error-on-unmatched-pattern`.
- `--format` for every format oxlint ships, JSON matching the schema above so
  the existing wrapper tooling works unchanged.
- `--threads` and parallel walking
  (`WalkBuilder::build_parallel()`, already a dependency).
- `--print-config`, `--rules`, `--init`, `--debug=files,timings`.
- Summary line and exit-code semantics.
- A rich default renderer with source snippet and span labels.

## Open decisions

Recorded as they are answered.

### D1. Scope of the four expensive subsystems

Custom plugin loading, autofix, LSP, semantic/type-aware analysis.
Status: asked.

### D2. Inline disable directives

`README.md:66` and `README.md:132` state there is deliberately no inline
suppression, and `AGENTS.md` MXL and RDC say never disable those two rules.
oxlint ships `--report-unused-disable-directives` as a headline feature, and
`AGENTS.md` LN5/LN6 do allow justified `oxlint-disable-next-line` for TypeScript.
Status: not yet asked.

### D3. Config file format and location

`AGENTS.md` AD2 prefers TypeScript config when logic is needed, but a Rust
binary cannot execute TypeScript;
oxlint itself gates TS configs behind "requires running via Node.js".
In-repo precedent: `oxlint.config.ts` and `CLAUDE.md` are generated by
file-enforcer, so a TS source of truth compiled to JSON is already the pattern.
`WC2` requires checking `file-enforcer.config.ts` before adding a root file.
Status: not yet asked.

### D4. Plugin mechanism

Only live if D1 keeps plugin loading.
Candidates to research before presenting (EPR):
compile-time registry, Cargo features, dylint-style cdylib,
WASM host, declarative pattern rules over `ra_ap_syntax`.
Status: not yet asked.

### D5. Crate layout and delivery increments

Constrained by MXR (300 code lines per `.rs`, no disable) and RDC, against a
crate whose current comment convention costs roughly 150 lines per predicate.
Status: not yet asked.
