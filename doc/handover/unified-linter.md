# Unified linter handover

## Status

Design interview (grilling);
no product code.
Goal (user,
2026-09-23):
replace the self-maintained Rust linter and Markdown linter with one unified linter,
written in Rust,
for both Rust and Markdown.
The linter stays self-maintained;
the defect is having two of them.
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

## Corrections

- Round 1 offered third-party engines as options.
  The user never raised them:
   "I didn't say we're migrating to something not maintained by ourselves."
  The agent had read "all maintained by ourselves.
  That's not good."
  as objecting to self-maintenance,
  while the named remedy,
   a unified linter,
   changes the count of linters,
   not their ownership.
  The third-party discovery agent was stopped.

## Rejected

- Third-party engines (ast-grep,
   GritQL,
   Biome,
   rumdl,
   and similar):
   outside the request.

## Evidence

- Tracked files (`git ls-files`,
   2026-09-23):
   1,223 `.md`,
   36 `.mdx`,
   390 `.rs`.
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

- Incumbent coverage ledger
   (every responsibility,
   consumer,
   size,
   churn,
   and related doc):
   research agent running.
- ESLint's current model in detail,
   plus the `satteri` Rust crate API:
   research agent running.
- Naming precedent and candidate names:
   research agent running.

## Open questions

Round 2,
asked 2026-09-23:

- Parity level:
   capability parity with ESLint-shaped surfaces,
   or each incumbent's flags,
   directives,
   and output kept as they are.
- Rule plugin loading:
   compile-time crates,
   runtime WebAssembly plugins,
   or dynamic libraries.
- Configuration format:
   TOML,
   HCL,
   JSONC,
   or an embedded JavaScript engine.
- Processors for embedded code
   (Rust fences in Markdown,
   Markdown in rustdoc comments).
- Cutover plan,
   adopted unless vetoed:
   port every TypeScript unit test,
   require identical findings and fixes from old and new over the whole repository,
   switch every consumer in one change,
   then delete `package/cli/markdown-lint`.
- Proposed `AGENTS.md` rule for the round 1 misread.

Waiting on research:
evolve `rust-linter-core` or start a new core,
configuration lookup semantics,
output formats and the default,
directive spelling,
how cli-git finds the binary,
the Markdown parser crate,
and the name.

## Next action

Collect round 2 answers and the research results,
record them here,
then ask round 3.
