# Would a Bazel migration drastically improve developer experience?

## Research status

- Status:
   complete for the question asked;
   inference from measured repository shape plus ruleset source,
   not a measured before-and-after pilot
- Date:
   2026-09-16
- Method:
   `mise tasks --all --hidden --json`,
   `gh run list`,
   `git shortlog`,
   existing timing records in `doc/planning/`,
   shallow clones under `~/temp/agent/<repo>-2026-09-16`
   (rules_js `3f5022d`,
   rules_ts `bfbf401`,
   rules_lint `4cb8c45`,
   rules_rust `dd2b107`,
   rules_kotlin `02f96a1`,
   rules_android `7bd7cbb`)
- Product changes:
   none
- Scope limit:
   this is not a `choosing-technology` selection.
   No discovery saturation ran and no build tool is recommended for adoption.

## Answer

No drastic improvement is expected.
Bazel would close one real gap,
the absence of incremental task skipping,
but the measured slow paths are not graph-shaped,
the repository has one active author and no repo-wide CI build,
and several load-bearing tools have no maintained Bazel integration.

## Measured repository facts

- `mise tasks --all --hidden --json` reports 1,825 tasks:
   0 declare `sources`,
   0 declare `outputs`,
   41 declare `depends`.
  Every invocation re-executes;
   nothing is skipped as fresh.
- Root fanout in `mise.no-env.toml` is repository-owned Node code,
   because the native Mise monorepo glob aborted aggregates mid-flight.
- `git shortlog --since=2025-09-16` attributes 8,699 commits to one author,
   36 to a test fixture identity,
   and 6 to `github-actions[bot]`.
- The 200 most recent non-skipped,
   non-cancelled GitHub Actions runs have per-workflow median durations from 23 to 303 seconds.
  No workflow builds or tests the whole repository.
- Workspace packages import each other's TypeScript source through the `/ts` subpath
   (`doc/decision/workspace-ts-source-imports.md`),
   so there are few built-output edges between packages.
- Recorded slow paths:
  - warm whole-repo `lint:oxlint` reduced from 3m04.7s to about 59s,
     (`doc/planning/oxlint-warm-sweep-attribution.md`);
     an earlier 184-second warm sweep spent 171 seconds inside `prefer-readonly-parameter-types`
     (`doc/planning/issue-486-workspace-ts-source-imports.md`);
  - one Rust crate's `cargo check` at 503 seconds
     (`doc/handover/forbidden-strings-runtime-precompilation.md`).
- Migration surface:
   178 Mise configuration files with 9,422 lines,
   176 `package.json` files,
   19 `Cargo.toml` files,
   Gradle Kotlin DSL builds for the Android app and Kotlin linter,
   plus agent guardrails,
   output filters,
   `AGENTS.md` rules,
   and file-enforcer generation built around `mise run`
   (`doc/planning/mise-removal-coverage.md`).

## Bazel ecosystem evidence

- Bazel 9 is the active LTS and supports Bzlmod only
   (<https://blog.bazel.build/2026/01/20/bazel-9.html>).
- rules_js accepts `lockfileVersion: '9.0'`,
   catalogs through resolved importers,
   and `workspace:*` as `link:` entries
   (`npm/private/pnpm.bzl:124-125`,
   `:295-305`).
  Native pnpm 12 support is on `main` but unreleased as of v3.4.1.
- rules_ts expects dependencies to supply `.d.ts` files
   (`docs/troubleshooting.md:96`);
   no documented path covers depending on `.ts` source through `exports`.
- rules_lint ships no oxlint linter
   (`lint/` lists eslint and stylelint for JavaScript);
   oxlint JS plugins and type-aware mode would need a custom lint aspect.
- No Bazel Central Registry ruleset exists for tsdown or rolldown;
   each needs a `js_run_binary` wrapper.
  dprint fits only as a generic formatter binary.
- rules_rust keeps `Cargo.toml` as the dependency source through `crate.from_cargo`,
   supports dated nightly toolchains,
   and has no cargo-nextest integration.
  rules_fuzzing covers C++ and Java only.
- rules_android `README.md:5-6`:
   "development preview of the Starlark implementation...
   incomplete and may not function as-is".
  No Gradle interop is documented,
   so the Android app would be a full port.
- JetBrains Bazel plugin 2026.2.2.1 describes itself as supporting Java and Kotlin;
   the legacy Google plugin is marked unmaintained.
  rules_js tells TypeScript editor users to run `pnpm install` outside Bazel.

## Why the gains stay small

- Content-addressed caching skips unchanged actions but does not shorten an action.
  The dominant lint cost sits inside one oxlint rule's type analysis.
- Source-level `/ts` imports widen invalidation:
   editing a shared module invalidates every dependent's lint and type-check action anyway.
- A shared remote cache pays off across many developers and CI machines;
   neither exists here at a scale that would amortize it.
- Starlark would add a configuration language,
   against the draft direction in `doc/planning/mise-removal-coverage.md`
   that TypeScript be the canonical authored format.

## Lighter paths to the same gap

- Mise tasks can declare `sources` and `outputs` for modification-time skipping,
   and Mise has an experimental content-hash task cache
   (mise `docs/tasks/task-configuration.md:444-452`,
   `docs/tasks/caching.md`).
- pnpm 12.4 `pnpm pipeline` runs affected projects with cached outputs restored
   (pnpm.io `docs/cli/pipeline.md`);
   it is already the task-orchestration candidate in `doc/planning/mise-removal-coverage.md`.
  The repository resolves pnpm 12.3.4.

Neither path has been piloted here.

## Evidence limits

- No Bazel build of any package was attempted.
- Unverified:
   whether rules_js can run `.ts` files resolved through `exports` in the sandbox,
   and whether oxlint JS plugins or type-aware mode work there.
- The single-author and CI measurements describe the last year,
   not future team growth.
