# Unified linter handover

## Status

Design interview (grilling);
no product code.
Goal (user,
2026-09-23):
replace the self-maintained Rust linter and Markdown linter with one unified linter,
written in Rust,
for both Rust and Markdown.
The objection is maintaining several linters when one would do
("My objection is maintaining multiple linters when we can only maintain 1.",
user,
2026-09-23).
Nothing is implemented until the user confirms a shared understanding.

Keep this handover current after every answer,
correction,
decision,
and verification (`AGENTS.md` HUP and DCK).

## Incumbents

- Rust linter:
   `package/linter/rust` (CLI and language server),
   `package/rust-module/rust-linter-core`,
   `package/rust-module/rust-linter-pattern`,
   and `package/rust-linter-plugin/builtin`.
- Markdown linter:
   `package/cli/markdown-lint`,
   TypeScript on Node,
   parsing with the `satteri` native engine.
- Commit-time integration:
   `package/git-policy/markdown-lint`,
   which pipes commit candidates through `markdown-lint --fix --stdin-path`.
- Out of scope:
   `package/linter/kotlin` stays on detekt.

## Decisions

Round 1 answers (user,
2026-09-23):

- Pain being removed:
   duplicated engine upkeep
   (two walkers,
   config loaders,
   directive engines,
   fixers,
   and reporters,
   in two languages)
   and the Node half
   (`markdown-lint` needs Node plus a native binary,
   cli-git spawns it per file,
   and it runs against the all-Rust direction of `doc/decision/monorepo-manager-all-rust.md`).
- Ownership:
   self-maintained.
- Implementation language:
   Rust only;
   the user has already done that vetting.
- Languages:
   Rust and Markdown only.
   Kotlin keeps detekt.
- MDX:
   stays linted at today's level,
   prose around JSX,
   ESM,
   and expressions linted,
   those nodes skipped.
- Unification model:
   "Think in Eslint."
- Parity:
   "Everything".
   Every current behavior survives,
   including stdin fixing under a virtual path
   and the exact behavior of the numbered MD rules.

Round 2 answers (user,
2026-09-23):

- Parity level (A):
   every capability survives,
   with ESLint-shaped flags,
   configuration,
   directives,
   and output formats.
  Every consumer switches in the same change,
   with no aliases for old spellings.
  What each rule reports and fixes stays exact,
   frozen by the ported tests.
- Rule plugin loading (A):
   compile-time crates plus the declarative `[[pattern]]` rules,
   which stay Rust-only.
- Configuration format (B):
   HCL,
   against the agent's TOML recommendation.
- Processors (B):
   ship both in the first version.
  Rust fences in Markdown are linted by the Rust rules,
   and rustdoc comments by the Markdown rules.
  The user rejected the agent's "noisy" inference:
   `require-rustdoc` and `max-lines` are useful on snippets,
   "to prevent markdown authors from being lazy."
- Cutover plan,
   not vetoed:
   port every TypeScript unit test,
   require identical findings and fixes from old and new over the whole repository,
   switch every consumer in one change,
   delete `package/cli/markdown-lint`,
   and point `package/git-policy/markdown-lint` at the new binary.
  The differential comparison runs with processors off,
   because processor findings are new by definition.
- No `AGENTS.md` rule for the round 1 misread:
   the user attributed it to their own phrasing.

Round 3 answers (user,
2026-09-23):

- `MD025` is off inside rustdoc (A),
   against the agent's recommendation to keep it on.
  An item may carry several level-1 sections,
   as `line_matches` in `package/rust-module/forbidden-regex/src/regex/batch.rs:337-356` does;
   repository Markdown files keep `MD025`.
- `MD040`'s fix inserts `rust` inside rustdoc (A),
   because rustdoc compiles an unlabeled fence as a doc test
   and inserting `text` would silently stop it.
  Markdown files keep the `text` fix.
- Rust fences are every `rust` or `rs` fence with any rustdoc attribute
   (`ignore`,
   `no_run`,
   `should_panic`,
   `compile_fail`,
   `edition20xx`),
   plus unlabeled fences inside rustdoc ("All").
  Syntax errors stay non-findings.
- Doc tests are linted:
   Rust fences inside rustdoc go through the Rust rules,
   two processor levels deep ("Yes.").
- Rust fences are prepared the way rustdoc prepares doc tests (A,
   after examples):
   the `# ` hidden-line marker is stripped,
   and a fragment without `fn main` is wrapped in a synthetic one
   that is never reported or counted.
  Precedent:
   `package/rust-module/rust-linter-pattern/src/fragment.rs:70-72` already wraps statements in a function body to parse them.
- Every snippet needs a `//!` opening line (A),
   the same file-level `require-rustdoc` requirement as real files.

Round 4 answers so far (user,
2026-09-23):

- HCL front end:
   reuse meow's vet,
   [`doc/audit/tech-meow-hcl-front-end-vet-2026-09-17.md`](../audit/tech-meow-hcl-front-end-vet-2026-09-17.md)
   (`hcl-edit` 0.9.7 with two local patches).
- Language server framework:
   reuse meow's vet,
   [`doc/audit/tech-meow-language-server-framework-vet-2026-09-17.md`](../audit/tech-meow-language-server-framework-vet-2026-09-17.md)
   (`lsp-server` 0.10.0 with `gen-lsp-types` 0.11.0).
- Name:
   `monochromatic-lint`,
   against the research ranking's `sumilint`.
- Configuration lookup (A):
   ESLint v10,
   the nearest configuration file to each linted file used alone,
   with `extends` for sharing.
- Default output format (B):
   `jsonl`,
   "It's easiest for the current stage."
- Core (B):
   a new core,
   "because our rust-linter-core was written in such a hurry that none of its architectural choices can be trusted."
- Inline rule configuration comments (A):
   left out.
- Issue #559 (B):
   not fixed in the TypeScript linter;
   the port replaces it.
  Decision commented on the issue.
- Snippet backlog (B):
   cut over with the snippet rules at `warn`,
   auto-fix the rustdoc blocks at cutover,
   work through the rest,
   then switch to `error`.
- Binary for cli-git:
   "Mise-managed installed in workspace."
  Mise's `cargo` backend installs only from crates.io or Git
   (<https://mise.jdx.dev/dev-tools/backends/cargo.html>,
   fetched 2026-09-23),
   so a mise task has to build and place the binary.
  The user added:
   "mise's sources/outputs support is not to be trusted",
   so freshness comes from cargo's own up-to-date check,
   not from mise task `sources` and `outputs`.
- Round 4 adoptions:
   accepted,
   except that the user asked to "Prioritize faster compile and iteration times during this early stage",
   read as one crate with modules instead of per-language plugin crates
   (confirmation asked in round 5).
- The user asked to be asked which parts of ESLint not to replicate:
   "eslint is a huge project and we don't need every knob it does."

Round 5 answers (user,
2026-09-23):

- No suppression directives at all:
   "no rules needs to be suppressed,
   ever."
  The agent's check:
   true for every current rule
   (the two Rust rules were already non-suppressible,
   the Markdown linter never had directives,
   and the repository holds no directive outside the Rust linter's own crates);
   the exception is future declarative pattern rules with legitimate per-site exceptions,
   such as the README's `no-unwrap` example or issue #469.
  Unused-directive reporting,
   the invalid-directive finding,
   and their flags go with it.
- "a later block wins" was ambiguous;
   precise merge semantics were restated in round 6.
- No `extends` now:
   "There are no consumers for it."
  The categories-as-built-in-configurations adoption depended on it and is dropped too.
- Command line (30b):
   agreed as listed,
   minus the flags made moot by later answers.
- Output (30d):
   JSONL only;
   no readable format,
   so no `--format` flag.
- Language server (30f):
   not built now,
   "as there is currently no consumers for it";
   `--lsp` goes with it.
- Rule interface (30c) and processors (30e):
   no objection,
   minus the directive items.
- One crate with modules (Q31 A).
- Walker as proposed (Q32).
- `**/*.fuzz/**` joins the fuzz exemption,
   and Rust under `doc/audit/**` is exempt from `max-lines` and `require-rustdoc` (Q33 A and A).
- Descriptive rule ids such as `markdown/heading-increment` (Q34 A).
- Configuration file:
   `monochromatic-lint.config.hcl`.
- Binary:
   "mise supports cargo-binstall",
   so the linter is published like `forbidden-strings`
   (crates.io plus GitHub release assets in cargo-binstall's default naming,
   through `.github/workflows/cargo-publish.yml`)
   and pinned in root `mise.toml` as a `cargo:` tool.
  The first publish claims the crates.io name and needs the user's go-ahead at that step.
- Incumbent tests of user-visible behavior become the specification;
   tests of internal structure are not ported (Q37).
- The model-system gap was folded into `AGENTS.md` EPR (`dc5b8a263`).

Adopted by the agent from settled answers,
not vetoed in round 3:

- HCL shape follows meow:
   OpenTofu's one-label block form,
   one block per ESLint config object,
   the label serving as ESLint's `name`.
  Parse with `hcl-edit`,
   meow's research pick for span-preserving parsing
   (`doc/planning/monorepo-manager-route-research/stack-declarative-config.md`).
- One virtual Markdown file per documented item:
   a run of `///` lines,
   a run of `//!` lines,
   or one `/** */` or `/*! */` block,
   because rustdoc renders each item's docs as its own document.
  `#[doc = ...]` attributes are not processed;
   the repository has none.
- Fixes flow through processors back to the host file,
   re-adding the comment prefix and indentation inside rustdoc.
- TypeScript fences stay unlinted:
   TypeScript is out of scope.

## Corrections

- Round 1 offered third-party engines as options,
   which the user never raised
   ("I didn't say we're migrating to something not maintained by ourselves.").
  The third-party discovery agent was stopped.
- The agent predicted Rust rules on snippets would be noise;
   the user wants them enforced.
- Round 6's block-merge description was framed as ESLint's semantics and was not.
  Checked against `eslint-rewrite` `packages/config-array/src/config-array.js:1020-1245`,
   `eslint` `lib/config/flat-config-schema.js:453-500`,
   and `lib/config/default-config.js`:
   ESLint's built-in configuration turns on no rule;
   a block without `files` applies to every file another block matches;
   `**`-style patterns count only beside a specific match;
   a file no block specifically matches is left unlinted ("unconfigured");
   and a later severity-only setting keeps earlier options.
  The description had instead assumed compiled-in rule defaults,
   linting by extension,
   and whole-setting replacement.

## Rejected

- Third-party engines (ast-grep,
   GritQL,
   Biome,
   rumdl,
   and similar):
   outside the request.
- Surface parity and compatibility aliases (round 2,
   options B and C).
- Runtime WebAssembly plugins and dynamic-library plugins.
- TOML,
   JSONC,
   and an embedded JavaScript engine for configuration.
- Processors deferred or absent.

## Evidence

- Tracked files (`git ls-files`,
   2026-09-23):
   1,223 `.md`,
   36 `.mdx`,
   390 `.rs`.
- Rust fences (info string starting `rust` or `rs`) in tracked Markdown and MDX:
   579 in 161 files.
- Rustdoc comment lines (`///` or `//!`) in tracked Rust:
   27,032 in 319 files.
- Fence lines inside rustdoc:
   1,991 open with `ts`,
   3 with `ignore`,
   2,004 bare
   (closing fences plus a handful of unlabeled openers).
- Rustdoc headings:
   6 `# Safety`,
   4 `# Example`,
   1 `# Preconditions`,
   all level 1.
- Clippy's `# Safety`,
   `# Errors`,
   and `# Panics` section detection accepts a heading of any level:
   it sets `in_heading` on `Start(Heading { .. })` and compares the heading text
   (`rust-lang/rust-clippy` `master`,
   `clippy_lints/src/doc/mod.rs:1199-1201` and `1341-1346`,
   fetched 2026-09-23).
- Rustdoc lines containing `![`:
   5;
   `#[doc = ...]` attributes:
   0.
- The Rust linter never reads parse errors:
   `package/rust-module/rust-linter-core/src/context.rs:141-153` keeps only `parse.syntax_node()`,
   and no linter crate calls `parse.errors()`.
  Syntax errors in `compile_fail` fences therefore stay non-findings.
- `monochromatic-rust-linter` is not on crates.io
   (API answer "crate `monochromatic-rust-linter` does not exist",
   2026-09-23).
- `doc/handover/markdown-lint-satteri-benchmark.md`:
   the Sätteri parser swap took the clean-corpus lint from 4150 ms to 601 ms.
- ESLint language plugins (<https://eslint.org/docs/latest/extend/languages>):
   a `Language` supplies `parse` and `createSourceCode`;
   a `SourceCode` supplies `getLoc`,
   `getRange`,
   `traverse`,
   and optionally `getDisableDirectives`,
   `getInlineConfigNodes`,
   and `applyInlineConfig`;
   configuration names a language as `plugin/language`.
- Meow's configuration is one root `meow.hcl`,
   HCL in OpenTofu's one-label block form
   (`doc/planning/monorepo-manager-from-scratch-design.md`,
   "Configuration authoring").

## In flight

- Incumbent coverage ledger:
   done,
   recorded in [`doc/planning/unified-linter-coverage-ledger.md`](../planning/unified-linter-coverage-ledger.md).
- ESLint's current model and the Sätteri Rust API:
   done,
   recorded in [`doc/research/unified-linter-eslint-model.md`](../research/unified-linter-eslint-model.md).
  It found a live offset bug in the incumbent,
   filed as <https://github.com/Aquaticat/Monochromatic/issues/559>
   and reproduced by the parent session
   (`a` + U+1FA90 + `b [x](...)` puts the link at offset 6 instead of 5).
- Naming precedent and candidate names:
   done,
   recorded in [`doc/research/unified-linter-naming.md`](../research/unified-linter-naming.md).
- Processor backlog,
   measured at `8d73b1bab` in a throwaway worktree with the incumbent rules:
  - Rust fences in Markdown:
     555 fences in 160 files (554 `rust`,
     1 `rs`,
     none in MDX,
     no rustdoc attributes,
     no hidden lines).
    With doc-test wrapping (round 3 answer),
     905 `require-rustdoc` findings remain after dropping the 538 on the synthetic `fn main`:
     551 missing `//!` lines (round 3 answer A requires them)
     and 354 item findings in 212 fences across 115 files.
    `max-lines` finds nothing.
    None is auto-fixable.
    194 fences still fail to parse (partial snippets with `...` elisions),
     so their item counts come from error recovery.
  - Rustdoc blocks:
     5,621 blocks (5,311 `///` runs,
     310 `//!` runs,
     no block comments).
    15,285 findings:
     15,279 `semantic-line-breaks`,
     5 `MD040`,
     1 `MD025` (off inside rustdoc since round 3).
    `--fix` clears all but the `MD025`.
    579 findings sit in paths the Rust rules exempt (`tests/`,
     `fuzz/`,
     and so on).
  - A from-scratch release build of the Rust linter took about 26 s.
- Whole-repository status at `0299ab679`,
   one root walk per incumbent:
  - Rust:
     151 findings in 9 files,
     exit 1,
     all outside the 17 packages with `lint:rust` tasks,
     so today's `mise run lint:rust` is green.
    `doc/audit/resharp-fuzz-2026-06-19/tool/anchor_denot.rs`:
     1 `max-lines` (541 code lines)
     and 89 `require-rustdoc`.
    `package/rust-module/forbidden-regex.fuzz`:
     61 `require-rustdoc`.
  - Rust exemptions are matched relative to the working directory:
     `package/fuzz/forbidden-strings` reports 0 from the root and 30 from inside it.
  - The built-in exemptions hide 1,132 Rust findings,
     including 4 more files over the line budget.
  - Markdown:
     46,460 findings in 95 files,
     exit 1,
     so `mise run lint` is already red;
     44,769 `semantic-line-breaks`,
     1,683 `MD034`,
     5 `MD001`,
     2 `MD054`,
     1 `no-pipe-tables`;
     46,455 auto-fixable.
    `doc/audit` holds 38,725 of them.
    Issue #559 hides 556 more in 6 files.
    Existing debt is tracked in #294.
  - Walkers differ:
     the Rust walker skips hidden directories and honours `.ignore`,
     `.git/info/exclude`,
     and the global gitignore,
     while the Markdown walker lints hidden directories such as `.agents/`
     and skips `package-paused`,
     `package-deprecated`,
     and `.out-of-scope`.
- Markdown parser crate:
   `choosing-technology` vet running,
   with a parity probe against the npm Sätteri tree over the 137 unit-test sources;
   report due at `doc/audit/tech-unified-linter-markdown-parser-vet-2026-09-23.md`.

## Open questions

Round 6 answers (user,
2026-09-23):

- Configuration lookup stays nearest-file-per-linted-file (B):
   "It's not necessarily more effort than A."
- Declarative pattern rules,
   the suggestion and dangerous fix levels,
   `--fix-suggestions`,
   and `--fix-dangerously` wait until a consumer exists (A).
- The merge question was withdrawn for a corrected restatement
   (see "Corrections").

Round 7 answers (user,
2026-09-23):

- No built-in rule defaults (A):
   the repository's `monochromatic-lint.config.hcl` turns on every rule
   and carries the exemptions `default.toml` compiles in today.
- A file is linted only when some block's `files` matches it;
   its extension picks the language;
   every block except an ignores-only block needs `files` (A).
- Rule settings merge with deepmerge-ts semantics
   (<https://github.com/RebeccaStevens/deepmerge-ts>):
   "I assume there is such a crate in Rust too."
  deepmerge-ts's README states records merge recursively,
   arrays concatenate,
   Sets union,
   Maps merge by key,
   `undefined` overwrites,
   and other values are replaced by the later one.
  crates.io search for "deepmerge" (2026-09-23) returned `deepmerge` 0.1.0
   (497 downloads,
   one release on 2025-09-10)
   and `deepmerge-derive` 0.1.0.
  A `choosing-technology` vet of merge crates against an in-linter baseline is running,
   report due at `doc/audit/tech-unified-linter-config-deep-merge-vet-2026-09-23.md`.

Round 8 answer (user,
2026-09-23):

- A rule setting is always an object,
   such as `"rust/max-lines" = { severity = "error", max = 300 }` (A),
   so a later `{ severity = "warn" }` keeps `max` under deep merge.

Round 9 answers (user,
2026-09-23):

- No flag for running one rule:
   the commit policy writes a one-rule configuration to a temporary file and passes `--config`,
   which "can already do this."
  Consequence adopted from ESLint
   (`docs/src/use/configure/configuration-files.md:92`):
   with `--config`,
   `files` and `ignores` resolve against the working directory,
   not the configuration file's directory,
   so a temporary file outside the repository still matches repository paths.
- The round 9 adoptions were agreed:
   JSONL records keep today's Rust linter shape with the rule id as `code`
   and real-file positions for virtual findings;
   one root lint task and one root format task replace `lint:rust`,
   `lint:markdown`,
   `format:markdown`,
   and the 17 package `lint:rust` tasks;
   `AGENTS.md` MXR and RDC updated at cutover;
   the incumbent packages and their registrations deleted at cutover;
   unpatched `hcl-edit` 0.9.7,
   because meow's two patches fix write-back defects and the linter only reads;
   literal-only configuration values;
   `--rule` values in the configuration file's HCL attribute syntax,
   applying to every file some configuration block matches;
   the 556 findings #559 hides treated as expected differential differences;
   `Edition::CURRENT` for Rust parsing.

Round 10,
asked 2026-09-23:

- Drop `--rule` too,
   since a temporary `--config` covers its uses and it has no consumer.

Waiting on research:
the Markdown parser crate
and the deep-merge crate.

## Next action

Collect the round 10 answer and both vets,
record them here,
ask the crate choices,
then write `doc/planning/unified-linter.md` with a draft configuration
and ask the user to confirm a shared understanding.
