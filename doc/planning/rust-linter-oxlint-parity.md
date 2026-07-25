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
Status: ANSWERED 2026-07-25.
In scope: autofix pipeline, custom plugin loading, language server.
Out of scope: semantic and type-aware analysis.
Consequence: the `Rule` trait must carry fix edits from the start,
rule registration needs a runtime seam rather than `all_rules()`,
and diagnostics must be servable incrementally over LSP.
No dependency on `ra_ap_hir`, `ra_ap_ide`, or a rustc driver;
`ra_ap_syntax` stays the only parser.

### D2. Inline disable directives

`README.md:66` and `README.md:132` state there is deliberately no inline
suppression, and `AGENTS.md` MXL and RDC say never disable those two rules.
oxlint ships `--report-unused-disable-directives` as a headline feature, and
`AGENTS.md` LN5/LN6 do allow justified `oxlint-disable-next-line` for TypeScript.

Measured usage:
1258 `oxlint-disable` occurrences across 624 TypeScript files,
1179 of them carrying a `--` justification;
`package/config/oxlint/src/config-base.ts` sets
`reportUnusedDisableDirectives: 'warn'` alongside `denyWarnings: true`.

Status: ANSWERED 2026-07-25.
Chosen: build the full directive mechanism plus
`--report-unused-disable-directives` and its severity variant,
and have each rule declare its own suppressibility.
`max-lines` and `require-rustdoc` declare themselves non-suppressible, so a
directive aimed at either is itself reported.
No config key, override, or nested config can flip that declaration,
which keeps MXL, MXR and RDC literally true.

Settled alongside it, not asked:

- Directives are comments, not attributes.
  Verified: `#[allow(monochromatic::max_lines)]` fails on stable with
  `error[E0710]: unknown tool name`, and the suggested fix
  `#![register_tool(monochromatic)]` is nightly-only.
- A justification after `--` is mandatory;
  a directive without one is itself a violation.
  `AGENTS.md` LN5 already requires this and 94 percent of existing TypeScript
  directives comply.
  This is a superset of oxlint's behaviour, not parity with it.

### D3. Config file format and location

`AGENTS.md` AD2 prefers TypeScript config when logic is needed, but a Rust
binary cannot execute TypeScript;
oxlint itself gates TS configs behind "requires running via Node.js".
oxlint gets away with TypeScript configs only because oxlint itself runs inside
Node: `node_modules/oxlint/bin/oxlint` is a Node shim, and the checked-in
`oxlint.config.ts` is read natively by that Node process.
A standalone Rust binary has no such host.

In-repo precedent checked (WC2):
`file-enforcer.config.ts` already owns generated `CLAUDE.md`, `AGENTS.md`
mirrors, `mise.toml`, and `package/linter/rust/Cargo.toml`,
so a generated root config is an established pattern.
Root config formats already in use:
`*.config.ts` (`oxlint`, `cli-git`, `file-enforcer`, `playwright`),
`*.toml` (`clippy`, `bunfig`, `mise`),
and `*.json` (`dprint`, `node.config`, `socket`, `tsconfig`).

Status: ANSWERED 2026-07-25.
Chosen: TOML, read natively by the Rust binary, for now.
Follow-up tracked in issue #400,
"Revisit rust-linter config format after oxlint parity lands
(Pkl, JSONC, or rendered TypeScript)".

Pkl was considered and set aside for this pass.
Facts that shaped that:

- The repo deliberately retired Pkl in issue #357,
  "build(cli-git): retire hk and Pkl after policy parity",
  which removed root `hk.pkl`, the `apple/pkl` mise tool declaration, and
  `.idea/pklSettings.xml`.
  No `pkl` binary is installed on this machine and `mise.toml` declares none.
- Rust cannot embed a Pkl evaluator.
  `rpkl` (0.8.0, June 2026, 34 percent doc coverage) spawns `pkl server` and
  exchanges MessagePack over stdio.
  Pkl native binaries cover macOS amd64/aarch64, Linux amd64/aarch64,
  Alpine amd64, and Windows amd64.
  So "config is Pkl" would have meant either a generated-JSON build step or a
  runtime dependency on the `pkl` executable.

Consequences:

- The binary stays standalone: no Node, no JVM, no `pkl`, no generated artifact.
- oxlint's published `configuration_schema.json` is not reusable as-is;
  the TOML tree has to express the same concepts
  (`rules`, `categories`, `overrides`, `extends`, `ignorePatterns`, `options`)
  in TOML's array-of-tables shape.
- Pattern rules benefit: TOML multi-line literal strings avoid the escaping
  that JSON would have forced.

### D4. Plugin mechanism

Status: ANSWERED 2026-07-25.
Chosen: compile-time Rust rule crates PLUS a declarative pattern language
evaluated from the config.
Neither path loads code at runtime.

Rejected, with the evidence that rejected each:

- dylint (`trailofbits/dylint`).
  Requires `#![feature(rustc_private)]` and pins each lint library to a specific
  nightly toolchain, then rebuilds the linted package with that same toolchain.
  This repo has no `rust-toolchain.toml`, and
  `package/linter/rust/Cargo.toml:56` records verification on stable 1.96.0.
- JS/TypeScript runtime plugins, the literal oxlint design.
  `node_modules/oxlint/bin/oxlint` is a three-line Node shim over napi bindings
  (`@oxlint/binding-*`), and `dist/plugins.js` loads JS plugins into that same
  Node process, passing the AST over shared `ArrayBuffer`/`Uint8Array` buffers.
  Copying it means an AST serialization protocol, a runtime lifecycle, and a
  Node dependency inside a standalone Rust binary.
  `doc/troubleshooting/oxlint-js-plugin-lazy-child-enomem.md` records this
  repo already hitting a 276-second run and `spawn ENOMEM` from that design.
- WASM plugins via wasmtime or extism.
  Same serialization boundary as the JS option without matching the repo's
  authoring language;
  `rg` for `wasmtime|extism|wasm-bindgen|wasm32` across the repo's TOML and JSON
  finds nothing outside `node_modules`.

Consequences:

- `plugins` in the config names compiled-in rule crates and namespaces their
  rule ids as `plugin/rule-name`, matching oxlint's `eslint(no-debugger)` code
  shape in JSON output.
- The config format must be able to express pattern rules, which raises the
  stakes on D3.
- `AGENTS.md` SYB applies to the pattern language:
  it must not become an invented comment-string DSL for relations the syntax
  tree already expresses.

### D6. Pattern-rule language

Status: ANSWERED 2026-07-25.
Chosen: patterns are written as Rust snippets with metavariables, matched
structurally against the `ra_ap_syntax` CST, in the style of ast-grep and
semgrep.
Metavariables are encoded as ordinary identifiers (`META_X`) so the snippet
parses as valid Rust;
ast-grep's `$X` spelling is not assumed to parse under `ra_ap_syntax` and was
not adopted.
A `fix` snippet in the same form supplies the rewrite, so pattern rules
participate in the autofix pipeline decided in D1.

Accepted shape:

```toml
[[pattern]]
id      = "no-unwrap"
match   = "META_X.unwrap()"
fix     = 'META_X.expect("TODO: explain")'
message = "unwrap() panics; name the invariant"

not-inside = """
#[test]
fn META_F() {}
"""
```

This is the SYB-compliant answer:
the pattern is written in the destination language rather than in an invented
DSL describing it.

Available for the text-predicate half where one is needed:
`package/rust-module/forbidden-regex`,
the in-house linear-time engine with fuzz and bench harnesses,
already consumed by `package/cli/forbidden-strings` over a path dependency.
Using it rather than `regex` satisfies RG2 and RG3 by construction.

### D5. Crate layout and delivery increments

Constrained by MXR (300 code lines per `.rs`, no disable) and RDC, against a
crate whose current comment convention costs roughly 150 lines per predicate.
Status: not yet asked.
