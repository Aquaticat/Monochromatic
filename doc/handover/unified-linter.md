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

Adopted by the agent from settled answers,
open to veto (round 3):

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
- ESLint's current model in detail,
   plus the `satteri` Rust crate API:
   research agent running.
- Naming precedent and candidate names:
   research agent running.
- Processor backlog:
   what the incumbent rules report today on extracted Rust fences and rustdoc blocks,
   measured in a throwaway worktree:
   agent running.

## Open questions

Round 3,
asked 2026-09-23:

- Rust fence preprocessing:
   rustdoc doctest semantics
   (hidden `# ` lines,
   `fn main` wrapping)
   or the raw fence body.
- Which fences are Rust:
   `rust` and `rs` with any attributes,
   including `compile_fail`,
   and unlabeled fences inside rustdoc.
- Nested processing:
   whether Rust fences inside rustdoc are linted by the Rust rules.
- `MD025` inside rustdoc,
   where rustdoc's section convention uses level-1 headings.

Waiting on research:
evolve `rust-linter-core` or start a new core,
configuration lookup semantics,
output formats and the default,
directive spelling,
how cli-git finds the binary,
the Markdown parser crate,
the name,
and how to roll out processor findings that exist today.

## Next action

Collect round 3 answers and the research results,
record them here,
then ask round 4.
